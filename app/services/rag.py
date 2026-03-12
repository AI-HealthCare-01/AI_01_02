"""
RAG 하이브리드 검색 서비스 (REQ-036, REQ-037, REQ-040, REQ-041)
Dense(벡터) + BM25(키워드) 결합 검색
"""

from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from typing import Any

import chromadb
from rank_bm25 import BM25Okapi  # type: ignore[import-untyped]

from app.core import config
from app.services.knowledge.adhd_docs import ADHD_DOCUMENTS

logger = logging.getLogger(__name__)


class RagResult:
    def __init__(self, doc_id: str, title: str, source: str, url: str, content: str, score: float) -> None:
        self.doc_id = doc_id
        self.title = title
        self.source = source
        self.url = url
        self.content = content
        self.score = float(score)

    def to_reference_dict(self) -> dict[str, Any]:
        return {
            "document_id": self.doc_id,
            "title": self.title,
            "source": self.source,
            "url": self.url,
            "score": round(self.score, 4),
        }


@lru_cache(maxsize=1)
def _get_bm25() -> tuple[BM25Okapi, list[dict]]:
    tokenized = [doc["content"].split() for doc in ADHD_DOCUMENTS]
    return BM25Okapi(tokenized), ADHD_DOCUMENTS


_chroma_collection_cache: chromadb.Collection | None = None


def _get_chroma_collection() -> chromadb.Collection:
    global _chroma_collection_cache
    if _chroma_collection_cache is not None:
        return _chroma_collection_cache
    client = chromadb.HttpClient(host=config.CHROMA_HOST, port=config.CHROMA_PORT)
    collection = client.get_or_create_collection(
        name=config.CHROMA_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )
    _chroma_collection_cache = collection
    return collection


async def _embed(text: str) -> list[float]:
    from app.services.llm import get_openai_client  # noqa: PLC0415

    client = get_openai_client()
    response = await client.embeddings.create(model=config.OPENAI_EMBEDDING_MODEL, input=[text])
    return response.data[0].embedding


async def hybrid_search(query: str) -> tuple[list[RagResult], bool]:
    """
    하이브리드 검색 수행.
    반환: (결과 목록, needs_clarification)
    needs_clarification=True이면 유사도 임계값 미달 (REQ-042)
    """
    top_k = config.RAG_TOP_K
    bm25_weight = config.RAG_BM25_WEIGHT
    dense_weight = 1.0 - bm25_weight

    # BM25 검색 (동기, 스레드풀에서 실행)
    loop = asyncio.get_running_loop()
    bm25, docs = await loop.run_in_executor(None, _get_bm25)
    bm25_scores_raw: list[float] = await loop.run_in_executor(None, bm25.get_scores, query.split())

    # BM25 점수 정규화 (0~1)
    bm25_max = max(bm25_scores_raw) if max(bm25_scores_raw) > 0 else 1.0
    bm25_scores = [s / bm25_max for s in bm25_scores_raw]

    # Dense 벡터 검색
    try:
        query_embedding = await _embed(query)
        collection = await loop.run_in_executor(None, _get_chroma_collection)
        chroma_result = await loop.run_in_executor(
            None,
            lambda: collection.query(
                query_embeddings=[query_embedding],  # type: ignore[arg-type]
                n_results=min(top_k, len(docs)),
                include=["distances", "metadatas", "documents"],
            ),
        )
        # cosine distance -> similarity (1 - distance)
        dense_id_score: dict[str, float] = {}
        ids = chroma_result["ids"]
        distances = chroma_result["distances"]
        if ids and ids[0] and distances and distances[0]:
            for doc_id, dist in zip(ids[0], distances[0], strict=True):
                dense_id_score[doc_id] = 1.0 - dist
    except Exception:
        global _chroma_collection_cache
        _chroma_collection_cache = None
        logger.warning("ChromaDB dense search failed, falling back to BM25 only", exc_info=True)
        dense_id_score = {}

    # 하이브리드 점수 계산
    doc_id_to_idx = {d["id"]: i for i, d in enumerate(docs)}
    combined: dict[str, float] = {}
    for doc in docs:
        did = doc["id"]
        idx = doc_id_to_idx[did]
        bm25_s = bm25_scores[idx] * bm25_weight
        dense_s = dense_id_score.get(did, 0.0) * dense_weight
        combined[did] = bm25_s + dense_s

    # 상위 top_k 정렬
    top_ids = sorted(combined, key=lambda x: combined[x], reverse=True)[:top_k]
    top_docs = [docs[doc_id_to_idx[did]] for did in top_ids]
    top_scores = [combined[did] for did in top_ids]

    best_score = top_scores[0] if top_scores else 0.0
    needs_clarification = best_score < config.RAG_SIMILARITY_THRESHOLD

    results = [
        RagResult(
            doc_id=d["id"],
            title=d["title"],
            source=d["source"],
            url=d["url"],
            content=d["content"],
            score=s,
        )
        for d, s in zip(top_docs, top_scores, strict=True)
        if s > 0
    ]

    return results, needs_clarification
