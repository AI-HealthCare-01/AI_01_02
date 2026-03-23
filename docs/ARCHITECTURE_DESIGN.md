# 아키텍처 설계 및 확장성 고려

문서 목적: 서비스 아키텍처의 설계 의도와 확장성 고려 사항을 정리한다.

## 1. 전체 시스템 아키텍처

```
                    ┌─────────────────┐
                    │   Nginx (443)   │  ← SSL 종단, Rate Limiting, 정적 자산
                    └────┬───────┬────┘
                         │       │
              ┌──────────┘       └──────────┐
              ▼                              ▼
    ┌──────────────────┐          ┌──────────────────┐
    │  Frontend (SPA)  │          │  FastAPI (8000)   │  ← API 서버 (3 workers)
    │  React + Vite    │          │  Router → Service │
    │  Static Files    │          │  → Repository     │
    └──────────────────┘          └────┬────┬────┬────┘
                                       │    │    │
                          ┌────────────┘    │    └────────────┐
                          ▼                 ▼                  ▼
                  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                  │  MySQL 8.0   │  │    Redis      │  │  ChromaDB    │
                  │  (주 DB)     │  │  (큐+캐시)    │  │  (벡터 DB)   │
                  └──────────────┘  └──────┬───────┘  └──────────────┘
                                           │
                                           ▼
                                   ┌──────────────┐
                                   │  AI Worker   │  ← OCR/Guide 비동기 처리
                                   │  (독립 컨테이너) │
                                   └──────────────┘
```

## 2. 계층 구조 (Layered Architecture)

```
app/
├── apis/v1/          # Layer 1: Router — HTTP 요청 수신, 응답 반환, 입력 검증
├── services/         # Layer 2: Service — 비즈니스 로직, 오케스트레이션, 트랜잭션 관리
├── repositories/     # Layer 3: Repository — 데이터 접근, 쿼리 최적화, 캐싱
├── models/           # Layer 4: Model — ORM 엔티티, 테이블 매핑, 관계 정의
├── dtos/             # Cross-cutting: 요청/응답 스키마 (ORM과 분리)
├── dependencies/     # Cross-cutting: FastAPI 의존성 주입 (인증, 서비스 인스턴스)
├── core/             # Cross-cutting: 설정, 예외, 로깅
└── validators/       # Cross-cutting: 입력 검증 로직
```

**설계 원칙**:
- 각 계층은 **하위 계층에만 의존** (Router → Service → Repository → Model)
- Router는 Service만 호출, Model에 직접 접근하지 않음
- DTO로 API 계약과 ORM 모델을 분리 → 내부 리팩터링이 API에 영향 없음

## 3. Docker 네트워크 격리

```yaml
networks:
  frontend:   # Nginx ↔ FastAPI (외부 노출)
  backend:    # FastAPI ↔ MySQL, Redis, ChromaDB, AI Worker (내부 전용)
```

- FastAPI만 양쪽 네트워크에 참여 → 게이트웨이 역할
- MySQL, Redis, ChromaDB는 backend 네트워크에만 존재 → 외부 직접 접근 차단

## 4. 확장성 설계

### 4-1. AI Worker 수평 확장

```
[Redis Queue] ──BLPOP──→ [AI Worker #1]
              ──BLPOP──→ [AI Worker #2]  ← docker-compose scale ai-worker=N
              ──BLPOP──→ [AI Worker #N]
```

- AI Worker는 독립 컨테이너로 Redis 큐만 구독
- `docker compose up --scale ai-worker=3`으로 즉시 수평 확장
- 각 Worker가 BLPOP으로 경합 소비 → 작업 중복 없음

### 4-2. QueueConsumer 재사용 패턴

```python
# ai_worker/tasks/queue.py — 파라미터화된 범용 큐 소비자
class QueueConsumer:
    def __init__(self, *, queue_key, retry_queue_key, dead_letter_queue_key, ...):
        ...
```

- `queue_key`만 변경하여 새로운 작업 유형(예: `report:jobs`) 즉시 추가 가능
- 재시도 로직(지수 백오프), Dead Letter Queue 처리가 모두 재사용됨

### 4-3. API 버전 관리

```
app/apis/
├── v1/          # 현재 안정 API (11개 라우터)
└── v2/          # WebSocket/신규 API 확장 영역
```

- v1 API 하위 호환성 유지하며 v2에서 신규 기능 추가
- FastAPI의 `APIRouter(prefix="/v2")` 기반 라우터 분리

### 4-4. 지식베이스 확장

```python
# app/services/knowledge/adhd_docs.py
ADHD_DOCUMENTS = [
    {"doc_id": "adhd-001", "title": "...", "content": "...", ...},
    # 문서 추가만으로 RAG 검색 범위 자동 확장
]
```

- 새 의학 지식 문서 추가 → BM25 인덱스 자동 재구축 (`@lru_cache` 무효화)
- ChromaDB 컬렉션에 임베딩 자동 추가

### 4-5. 에러 코드 확장

```python
# app/core/exceptions.py
class ErrorCode(StrEnum):
    # 새 에러 코드 추가만으로 HTTP 상태 + 사용자 메시지 + 재시도 가능 여부 자동 매핑
    NEW_FEATURE_ERROR = "NEW_FEATURE_ERROR"
```

- `_ERROR_META` 딕셔너리에 튜플 추가 → 예외 핸들러가 자동으로 적절한 응답 생성

### 4-6. 모니터링 확장

- Sentry SDK 통합 → `SENTRY_DSN` 환경변수만 설정하면 에러 추적 활성화
- `RequestIDMiddleware` → 분산 추적을 위한 `X-Request-ID` 전파 준비 완료
- `X-Process-Time` 헤더 → APM 도구 연동 시 레이턴시 수집 즉시 가능

## 5. 비동기 처리 아키텍처

```
[사용자 요청]
     │
     ▼
[FastAPI] ──POST /ocr/jobs──→ [Redis Queue] ──→ [AI Worker]
     │                                              │
     │ 202 Accepted (즉시 응답)                      │ Clova OCR → LLM 파싱
     │                                              │
     ▼                                              ▼
[Frontend Polling] ←───GET /ocr/jobs/{id}────── [DB 상태 업데이트]
```

- API 서버는 작업 enqueue 후 즉시 `202 Accepted` → 사용자 대기 시간 최소화
- 작업 실패 시 자동 재시도 (지수 백오프, 최대 3회)
- 3회 실패 → Dead Letter Queue로 격리 → 운영팀 알림
