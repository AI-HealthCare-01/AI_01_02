import base64
import json
import time
import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime
from logging import Logger
from pathlib import Path
from typing import Any

import httpx
from openai import AsyncOpenAI
from tortoise.transactions import in_transaction

from ai_worker.core import config
from ai_worker.tasks.queue import QueueConsumer
from app.models.ocr import OcrFailureCode, OcrJob, OcrJobStatus

_SUPPORTED_IMAGE_FORMATS = {"jpg", "jpeg", "png", "pdf", "tiff", "tif"}

_PARSE_SYSTEM_PROMPT = (
    "처방전/약봉투 OCR 텍스트에서 약물 정보를 추출하세요. "
    "각 필드 설명: "
    "drug_name=약품명 전체(제형 포함, mg 숫자만 제외. 예: '콘서타오로스서방정27mg' → '콘서타오로스서방정'), "
    "dose=약물 함량의 mg 숫자(예: '콘서타오로스서방정27mg' → 27.0), "
    "frequency_per_day=1일 투여 횟수, "
    "dosage_per_once=1회 투여 정수(정/캡슐 수), "
    "dispensed_date=조제일(YYYY-MM-DD), "
    "total_days=총 투약 일수. "
    "반드시 JSON으로만 응답하세요: "
    '{"medications": [{"drug_name": str, "dose": float|null, "frequency_per_day": int|null, '
    '"dosage_per_once": int|null, "intake_time": str|null, "administration_timing": str|null, "dispensed_date": "YYYY-MM-DD"|null, "total_days": int|null}], '
    '"overall_confidence": float, "needs_user_review": bool}. '
    "빈 값이 있거나 텍스트가 잘렸다면 confidence를 절대 0.85 이상 주지 마라."
)


async def _call_clova_ocr(file_bytes: bytes, file_name: str) -> tuple[str, list[dict]]:
    """Clova OCR API 호출 → (extracted_text, raw_blocks)"""
    if not config.CLOVA_OCR_APIGW_URL or not config.CLOVA_OCR_SECRET:
        raise ValueError("Clova OCR 설정이 없습니다. CLOVA_OCR_APIGW_URL, CLOVA_OCR_SECRET을 설정하세요.")

    ext = Path(file_name).suffix.lstrip(".").lower()
    fmt = ext if ext in _SUPPORTED_IMAGE_FORMATS else "jpg"
    payload = {
        "version": "V2",
        "requestId": str(uuid.uuid4()),
        "timestamp": int(time.time() * 1000),
        "images": [{"format": fmt, "name": file_name, "data": base64.b64encode(file_bytes).decode()}],
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            config.CLOVA_OCR_APIGW_URL,
            headers={"X-OCR-SECRET": config.CLOVA_OCR_SECRET, "Content-Type": "application/json"},
            content=json.dumps(payload),
        )
        response.raise_for_status()

    data = response.json()
    fields = data.get("images", [{}])[0].get("fields", [])
    extracted_text = " ".join(f["inferText"] for f in fields if f.get("inferText"))
    raw_blocks = [
        {
            "text": f["inferText"],
            "bbox": [
                f["boundingPoly"]["vertices"][0]["x"],
                f["boundingPoly"]["vertices"][0]["y"],
                f["boundingPoly"]["vertices"][2]["x"],
                f["boundingPoly"]["vertices"][2]["y"],
            ],
            "confidence": f.get("confidence"),
        }
        for f in fields
        if f.get("inferText") and f.get("boundingPoly", {}).get("vertices")
    ]
    return extracted_text, raw_blocks


