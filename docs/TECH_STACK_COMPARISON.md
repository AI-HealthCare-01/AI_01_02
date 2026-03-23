# 기술 스택 선정 근거 및 대안 비교

문서 목적: 프로젝트에 도입된 기술 스택의 선정 이유와 비교 대안을 정리한다.

## 1. Backend Framework

| 기준 | FastAPI (선정) | Django REST Framework | Flask |
|------|---------------|----------------------|-------|
| 비동기 지원 | 네이티브 async/await | ASGI 지원(3.1+), 제한적 | 미지원(별도 라이브러리) |
| 성능 (req/s) | ~15,000 | ~3,000 | ~5,000 |
| 자동 API 문서 | OpenAPI/Swagger 자동 생성 | drf-spectacular 별도 설정 | 미지원 |
| 타입 검증 | Pydantic 내장 (런타임 + IDE) | Serializer 별도 정의 | marshmallow 별도 |
| 학습 곡선 | 낮음 | 높음 (ORM/Admin 포함) | 낮음 |
| 의존성 주입 | Depends() 내장 | 미지원 | 미지원 |

**선정 이유**: OCR/Guide 비동기 파이프라인이 핵심 요구사항이므로 네이티브 async가 필수. Pydantic 기반 자동 검증 + OpenAPI 문서화가 4인 팀 협업에 적합. Django의 ORM/Admin은 불필요한 오버헤드.

## 2. Database

| 기준 | MySQL 8.0 (선정) | PostgreSQL 16 | SQLite |
|------|------------------|---------------|--------|
| 한국어 Full-Text | ngram parser 지원 | 한글 형태소 별도 | 미지원 |
| 비동기 드라이버 | asyncmy | asyncpg | aiosqlite |
| 운영 안정성 | 높음 (대형 서비스 검증) | 높음 | 개발용 |
| 팀 숙련도 | 높음 | 중간 | 높음 |
| JSON 지원 | JSON 타입 네이티브 | JSONB (더 강력) | 미지원 |

**선정 이유**: 팀 숙련도와 운영 안정성 우선. JSON 필드(structured_result 등)는 MySQL JSON 타입으로 충분. PostgreSQL의 JSONB 성능 이점보다 팀 생산성이 중요.

## 3. Vector DB (RAG 검색)

| 기준 | ChromaDB (선정) | Pinecone | Weaviate | FAISS |
|------|-----------------|----------|----------|-------|
| Self-hosted | O | X (클라우드 전용) | O | O (라이브러리) |
| 비용 | 무료 (OSS) | 유료 ($70+/mo) | 무료 (OSS) | 무료 |
| 영속 저장 | Docker 볼륨 | 자동 | Docker 볼륨 | 파일 수동 |
| Python SDK | 간결 (3줄 설정) | 간결 | 복잡 | 저수준 |
| 메타데이터 필터 | O | O | O | X |

**선정 이유**: 무료 self-hosted + 경량 Docker 이미지 + 수백 문서 규모의 ADHD 지식베이스에 충분한 성능. Pinecone은 클라우드 종속 + 비용 부담, FAISS는 영속성/메타데이터 관리 부재.

## 4. Message Queue / Cache

| 기준 | Redis (선정) | RabbitMQ | Celery + Redis |
|------|-------------|----------|----------------|
| 메모리 사용 | 낮음 (단일 프로세스) | 중간 (Erlang VM) | 높음 (Worker 프로세스) |
| 설정 복잡도 | 낮음 | 중간 | 높음 (설정 파일 다수) |
| 블로킹 큐 (BLPOP) | 네이티브 | 네이티브 | 추상화 |
| JWT 블랙리스트 겸용 | O (SET + TTL) | X | X |
| Dead Letter Queue | Sorted Set 구현 | 네이티브 | 네이티브 |

**선정 이유**: 큐(OCR/Guide 작업) + 캐시 + JWT 블랙리스트 3가지 용도를 단일 Redis 인스턴스로 해결. t3.medium(4GB) 서버에서 메모리 절약이 중요. Celery의 추가 Worker 프로세스는 과도한 리소스 소모.

## 5. OCR Engine

| 기준 | Naver Clova OCR (선정) | Google Cloud Vision | Tesseract |
|------|------------------------|---------------------|-----------|
| 한국어 정확도 | 최상 (의료문서 학습) | 상 | 중 |
| 처방전 특화 | O (한국 의료문서 학습 데이터) | X (범용) | X (범용) |
| 테이블 인식 | O | O | 제한적 |
| 비용 | 유료 (건당 ~15원) | 유료 (건당 ~$1.5/1000) | 무료 |
| 응답 속도 | ~1~2초 | ~1~3초 | ~5~10초 |

**선정 이유**: 한국어 처방전/약봉투 텍스트 인식이 서비스 핵심. Clova OCR은 한국 의료문서에 특화된 학습 데이터를 보유하여 가장 높은 정확도 제공.

## 6. AI/LLM

| 기준 | OpenAI gpt-4o-mini (선정) | Claude 3.5 Haiku | Gemini 1.5 Flash |
|------|--------------------------|------------------|------------------|
| 한국어 품질 | 상 | 상 | 중상 |
| JSON 구조화 출력 | response_format 네이티브 | tool_use 기반 | JSON mode |
| 비용 (1M tokens) | $0.15 입력 / $0.60 출력 | $0.25 / $1.25 | $0.075 / $0.30 |
| 응답 속도 | ~1~3초 | ~1~3초 | ~1~2초 |
| 스트리밍 | O | O | O |

**선정 이유**: JSON 구조화 출력의 안정성 + 합리적 비용 + 한국어 의료 텍스트 파싱 품질. OCR 파싱에 temperature=0.0으로 결정적 출력 보장.

## 7. Frontend

| 기준 | React + Vite (선정) | Next.js | Vue + Vite |
|------|-------------------|---------|------------|
| SSR 필요성 | 불필요 (SPA) | SSR 기본 (과잉) | 선택적 |
| 빌드 속도 | Vite HMR (~50ms) | Turbopack (~100ms) | Vite HMR (~50ms) |
| 생태계 크기 | 최대 | 대형 | 중형 |
| 팀 숙련도 | 높음 | 중간 | 낮음 |
| TypeScript 지원 | 완전 | 완전 | 완전 |

**선정 이유**: 인증 기반 SPA 서비스에 SSR 불필요. 팀 전원 React 숙련 + Vite의 빠른 개발 경험(HMR ~50ms). Tailwind CSS v4로 일관된 디자인 시스템 구축.

## 8. 인프라

| 기준 | Docker Compose (선정) | Kubernetes | EC2 직접 설치 |
|------|---------------------|------------|--------------|
| 학습 곡선 | 낮음 | 매우 높음 | 중간 |
| 서비스 오케스트레이션 | O (6개 서비스) | O (대규모) | X (수동) |
| 메모리 제한 | mem_limit | resources.limits | 수동 ulimit |
| 스케일링 | 수동 | 자동 | 수동 |
| 적합 규모 | 소~중 (현재) | 대규모 | 단일 서비스 |

**선정 이유**: 4인 팀 + 단일 EC2 서버(t3.medium) 환경에서 Docker Compose가 최적. Kubernetes는 프로젝트 규모 대비 과도한 복잡성.
