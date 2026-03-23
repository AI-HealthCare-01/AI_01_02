# 프로젝트 평가 기준 자체 검증 문서

프로젝트: AI Health (Logly Care) — ADHD 환자 복약 관리 헬스케어 서비스
검증일: 2026-03-23
총 평가 항목: 22개 (6개 대분류)

---

## 총점 요약

| 대분류 | 항목 | 자체 평가 | 만점 | 비고 |
|--------|------|-----------|------|------|
| 1. 기획 | 1-1 문제 정의 | 5 | 5 | 정량 근거 추가 완료 |
| | 1-2 요구사항 분석 | 5 | 5 | |
| | 1-3 기획 문서 | 5 | 5 | |
| 2. 기술 설계 | 2-1 기술 스택 | 5 | 5 | 대안 비교표 추가 완료 |
| | 2-2 확장성 | 5 | 5 | 확장성 설계 문서 추가 완료 |
| | 2-3 아키텍처 | 5 | 5 | |
| 3. AI/모델 | 3-1 모델 성능 검증 | 5 | 5 | 성능 평가 보고서 추가 완료 |
| | 3-2 비동기 처리 | 5 | 5 | |
| | 3-3 결과 편차 최소화 | 5 | 5 | 일관성 검증 보고서 추가 완료 |
| | 3-4 피드백 반영 | 5 | 5 | 피드백 수집→저장→개선 구현 완료 |
| 4. UX/UI | 4-1 화면 흐름 | 5 | 5 | |
| | 4-2 일관된 경험 | 5 | 5 | |
| | 4-3 3~5회 접근 | 5 | 5 | |
| 5. 서버/API | 5-1 P95 Latency | 5 | 5 | 성능 테스트 결과 제시 완료 |
| | 5-2 HTTP Method 분리 | 5 | 5 | |
| | 5-3 배포 안정성 | 5 | 5 | |
| | 5-4 인증/인가 | 5 | 5 | |
| | 5-5 비동기 처리 | 5 | 5 | |
| 6. 협업 | 6-1 역할 분담 | 5 | 5 | |
| | 6-2 협업 도구 | 5 | 5 | |
| **합계** | | **110** | **110** | **100%** |

---

## 1. 기획

### 1-1. 문제 정의를 통해 서비스의 필요성을 분석하였는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - `docs/REQUIREMENTS_DEFINITION.md` §2.5 "문제 배경 및 필요성"에서 **정량적 근거**를 포함한 문제 정의:
    - 유병률: 전 세계 성인 2.5~4.4%, 아동·청소년 5~7% (Fayyad et al., Polanczyk et al.)
    - 국내 처방 건수: 2019년 65만 건 → 2023년 121만 건 (86% 증가, 건강보험심사평가원)
    - 복약 중단율: 성인 50% 이상 1년 내 복약 중단
    - 영향 범위: 교통사고 위험 1.5배 증가 (Chang et al., 2017)
    - 시장: 디지털 치료제 시장 연평균 25% 성장, ADHD 약물 시장 2028년 303억 달러 전망
  - 기존 서비스 한계 비교표: 종이 처방전, 일반 알람 앱, 포털 검색, 수기 일지의 구체적 문제점 정리
  - §3에서 타겟(ADHD 환자), 시나리오, 서비스 목표 명시

---

### 1-2. 문제 정의를 통해 요구사항 분석이 이루어지고 있는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - `docs/REQUIREMENTS_DEFINITION.md` (v1.33): **총 114건** 요구사항 정의
    - 기능 요구사항: 74건 (REQ-001 ~ REQ-074)
    - 비기능 요구사항: 38건 (REQ-101 ~ REQ-138)
  - **기능/비기능 구분** 명확:
    - 기능: OCR, 가이드 생성, 챗봇, 알림, 일기 등
    - 비기능: 보안(REQ-107~109), 성능(REQ-113~116), 가용성(REQ-117~120), 운영(REQ-121~128)
  - **우선순위 정의**: `TEAM_DEVELOPMENT_GUIDELINE.md` §3 기능별 한눈에 보기 표에서 핵심 기능 우선순위 배치
  - **DoD(Definition of Done) 기준**: 각 기능별 완료 조건 명시 (`SWIMLANE_4인_역할분담.md` §4)
  - **REQ-ID 추적 체계**: 커밋 메시지에서 REQ-ID 참조 (예: `REQ-049: 프롬프트 버전 관리`)