async def _parse_medications_with_llm(extracted_text: str, raw_blocks: list[dict]) -> dict:
    """LLM으로 약물 정보 파싱 → structured_data"""
    if not config.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured — cannot parse OCR text")
    client = AsyncOpenAI(
        api_key=config.OPENAI_API_KEY,
        base_url=config.OPENAI_BASE_URL,
        timeout=config.LLM_TIMEOUT_SECONDS,
    )
    response = await client.chat.completions.create(
        model=config.OPENAI_CHAT_MODEL,
        messages=[
            {"role": "system", "content": _PARSE_SYSTEM_PROMPT},
            {"role": "user", "content": extracted_text[:3000]},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    parsed = json.loads(response.choices[0].message.content or "{}")
    overall_confidence = parsed.get("overall_confidence", 1.0)

    # 후처리 검증 (신뢰도 강제 감점 로직)
    medications = parsed.get("medications", [])
    for med in medications:
        # 1. 누락 필드 감점
        for req_field in ["total_days", "dispensed_date", "dose"]:
            if not med.get(req_field):
                med["confidence"] = 0.7
                overall_confidence = min(overall_confidence, 0.7)

        # 2. 텍스트 품질 감점 (용법 관련 필드 합쳐서 2글자 이하)
        # 스키마 상 intake_time 또는 administration_timing
        usage_text = str(med.get("intake_time", "") or "") + str(med.get("administration_timing", "") or "")
        usage_text = usage_text.strip()
        if len(usage_text) <= 2:
            med["confidence"] = 0.7
            overall_confidence = min(overall_confidence, 0.7)

    parsed["overall_confidence"] = overall_confidence

    parsed["raw_blocks"] = raw_blocks
    parsed["processor"] = f"clova-ocr+openai-{config.OPENAI_CHAT_MODEL}"

    # Compute value-area bboxes for missing fields and attach them
    parsed["missing_field_bboxes"] = _compute_missing_field_bboxes(
        medications=parsed.get("medications", []),
        raw_blocks=raw_blocks,
    )
    return parsed


# ── Field classification ──────────────────────────────────────────────────────

# Fields whose values appear to the RIGHT of the label (general/non-table)
_GENERAL_FIELDS: set[str] = {"dispensed_date", "intake_time"}

# Fields that live inside the drug-list TABLE.
# For these we use (column-header X, drug-name row Y) intersection.
_TABLE_FIELDS: set[str] = {"dose", "frequency_per_day", "dosage_per_once", "total_days"}

# Label keywords for general fields — listed from MOST specific to LEAST specific.
# _find_block_strict() tries them in order and prefers highest-similarity hits.
_GENERAL_LABEL_KEYWORDS: dict[str, list[str]] = {
    "dispensed_date": ["조제연월일", "조제 일자", "처방일자", "조제일자", "조제일"],
    "intake_time":    ["복용방법", "복용시간", "복용법", "용법"],
}

# Texts that must NOT be used as label anchors even if they contain a keyword.
# Key = field name, Value = list of excluded substrings.
_LABEL_EXCLUDES: dict[str, list[str]] = {
    "dispensed_date": ["원내 조제", "원외 조제", "원내조제", "원외조제", "조제실", "조제료"],
    "intake_time":    [],
}

# Column-header keywords for table fields (used to find the column X position)
_TABLE_COLUMN_KEYWORDS: dict[str, list[str]] = {
    "dose":             ["함량", "용량"],
    "frequency_per_day": ["1일", "투여횟수", "횟수"],
    "dosage_per_once":  ["1회", "투약량"],
    "total_days":       ["투약일수", "처방일수", "일수", "총일수"],
}

# box_width for each field (px on the original image)
_FIELD_BOX_WIDTH: dict[str, int] = {
    "dispensed_date":    150,
    "intake_time":       150,
    "dose":               40,
    "frequency_per_day":  40,
    "dosage_per_once":    40,
    "total_days":         40,
}

# Tolerance in px for "same row" height matching
_ROW_Y_TOLERANCE = 20


def _find_block_strict(
    raw_blocks: list[dict],
    keywords: list[str],
    excludes: list[str] | None = None,
) -> tuple[dict | None, str]:
    """
    Find the best-matching raw_block for a label.

    Strategy:
    1. Reject any block whose text contains an excluded substring.
    2. For each keyword (ordered most-specific first), collect all blocks
       that contain it.
    3. Score each candidate as  len(keyword) / len(block_text)  — closer to
       1.0 means the block text IS mostly the keyword (exact/near-exact match).
    4. Return the highest-scoring candidate and the keyword that matched it.
    """
    excludes = excludes or []
    best_block: dict | None = None
    best_kw: str = ""
    best_score: float = -1.0

    for kw in keywords:
        for block in raw_blocks:
            btext: str = block.get("text", "")
            # 1. Exact keyword must be present
            if kw not in btext:
                continue
            # 2. Reject false positives
            if any(exc in btext for exc in excludes):
                continue
            # 3. Similarity score: keyword coverage of block text
            score = len(kw) / max(len(btext), 1)
            if score > best_score:
                best_score = score
                best_block = block
                best_kw = kw

    return best_block, best_kw


# Keep the original name as an alias used by table-field logic (no exclusions needed there)
_find_block = _find_block_strict


def _compute_missing_field_bboxes(
    medications: list[dict],
    raw_blocks: list[dict],
) -> list[dict]:
    """
    Compute value-area bounding boxes for missing OCR fields.

    • General fields (dispensed_date, intake_time):
        Box placed to the RIGHT of the label block. ← label-right logic

    • Table fields (dose, frequency_per_day, dosage_per_once, total_days):
        Box placed at the INTERSECTION of:
          X = column header block's x1  (correct column)
          Y = the missing drug name's y1 in raw_blocks  (correct row)

    raw_blocks bbox: [x1, y1, x2, y2] absolute px.
    Returns: list of { field, label_text, bbox: [x, y, w, h], normalized: {...} }
    """
    if not raw_blocks:
        return []

    all_x2 = [b["bbox"][2] for b in raw_blocks if len(b.get("bbox", [])) == 4]
    all_y2 = [b["bbox"][3] for b in raw_blocks if len(b.get("bbox", [])) == 4]
    image_w = max(all_x2) if all_x2 else 1
    image_h = max(all_y2) if all_y2 else 1

    results: list[dict] = []
    added_fields: set[str] = set()

    # ── 1. General fields ─────────────────────────────────────────────────────
    for med in medications:
        for field in _GENERAL_FIELDS:
            if field in added_fields:
                continue
            val = med.get(field)
            if val is not None and val != "" and val != 0:
                continue  # value present, no box needed

            label_block, matched_kw = _find_block_strict(
                raw_blocks,
                _GENERAL_LABEL_KEYWORDS[field],
                excludes=_LABEL_EXCLUDES.get(field, []),
            )
            if not label_block:
                continue

            lx1, ly1, lx2, ly2 = label_block["bbox"]
            label_h = ly2 - ly1
            box_w = _FIELD_BOX_WIDTH.get(field, 120)

            vx1 = lx2 + 10
            vy1 = ly1
            vx2 = min(vx1 + box_w, image_w)
            vy2 = ly2

            # Fallback: below the label if right edge is out of bounds
            if vx1 >= image_w or vx2 <= vx1:
                vx1 = max(0, lx1)
                vy1 = ly2 + 2
                vx2 = min(lx1 + box_w, image_w)
                vy2 = min(vy1 + label_h + 4, image_h)

            vx1 = max(0, vx1)
            vy1 = max(0, vy1)
            vx2 = min(image_w, vx2)
            vy2 = min(image_h, vy2)
            if vx2 <= vx1 or vy2 <= vy1:
                continue

            results.append(_make_bbox_entry(field, matched_kw, vx1, vy1, vx2, vy2, image_w, image_h))
            added_fields.add(field)

    # ── 2. Table fields: strict crosshair logic ───────────────────────────────
    # For each (medication × field) pair that is missing a value:
    #   box_x  = column-header block's x1          (→ correct column)
    #   box_y  = drug-name block's y1              (→ correct row)
    #   box_w  = fixed 40 px
    #   box_h  = drug-name block height
    # Fallback when header is NOT found in OCR output:
    #   box_x  = drug_x2 + 100                    (offset to the right)
    for med in medications:
        drug_name: str = med.get("drug_name", "") or ""

        # ── Find this drug's row block (best coverage match) ──
        drug_block: dict | None = None
        if drug_name:
            best_drug_score = -1.0
            # Try matching substrings of drug_name against block texts.
            # We use multi-length windows: full name, each individual character
            # cluster, so both "타이레놀" and "Ibuprofen 400mg" are matched.
            candidates = [drug_name]
            # Add each token ≥ 2 chars
            candidates += [t for t in drug_name.split() if len(t) >= 2]
            # Deduplicate
            seen = set()
            candidates = [c for c in candidates if not (c in seen or seen.add(c))]  # type: ignore[func-returns-value]

            for block in raw_blocks:
                btext: str = block.get("text", "")
                if not btext:
                    continue
                for cand in candidates:
                    if cand in btext:
                        score = len(cand) / max(len(btext), 1)
                        if score > best_drug_score:
                            best_drug_score = score
                            drug_block = block
                        break  # found a candidate in this block; move to next block

        # If we can't locate this drug at all, skip — boxes would be meaningless
        if not drug_block:
            continue

        dr_x1, dr_y1, dr_x2, dr_y2 = drug_block["bbox"]
        drug_h = max(dr_y2 - dr_y1, 12)  # at least 12 px tall

        for field in _TABLE_FIELDS:
            val = med.get(field)
            if val is not None and val != "" and val != 0:
                continue  # value present, skip

            box_w = _FIELD_BOX_WIDTH.get(field, 40)

            # ── Find column-header block → gives X ──
            col_block, matched_kw = _find_block(raw_blocks, _TABLE_COLUMN_KEYWORDS[field])

            if col_block:
                # Crosshair: column-header X  ×  drug-name row Y
                vx1 = col_block["bbox"][0]
                vy1 = dr_y1
                vx2 = min(vx1 + box_w, image_w)
                vy2 = min(dr_y1 + drug_h, image_h)
            else:
                # Fallback: offset to the right of the drug name block
                matched_kw = _TABLE_COLUMN_KEYWORDS[field][0]
                vx1 = min(dr_x2 + 100, image_w - box_w)
                vy1 = dr_y1
                vx2 = min(vx1 + box_w, image_w)
                vy2 = min(dr_y1 + drug_h, image_h)

            # Safety clamp
            vx1 = max(0, vx1)
            vy1 = max(0, vy1)
            vx2 = min(image_w, vx2)
            vy2 = min(image_h, vy2)
            if vx2 <= vx1 or vy2 <= vy1:
                continue

            entry_key = f"{field}::{drug_name}"
            if entry_key in added_fields:
                continue

            results.append(_make_bbox_entry(field, matched_kw, vx1, vy1, vx2, vy2, image_w, image_h))
            added_fields.add(entry_key)

    return results


def _make_bbox_entry(
    field: str,
    label_text: str,
    vx1: int, vy1: int, vx2: int, vy2: int,
    image_w: int, image_h: int,
) -> dict:
    return {
        "field": field,
        "label_text": label_text,
        "bbox": [vx1, vy1, vx2 - vx1, vy2 - vy1],
        "normalized": {
            "x": round(vx1 / image_w, 4),
            "y": round(vy1 / image_h, 4),
            "w": round((vx2 - vx1) / image_w, 4),
            "h": round((vy2 - vy1) / image_h, 4),
        },
    }



ALLOWED_STATUS_TRANSITIONS: dict[OcrJobStatus, set[OcrJobStatus]] = {
    OcrJobStatus.QUEUED: {OcrJobStatus.PROCESSING},
    OcrJobStatus.PROCESSING: {OcrJobStatus.QUEUED, OcrJobStatus.SUCCEEDED, OcrJobStatus.FAILED},
    OcrJobStatus.SUCCEEDED: set(),
    OcrJobStatus.FAILED: {OcrJobStatus.QUEUED},
}


class OcrQueueConsumer(QueueConsumer):
    def __init__(self, logger: Logger) -> None:
        super().__init__(
            logger,
            queue_key=config.OCR_QUEUE_KEY,
            retry_queue_key=config.OCR_RETRY_QUEUE_KEY,
            dead_letter_queue_key=config.OCR_DEAD_LETTER_QUEUE_KEY,
            block_timeout_seconds=config.OCR_QUEUE_BLOCK_TIMEOUT_SECONDS,
            retry_backoff_base_seconds=config.OCR_RETRY_BACKOFF_BASE_SECONDS,
            retry_backoff_max_seconds=config.OCR_RETRY_BACKOFF_MAX_SECONDS,
        )


def _ensure_transition(from_status: OcrJobStatus, to_status: OcrJobStatus) -> None:
    if to_status not in ALLOWED_STATUS_TRANSITIONS[from_status]:
        raise ValueError(f"Invalid OCR state transition: {from_status} -> {to_status}")


def _classify_failure(err: Exception) -> OcrFailureCode:
    if isinstance(err, FileNotFoundError):
        return OcrFailureCode.FILE_NOT_FOUND
    if isinstance(err, ValueError) and "Invalid OCR state transition" in str(err):
        return OcrFailureCode.INVALID_STATE_TRANSITION
    return OcrFailureCode.PROCESSING_ERROR


def _format_error_message(*, failure_code: OcrFailureCode, detail: str) -> str:
    return f"[{failure_code.value}] {detail}"[:1000]


def _dispose_raw_document_file(*, file_path: Path, job_id: int, logger: Logger) -> None:
    try:
        if file_path.exists():
            file_path.unlink()
            print(f"🔒 보안을 위해 원본 파일이 즉시 삭제되었습니다: {file_path}")
        else:
            logger.debug("File already disposed or not found (job_id=%s): %s", job_id, file_path)
    except Exception as e:
        logger.warning("failed to dispose raw ocr file (job_id=%s path=%s, error=%s)", job_id, file_path, str(e))


async def process_ocr_job(
    job_id: int,
    logger: Logger,
    schedule_retry: Callable[[int, int], Awaitable[None]] | None = None,
    send_to_dead_letter: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
) -> bool:
    now = datetime.now(config.TIMEZONE)
    _ensure_transition(OcrJobStatus.QUEUED, OcrJobStatus.PROCESSING)
    claimed = await OcrJob.filter(id=job_id, status=OcrJobStatus.QUEUED).update(
        status=OcrJobStatus.PROCESSING,
        started_at=now,
        completed_at=None,
        error_message=None,
        failure_code=None,
    )
    if claimed == 0:
        existing = await OcrJob.get_or_none(id=job_id)
        if not existing:
            logger.warning("ocr job not found (job_id=%s)", job_id)
            return False
        logger.info("skip non-queued ocr job (job_id=%s, status=%s)", job_id, existing.status)
        return True

    job = await OcrJob.filter(id=job_id).select_related("document").first()
    if not job:
        logger.warning("ocr job not found after claim (job_id=%s)", job_id)
        return False

    absolute_file_path = Path(config.MEDIA_DIR).resolve() / job.document.temp_storage_key
    try:
        if not absolute_file_path.exists():
            raise FileNotFoundError(f"document file not found: {absolute_file_path}")

        raw_content = absolute_file_path.read_bytes()
        extracted_text, raw_blocks = await _call_clova_ocr(raw_content, job.document.file_name)
        structured_data = await _parse_medications_with_llm(extracted_text, raw_blocks)
        completed_at = datetime.now(config.TIMEZONE)

        async with in_transaction():
            await OcrJob.filter(id=job.id, status=OcrJobStatus.PROCESSING).update(
                status=OcrJobStatus.SUCCEEDED,
                raw_text=extracted_text,
                text_blocks_json=structured_data.get("raw_blocks"),
                structured_result=structured_data,
                needs_user_review=structured_data.get("needs_user_review", True),
                completed_at=completed_at,
                error_message=None,
                failure_code=None,
            )
        _dispose_raw_document_file(file_path=absolute_file_path, job_id=job.id, logger=logger)
        logger.info("ocr job processed successfully (job_id=%s)", job_id)
    except Exception as err:
        current = await OcrJob.get_or_none(id=job_id)
        if not current:
            logger.warning("ocr job missing during failure handling (job_id=%s)", job_id)
            return False

        next_retry_count = current.retry_count + 1
        failure_code = _classify_failure(err)
        error_message = _format_error_message(failure_code=failure_code, detail=str(err))

        if next_retry_count < current.max_retries:
            _ensure_transition(OcrJobStatus.PROCESSING, OcrJobStatus.QUEUED)
            await OcrJob.filter(id=current.id, status=OcrJobStatus.PROCESSING).update(
                status=OcrJobStatus.QUEUED,
                retry_count=next_retry_count,
                error_message=error_message,
                failure_code=failure_code,
                completed_at=None,
            )
            if schedule_retry:
                await schedule_retry(current.id, next_retry_count)
            logger.warning("ocr job retry scheduled (job_id=%s retry_count=%s)", current.id, next_retry_count)
            return True

        _ensure_transition(OcrJobStatus.PROCESSING, OcrJobStatus.FAILED)
        failed_at = datetime.now(config.TIMEZONE)
        await OcrJob.filter(id=current.id, status=OcrJobStatus.PROCESSING).update(
            status=OcrJobStatus.FAILED,
            retry_count=next_retry_count,
            completed_at=failed_at,
            error_message=error_message,
            failure_code=failure_code,
        )
        if send_to_dead_letter:
            await send_to_dead_letter(
                {
                    "job_id": current.id,
                    "user_id": current.user_id,
                    "document_id": current.document_id,
                    "failure_code": failure_code.value,
                    "error_message": error_message,
                    "retry_count": next_retry_count,
                    "max_retries": current.max_retries,
                    "failed_at": failed_at.isoformat(),
                }
            )
        _dispose_raw_document_file(file_path=absolute_file_path, job_id=current.id, logger=logger)
        logger.exception("ocr job processing failed (job_id=%s)", job_id)
    finally:
        # 1-Pass 구조이므로 이미지 데이터(bytes)를 이미 읽었다면
        # 성공/실패 무관하게 여기서 최종적으로 파일을 정리합니다.
        if absolute_file_path.exists():
            _dispose_raw_document_file(file_path=absolute_file_path, job_id=job_id, logger=logger)

    return True