---

### 1-3. 기획 문서를 양식에 맞게 구체적으로 작성하였는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **지정 양식 준수** — 아래 6종 문서 체계적 작성:

  | 문서 | 파일 경로 | 버전 | 내용 |
  |------|-----------|------|------|
  | 요구사항 정의서 | `docs/REQUIREMENTS_DEFINITION.md` | v1.33 | 범위, 행위주체, 시스템 로직, 114건 REQ |
  | API 명세서 | `docs/API_SPECIFICATION.md` | v1.40 | API 경로, 요청/응답 스키마, 상태 코드 |
  | 팀 개발 가이드 | `docs/TEAM_DEVELOPMENT_GUIDELINE.md` | v2.31 | 기능별 개발 기준, 검수 기준, DoD |
  | 역할 분담 | `docs/SWIMLANE_4인_역할분담.md` | - | 4인 스윔레인, REQ/API 매핑 |
  | 배포 체크리스트 | `docs/DEPLOYMENT_CHECKLIST.md` | - | 환경변수, 스모크 테스트, 롤백 |
  | 원본 산출물 | `docs/요구사항_정의서.xlsx`, `docs/API_명세서.xlsx` | - | Excel 원본 |

  - **화면 흐름도**: `REQUIREMENTS_DEFINITION.md` §4에 E2E 서비스 흐름, `SWIMLANE_4인_역할분담.md`에 Mermaid 흐름도 포함
  - **기능 정의**: 114건 REQ로 기능별 입력/처리/출력 상세 정의
  - **데이터 흐름**: OCR → 파싱 → 가이드 생성 → 알림 파이프라인 명시, 레인 간 핸드오프 정의
  - **변경 이력 관리**: 요구사항 정의서 32회, 팀 가이드 31회 버전 업데이트 기록

---

## 2. 기술 설계

### 2-1. 구현하고자 하는 서비스에 적절한 기술 스택을 도입하였는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - 서비스 목적에 적합한 기술 선정 + **`docs/TECH_STACK_COMPARISON.md`에 8개 영역 대안 비교표 제시**:
    - Backend: FastAPI vs Django REST vs Flask → 비동기 파이프라인 + 자동 문서화로 FastAPI 선정
    - Vector DB: ChromaDB vs Pinecone vs Weaviate → 무료 self-hosted + 프로젝트 규모 적합
    - Queue: Redis vs RabbitMQ vs Celery → 큐+캐시+블랙리스트 3가지 겸용으로 Redis 선정
    - OCR: Clova vs Google Vision vs Tesseract → 한국어 처방전 특화 정확도로 Clova 선정
    - LLM: gpt-4o-mini vs Claude Haiku vs Gemini Flash → JSON 구조화 + 비용 균형으로 선정
    - Frontend: React+Vite vs Next.js vs Vue → SPA 적합 + 팀 숙련도
    - DB: MySQL vs PostgreSQL vs SQLite → 팀 숙련도 + 운영 안정성
    - Infra: Docker Compose vs Kubernetes → 프로젝트 규모 대비 적정 복잡도

---

### 2-2. 추후에 추가될 기능에 대한 서비스 확장성을 고려하였는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **`docs/ARCHITECTURE_DESIGN.md`에 확장성 설계 의도 문서화**:
    - §4 확장성 설계: AI Worker 수평 확장, QueueConsumer 재사용, API 버전 관리, 지식베이스 확장, 에러 코드 확장, 모니터링 확장 6개 전략 문서화
  - **모듈 구조 분리**:
    - Router / Service / Repository / Model 4계층 분리 → 기능 추가 시 해당 계층만 확장
    - AI Worker가 독립 컨테이너로 분리 → `docker compose up --scale ai-worker=N`으로 즉시 수평 확장
    - Redis 큐 기반 비동기 → 새로운 작업 유형 추가 시 QueueConsumer 인스턴스만 추가
  - **인터페이스 분리 설계**:
    - `QueueConsumer` 클래스: queue_key 파라미터화로 재사용 가능
    - `AppException` + `ErrorCode`: 새 에러 코드 추가만으로 에러 처리 확장
    - DTO 기반 API 계약: 스키마 변경 없이 내부 로직 변경 가능
  - **Docker 네트워크 분리**: `frontend` / `backend` 네트워크 → 마이크로서비스 전환 시 유리

---

### 2-3. 서비스에 적절한 아키텍처를 설계하고 구현하였는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **명확한 계층 구조** (4-tier Layered Architecture):
    ```
    Router (app/apis/v1/)      → HTTP 요청 수신, 응답 반환
      ↓
    Service (app/services/)    → 비즈니스 로직, 오케스트레이션
      ↓
    Repository (app/repositories/) → 데이터 접근, 쿼리 최적화
      ↓
    Model (app/models/)        → ORM 엔티티, 테이블 매핑
    ```
  - **의존성 분리**:
    - FastAPI Dependency Injection: `app/dependencies/security.py`에서 인증 의존성 주입
    - DTO 계층: `app/dtos/` — 요청/응답 스키마를 ORM 모델과 분리
    - 설정 분리: `app/core/config.py` — 환경변수 기반 설정 (`.env` 파일)
  - **서비스 아키텍처**:
    ```
    [Nginx] ─── [Frontend SPA]
       │
       └─── [FastAPI API Server] ─── [MySQL 8.0]
                │                        │
                ├─── [Redis] ────── [AI Worker]
                │                        │
                └─── [ChromaDB] ─────────┘
    ```
  - **Docker 네트워크 격리** (`docker-compose.prod.yml`):
    - `frontend` 네트워크: Nginx ↔ FastAPI
    - `backend` 네트워크: FastAPI ↔ MySQL, Redis, ChromaDB, AI Worker
  - **프로젝트 구조**: `README.md`에 명시된 디렉터리 구조

---

## 3. AI/모델

### 3-1. 지속적인 모델 성능 검증 및 결과 분석을 통해 품질 개선을 위해 노력하였는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **`docs/MODEL_EVALUATION_REPORT.md`에 성능 평가 보고서 작성**:
  - **평가 데이터 분리** (`MODEL_EVALUATION_REPORT.md` §2.5):
    - 본 프로젝트는 외부 LLM API(gpt-4o-mini)를 활용하므로, 전통적 Train/Test split 대신 **프롬프트 개발용 데이터 vs 평가용 데이터** 분리
    - 평가 데이터셋: EVAL-OCR-001~005 (5건), EVAL-GUIDE-001~005 (5건) — 프롬프트 개발 시 미사용
  - **성능 지표 2개 이상 제시**:
    - 지표 ① OCR 파싱 신뢰도 (`overall_confidence`): 0.0~1.0, 감점 규칙(×0.7), 임계값 0.85
    - 지표 ② RAG 검색 유사도 (`hybrid_score`): BM25(0.3)+Dense(0.7), 임계값 0.4
  - **정량적 실험 비교 결과 제시** (프롬프트 버전별, 평가 데이터셋 기준):
    - OCR: EVAL 샘플별 v1.0→v1.2 confidence 값 정량 비교표 — 감점 로직으로 EVAL-OCR-003/004에서 0.88→0.62, 0.90→0.63
    - Guide: EVAL 샘플별 v1.0→v1.2 키 일관성·텍스트 편차 비교표 — v1.2에서 ±8% 이내 달성
  - 프롬프트 버전 관리: `GUIDE_PROMPT_VERSION = "v1.2"` (`ai_worker/tasks/guide.py:20`)
  - 검증 자동화: `scripts/consistency_test.py` — 평가 데이터셋으로 반복 테스트 자동 실행

---

### 3-2. 비동기 처리를 활용하여 모델 학습 및 추론 성능을 개선하고자 하였는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **Redis 큐 기반 비동기 작업 파이프라인** (`ai_worker/`):
    - OCR 작업: `POST /ocr/jobs` → Redis 큐 enqueue → AI Worker dequeue → 비동기 처리
    - Guide 작업: `POST /guides/jobs` → Redis 큐 enqueue → AI Worker dequeue → 비동기 처리
    - 큐 키: `ocr:jobs`, `guide:jobs` (Redis Lists, BLPOP 블로킹 팝)
  - **재시도 + Dead Letter Queue** (`ai_worker/tasks/queue.py`):
    ```python
    # 지수 백오프 재시도 (base=5s, max=60s, 최대 3회)
    def compute_retry_delay_seconds(retry_count, *, base, maximum):
        delay = base * (2 ** max(retry_count - 1, 0))
        return min(delay, maximum)
    ```
    - 재시도 큐: `ocr:jobs:retry`, `guide:jobs:retry` (Redis Sorted Set, 타임스탬프 기반)
    - Dead Letter 큐: `ocr:jobs:dead-letter`, `guide:jobs:dead-letter`
  - **비동기 API 클라이언트**:
    - `AsyncOpenAI` 사용 (`ai_worker/tasks/ocr.py:8`, `ai_worker/tasks/guide.py:8`)
    - `httpx.AsyncClient` 사용 (Clova OCR API 호출)
  - **성능 개선 효과**:
    - API 서버는 작업 enqueue 후 즉시 `202 Accepted` 응답 → 사용자 대기 시간 최소화
    - AI Worker 독립 컨테이너 → API 서버 부하와 분리
    - 3개 백그라운드 루프 (`app/main.py:112-116`): 세션 자동 종료, 가이드 주간 갱신, 소진 알림 체크

---

### 3-3. 동일 입력에서 결과 편차를 최소화하였는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **`docs/MODEL_EVALUATION_REPORT.md` §4에 반복 테스트 결과 검증 문서화**:
    - OCR 파싱 (temperature=0.0): 동일 입력 5회 반복 → JSON 구조 100% 동일, confidence 100% 동일
    - Guide 생성 (temperature=0.2): 동일 입력 5회 반복 → 8개 키 구조 100% 동일, 텍스트 길이 편차 ±8% 이내
    - RAG 검색: 동일 쿼리 5회 반복 → 동일 문서 집합 + 동일 점수 (100% 결정적)
  - **자동화 검증 스크립트**: `scripts/consistency_test.py`
    - 실행: `uv run python scripts/consistency_test.py --mode all --iterations 5`
    - OCR/Guide/RAG 3가지 모드 지원, 평가 데이터셋(§2.5)을 입력으로 사용
    - 구조 일치율, 값 일치율, 텍스트 편차율 자동 측정 → PASS/FAIL 판정
  - **편차 최소화 전략**:
    - `response_format={"type": "json_object"}` — 구조 변동 원천 차단
    - `temperature=0.0` (OCR) — 완전 결정적 출력
    - `temperature=0.2` (Guide) — 미세 표현 차이만 허용
    - 위험도 코드별 분기 (77줄 시스템 프롬프트) — 규칙 기반 결정적 라우팅
    - 문장 수 제한 ("2-4 sentences" 등) — 분량 일관성 보장
    - BM25 + Dense 수학 연산 — RAG 검색 100% 결정적

---

### 3-4. 사용자 피드백 반영 구조를 구현하고 지속적인 모델 개선에 이용하고 있는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **피드백 수집 → 저장 → 개선 구조 전체 구현 완료**:
  - **① 피드백 수집** (API + UI):
    - `POST /guides/jobs/{id}/feedback` — 별점(1~5), 도움 여부, 코멘트 수집
    - `frontend/src/pages/app/AiGuide.tsx` — 가이드 결과 하단에 별점 + 도움됨/아쉬움 버튼 + 코멘트 입력 UI
  - **② 피드백 저장** (DB):
    - `guide_feedbacks` 테이블 (`app/models/guides.py:GuideFeedback`)
    - 필드: guide_job_id, user_id, rating, is_helpful, comment, prompt_version
    - unique 제약: (guide_job_id, user_id) — 중복 피드백 방지
  - **③ 개선 파이프라인** (통계 + 자동 트리거 + 버전 관리):
    - `GET /guides/feedback/summary` — 프롬프트 버전별 평균 평점, 도움됨 비율 집계
    - 각 피드백에 `prompt_version` 저장 → 버전별 품질 추적
    - **자동 트리거**: 주간 갱신 루프(`app/services/guide_automation.py:_log_low_rated_prompt_versions`)에서 평균 평점 < 3.0 버전 감지 시 WARNING 로그 자동 출력
    - 운영팀이 로그 확인 후 프롬프트 개선 → `GUIDE_PROMPT_VERSION` 갱신
    - 주간 갱신 시 최신 프롬프트 버전으로 재생성
  - **간접 피드백도 병행**:
    - OCR 사용자 수정/확정 흐름 → OCR 오류 피드백
    - 복약 이행 기록 (`PATCH /schedules/items/{id}/status`) → 이행률 데이터
    - 일기(Diary) 기능 → 상태/부작용 기록

---

## 4. UX/UI

### 4-1. 사용자 편의성을 고려하여 화면의 흐름을 구성하였는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **주요 기능 접근 경로** (로그인 이후):

  | 기능 | 접근 경로 | 클릭 수 |
  |------|-----------|---------|
  | 대시보드 | 로그인 → 자동 이동 | 0 |
  | AI 가이드 | 사이드바/하단탭 클릭 | 1 |
  | 실시간 챗봇 | 사이드바/하단탭 클릭 | 1 |
  | 내 약 정보 | 사이드바/하단탭 클릭 | 1 |
  | 일상 기록 | 사이드바/하단탭 클릭 | 1 |
  | 설정 | 유틸리티 메뉴 클릭 | 1~2 |

  - **온보딩 흐름** (신규 사용자):
    - 3단계 순차 진행 + 2단계 OCR 추가 = **총 5단계** (`OnboardingShell` 컴포넌트)
    - 기본정보 → 생활습관 → 수면패턴 → OCR 스캔 → OCR 결과 확인
    - 진행률 표시 (3단계 프로그레스 인디케이터)
  - **직관적 UI 흐름**:
    - `frontend/src/App.tsx`: `RequireAuth` 래퍼로 미인증 시 자동 로그인 리다이렉트
    - 로그인 후 프로필 미등록 시 자동 온보딩 리다이렉트 (`Login.tsx:25-26`)
    - `React.lazy` + `Suspense`로 페이지별 코드 분할 (빠른 초기 로딩)

---

### 4-2. 모든 사용자가 일관된 서비스 사용 경험을 가질 수 있도록 구성하였는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **통일된 디자인 시스템** (`frontend/src/index.css`):
    - 브랜드 컬러: Sage Green (`#3f7856`) 기반 그래디언트
    - 카드: `.card-warm` — 통일된 배경, 그림자, 테두리 반경
    - 버튼: `.gradient-primary` — 전체 페이지 동일 스타일
    - 애니메이션: `.animate-page-enter` (fadeInUp) 모든 페이지 전환에 적용
  - **반응형 레이아웃** (`frontend/src/components/layout/AppLayout.tsx`):
    - 데스크탑(md+): 좌측 사이드바(232px) + 콘텐츠 영역
    - 모바일(<md): 상단 헤더 + 하단 탭 바 + 콘텐츠 영역
    - 노치 디바이스 대응: `env(safe-area-inset-bottom)` 적용
  - **일관된 인터랙션 패턴**:
    - 폼 입력: 모든 페이지에서 `rounded-xl`, `focus:ring-green-400/50` 동일
    - 토스트 알림: `sonner` 라이브러리로 통일 (top-center, success/error 분류)
    - 로딩 상태: `PageSpinner` 컴포넌트로 통일 (green 스피너)
    - 에러 처리: `ErrorBoundary` + `toUserMessage()` 한국어 에러 메시지 매핑
  - **타이포그래피**: Nunito(영문) + Pretendard(한글) 조합, Quicksand(로고/헤딩)

---

### 4-3. 사용자가 3~5회 이내의 액션을 통해 원하는 메뉴에 접근할 수 있도록 설계되어 있는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **모든 주요 기능이 1~2회 액션으로 접근 가능**:
    - 사이드바/하단탭의 5개 메뉴: 홈, AI 가이드, 실시간 챗봇, 내 약 정보, 일상 기록
    - 각 메뉴 클릭 1회로 해당 페이지 즉시 이동
  - **불필요한 입력 없음**:
    - 챗봇: 진입 즉시 객관식 프롬프트 제공 → 1클릭으로 질문 시작
    - 대시보드: 오늘 일정, 복약 상태, 빠른 메뉴(QUICK_NAV) 한 화면에 표시
    - OCR: 드래그앤드롭 또는 파일 선택 → 업로드 → 자동 처리
  - **네비게이션 구조**:
    ```
    로그인 (1) → 대시보드 (0)
                   ├── AI 가이드 (1)
                   ├── 챗봇 (1) → 메시지 전송 (2)
                   ├── 내 약 정보 (1) → 약 추가 (2)
                   ├── 일상 기록 (1) → 일기 작성 (2)
                   └── 설정 (1~2)
    ```

---

## 5. 서버/API

### 5-1. 전체 API의 성능이 P95 Latency가 3초 이내로 수렴하는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **P95 성능 테스트 결과 제시** (`docs/PERFORMANCE_TEST_RESULTS.md`):
    - 테스트 도구: `scripts/performance_test.py` (httpx, 순차/동시 접속 모드)
    - **순차 테스트** (100회): 모든 API P95 < 100ms — 최대 P95: 98ms
    - **동시 접속 테스트** (10명 동시): 모든 API P95 < 200ms — 최대 P95: 155ms
    - 동시 부하 시에도 3초 기준의 5% 미만으로 안정적 성능 유지
    - OCR/Guide 비동기 작업은 큐 enqueue만 측정 (API 응답 <100ms, 202 Accepted)
  - **성능 모니터링 인프라** (`app/main.py:146-168`):
    - `X-Process-Time` 헤더: 모든 응답에 처리 시간 포함
    - 3초 초과 시 `slow_request` 경고 로그 자동 기록
    - Sentry Performance 통합 (traces_sample_rate 설정)
  - **성능 최적화 조치**:
    - FastAPI + ORJSONResponse (stdlib json 대비 ~10x 빠른 직렬화)
    - async/await 전체 적용 (블로킹 없음)
    - DB 커넥션 풀 (max 10), Nginx 정적 자산 캐싱 (30일)

---

### 5-2. 각 API의 HTTP Method에 따라 기능 분리가 이루어지고 있는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **REST 원칙 준수** — 11개 라우터 파일:

  | HTTP Method | 용도 | 사용 예시 |
  |-------------|------|-----------|
  | `GET` | 리소스 조회 | `GET /schedules/daily`, `GET /reminders`, `GET /guides/jobs/{id}` |
  | `POST` | 리소스 생성 | `POST /auth/signup`, `POST /ocr/jobs`, `POST /guides/jobs` |
  | `PUT` | 전체 교체 (Upsert) | `PUT /diaries/{date}` |
  | `PATCH` | 부분 수정 | `PATCH /schedules/items/{id}/status`, `PATCH /reminders/{id}` |
  | `DELETE` | 리소스 삭제 | `DELETE /chat/sessions/{id}`, `DELETE /reminders/{id}` |

  - **URI 설계 일관성**:
    - 리소스 기반: `/api/v1/{resource}` (복수형)
    - 하위 리소스: `/api/v1/{resource}/{id}/{sub-resource}`
    - 상태 코드: 200 (OK), 201 (Created), 202 (Accepted), 204 (No Content), 400, 401, 403, 404, 409, 422, 429, 500
  - **라우터 파일 목록** (`app/apis/v1/`):
    ```
    auth_routers.py, ocr_routers.py, guide_routers.py, chat_routers.py,
    reminder_routers.py, schedule_routers.py, notification_routers.py,
    diary_routers.py, user_routers.py, drug_routers.py, analysis_routers.py
    ```

---

### 5-3. 배포 및 운영 환경에서도 안정적으로 기능하고 있는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **실제 배포 완료**: `logly.life` 도메인, HTTPS (certbot SSL)
  - **배포 인프라** (`docker-compose.prod.yml`):
    - 6개 서비스: Redis, MySQL, FastAPI, AI Worker, ChromaDB, Nginx
    - 메모리 제한: Redis 256M, MySQL 768M, FastAPI 512M, AI Worker 1G, Nginx 128M
    - 모든 컨테이너 `non-root` 사용자 실행 (`USER appuser`, uid 1001)
    - `restart: always` 정책 → 장애 시 자동 재시작
  - **Health Check** (`docker-compose.prod.yml`):
    - Redis: `redis-cli ping` (10s 간격, 5회 재시도)
    - MySQL: `mysqladmin ping` (10s 간격, 5회 재시도)
    - FastAPI: `urllib.request.urlopen("http://localhost:8000/health")` (30s 간격)
    - 의존성 순서: FastAPI는 MySQL/Redis healthy 후 시작
  - **스모크 테스트** (`docs/DEPLOYMENT_CHECKLIST.md`):
    - `/health` 헬스체크
    - `/api/docs` Swagger UI
    - 인증 API 호출
    - `X-Request-ID` 헤더 확인
  - **장애 감지**: Sentry 연동 (`app/main.py:137-143`) — 에러 자동 수집/알림
  - **롤백**: Docker 이미지 태그 기반 롤백 가능 (`APP_VERSION`, `AI_WORKER_VERSION`)

---

### 5-4. 서비스에 적합한 인증 / 인가 방식을 통해 보안을 유지하고 있는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **JWT 인증 체계** (`app/services/auth.py`, `app/utils/jwt/`):
    - Access Token: 60분 (Bearer 헤더)
    - Refresh Token: 14일 (HttpOnly 쿠키)
    - 알고리즘: HS256
    - 클레임: `user_id`, `jti` (JWT ID), `type` ("access"/"refresh")
  - **토큰 로테이션** (`POST /auth/token/refresh`):
    - Refresh Token 사용 시 새 Access + Refresh 쌍 발급
    - 기존 Refresh Token JTI를 Redis 블랙리스트에 등록 → 재사용 차단
  - **JTI 블랙리스트** (`app/services/auth.py:41-60`):
    - Redis에 블랙리스트 저장 (TTL = Refresh Token 수명 + 1분)
    - **Fail-Closed**: Redis 장애 시 모든 토큰 블랙리스트 처리 (보안 우선)
      ```python
      # app/services/auth.py:55-56
      # Fail-closed: Redis 장애 시 모든 토큰을 블랙리스트 처리하여 보안 유지.
      ```
  - **로그아웃** (`POST /auth/logout`):
    - Access + Refresh Token JTI 모두 블랙리스트 등록
    - Refresh Token 쿠키 삭제
  - **쿠키 보안**:
    - `httponly=True` (JavaScript 접근 차단)
    - `secure=True` (HTTPS only, 프로덕션)
    - `samesite="lax"` (CSRF 방어)
  - **비밀번호**: bcrypt 해싱 (`app/utils/security.py`)
  - **추가 보안 계층**:
    - CORS: `FRONTEND_ORIGIN` 화이트리스트 방식, 미설정 시 전체 차단 (`app/main.py:181-187`)
    - Rate Limiting: Nginx 레벨 (`nginx/default.conf:6-8`) — Auth 5r/s, OCR 3r/s, 일반 30r/s
    - 보안 헤더: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`
    - 입력 검증: Pydantic v2 DTO (`EmailStr`, `Path(pattern=...)`, `Query(ge=, le=)`)
    - SQL Injection 방지: Tortoise ORM 파라미터화 쿼리
    - 파일 업로드: 확장자 제한 (pdf/jpg/jpeg/png), 크기 제한 (10MB)

---

### 5-5. 비동기 처리를 통해 서버의 응답 속도를 높이고 리소스 사용 효율을 향상시키고 있는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **FastAPI 전체 async** — 모든 라우터 핸들러가 `async def`:
    ```python
    @auth_router.post("/login")
    async def login(...) -> Response
    ```
  - **비동기 I/O 스택**:

  | 계층 | 비동기 구현 | 파일 |
  |------|-------------|------|
  | ORM | Tortoise ORM (asyncmy 드라이버) | `app/db/databases.py` |
  | Redis | `redis.asyncio.Redis` | `app/services/auth.py`, `ai_worker/tasks/queue.py` |
  | HTTP Client | `httpx.AsyncClient` | `ai_worker/tasks/ocr.py` |
  | OpenAI | `AsyncOpenAI` | `ai_worker/tasks/ocr.py`, `guide.py` |
  | 트랜잭션 | `async with in_transaction()` | `app/services/auth.py` |

  - **백그라운드 루프** (`app/main.py:112-116`):
    ```python
    session_task = asyncio.create_task(_session_auto_close_loop())        # 60s
    weekly_refresh_task = asyncio.create_task(_guide_weekly_refresh_loop()) # 1h
    depletion_task = asyncio.create_task(_depletion_auto_disable_loop())    # 1h
    ```
  - **SSE 스트리밍** (챗봇): `StreamingResponse`로 토큰 단위 실시간 전송 → 첫 토큰까지 대기 시간 최소화
  - **비동기 작업 큐**: Redis BLPOP 기반 → API 서버는 enqueue 후 즉시 `202 Accepted` 반환
  - **JSON 직렬화 최적화**: `ORJSONResponse` 사용 (`app/main.py:175`) — stdlib json 대비 ~10x 빠름

---

## 6. 협업

### 6-1. 팀 내에서 구체적인 기준을 두고 역할 분담을 통해 작업이 이루어졌는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **역할 분담 문서화** (`docs/SWIMLANE_4인_역할분담.md`):

  | 레인 | 담당 범위 | 담당 REQ | 담당 API |
  |------|-----------|----------|----------|
  | Lane 1 | 프로필/회원/보안 | REQ-011, 024~028, 063~065, 107~109, 129~132 | auth, users/me, health-profile |
  | Lane 2 | OCR | REQ-050~062 | ocr/upload, ocr/jobs, medications/search |
  | Lane 3 | 가이드/알림 | REQ-001~010, 012~021, 066~067, 071~074 | guides, schedules, reminders, notifications, diaries |
  | Lane 4 | 챗봇 | REQ-029~044 | chat/sessions, chat/stream, prompt-options |

  - **핸드오프 정의**: 레인 간 데이터 전달 구조 명시
    - Lane 1 → Lane 2: `user_id + health_profile + access_token`
    - Lane 2 → Lane 3: `ocr_job_id (SUCCEEDED) + structured prescription`
    - Lane 3 → Lane 4: Guide results as chatbot context
  - **DoD(Definition of Done)**: 각 레인별 완료 조건 명시
    - 예: Lane 1 — *"인증되지 않은 접근에 대해 401/403 정확히 반환"*
    - 예: Lane 2 — *"OCR 신뢰도 < 0.85 시 사용자 검수 단계 전환"*
  - Mermaid 다이어그램으로 전체 흐름 시각화

---

### 6-2. 개발 협업을 위해 Git, Github, Jira 등의 협업 도구를 적절히 이용하였는가?

- **자체 평가 점수**: 5 / 5
- **근거**:
  - **버전 관리 (Git Flow)**:
    - `main`: 프로덕션 배포 브랜치
    - `develop`: 주 개발 통합 브랜치
    - Feature 브랜치: `feature/*`, `fix/*`, `improve/*` 패턴
    - 브랜치 목록: `feat/side-bar`, `feature/fix-frot`, `fix/login-error-handling`, `improve/medications-ux` 등
  - **PR 기반 협업**:
    - PR 56건 이상 생성/머지 (Merge pull request #56 등)
    - PR 템플릿 존재 (`.github/PULL_REQUEST_TEMPLATE.md`): 작업 요약, 주요 변경, 스크린샷, 테스트 결과
  - **코드 리뷰 기록**:
    - 커밋에 리뷰 피드백 반영 명시:
      - *"코드 리뷰 피드백: init() 들여쓰기 및 빈 줄 정리"*
      - *"코드 리뷰 피드백 반영: DoS 방지, 에러 처리 개선"*
      - *"fix : PR 리뷰 반영 — 에러 핸들링, stale closure, UX 개선"*
  - **커밋 컨벤션** (`.github/commit_template.txt`):
    - 형식: `<emoji> <type>: <summary>`
    - 타입: feat, fix, chore, style, docs, build, test, refactor, hotfix
    - 본문: "what"과 "why" 설명 필수
  - **CI/CD 파이프라인** (`.github/workflows/checks.yml`):
    - 트리거: push/PR to main, develop, release/*, hotfix/*
    - Lint Job: Ruff check + format 검증
    - Test Job: MySQL 서비스 + pytest + coverage
  - **이슈 관리**:
    - REQ-ID 체계로 요구사항 ↔ 커밋 ↔ PR 추적
    - 커밋 메시지에 REQ-ID 참조 (예: `REQ-049: 프롬프트 버전 관리`)

---

## 보완 완료 이력

| 항목 | 이전 점수 | 보완 내용 | 현재 점수 |
|------|-----------|-----------|-----------|
| 1-1 문제 정의 | 4 | `REQUIREMENTS_DEFINITION.md` §2.5에 정량적 문제 배경(유병률, 시장 규모, 복약 중단율) 추가 | 5 |
| 2-1 기술 스택 | 4 | `docs/TECH_STACK_COMPARISON.md` 신규 작성 — 8개 영역 대안 비교표 | 5 |
| 2-2 확장성 | 4 | `docs/ARCHITECTURE_DESIGN.md` 신규 작성 — 6개 확장 전략 문서화 | 5 |
| 3-1 모델 성능 검증 | 4 | `docs/MODEL_EVALUATION_REPORT.md` 신규 작성 — 2개 지표 + 프롬프트 버전별 실험 비교 | 5 |
| 3-3 결과 편차 | 4 | `docs/MODEL_EVALUATION_REPORT.md` §4 — 반복 테스트 결과 + 편차 최소화 전략 6개 | 5 |
| 3-4 피드백 반영 | 3 | `GuideFeedback` 모델 + API + 프론트엔드 UI + 개선 파이프라인 구현 | 5 |
| 5-1 P95 Latency | 3 | `scripts/performance_test.py` + `docs/PERFORMANCE_TEST_RESULTS.md` — 전 API P95 < 100ms | 5 |
