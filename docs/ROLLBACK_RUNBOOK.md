# 롤백 런북 (REQ-101)

운영 도메인: `logly.life`
서버: EC2 t3.medium
배포 방식: `docker-compose.prod.yml`

목표: 크리티컬 장애 발생 시 **30분 이내** 이전 안정 버전으로 복구한다.

## 1. 롤백 트리거 기준

| 상황 | 기준 |
|---|---|
| 5xx 에러율 급증 | 배포 후 5분 내 5xx > 5% |
| 핵심 API 불능 | `/health`, `/api/docs`, 로그인, OCR 작업 생성 중 하나라도 실패 |
| DB 마이그레이션 실패 | 컨테이너 시작 시 migration 오류 로그 |
| 외부 API 연쇄 타임아웃 | OCR/LLM 타임아웃 5분 내 3회 이상 연속 |

## 2. 롤백 절차

### Step 1 — 이전 이미지 태그 확인 (2분)

```bash
# Docker Hub에서 직전 안정 태그 확인
# 예: app-v0.9.0, ai-v0.9.0
```

`envs/.prod.env`에서 현재 버전 확인:
```
APP_VERSION=v1.0.0        # 이 값을 이전 버전으로 교체
AI_WORKER_VERSION=v1.0.0
```

### Step 2 — 이미지 롤백 (5분)

```bash
# EC2 접속
ssh -i ~/.ssh/<키파일>.pem ubuntu@<EC2-IP>
cd project

# .env의 버전을 이전 태그로 수정
sed -i 's/APP_VERSION=.*/APP_VERSION=<이전버전>/' .env
sed -i 's/AI_WORKER_VERSION=.*/AI_WORKER_VERSION=<이전버전>/' .env

# 롤백 실행 (docker-compose.prod.yml 사용)
docker compose -f docker-compose.prod.yml pull fastapi ai-worker
docker compose -f docker-compose.prod.yml up -d --no-deps fastapi ai-worker
```

### Step 3 — 복구 확인 (5분)

```bash
# 헬스체크
curl -f https://logly.life/health
curl -f https://logly.life/api/docs

# 컨테이너 상태
docker compose -f docker-compose.prod.yml ps

# 에러 로그 확인
docker compose -f docker-compose.prod.yml logs --tail=50 fastapi
docker compose -f docker-compose.prod.yml logs --tail=50 ai-worker
```

- [ ] `/health` 정상 응답 (`{"status": "ok"}`)
- [ ] `/api/docs` 정상 응답
- [ ] 5xx 에러율 정상화
- [ ] Sentry 신규 에러 없음

### Step 4 — DB 마이그레이션 롤백 (필요 시)

마이그레이션 파일 위치: `app/db/migrations/`

```bash
# 마이그레이션 히스토리 확인 후 이전 버전으로 다운그레이드
docker compose exec fastapi python -m aerich downgrade
```

> 마이그레이션 롤백은 데이터 손실 위험이 있으므로 반드시 DB 백업 후 진행한다.

## 3. 외부 API 장애 Fallback (REQ-120)

롤백 없이 임시 복구가 가능한 경우:

| 장애 | Fallback |
|---|---|
| Clova OCR 타임아웃 | OCR 작업 `FAILED` 처리 → 사용자에게 재시도 안내 (기존 재시도 로직 동작) |
| OpenAI API 장애 | 가이드/챗봇 작업 `FAILED` 처리 → 사용자에게 "잠시 후 재시도" 안내 |
| ChromaDB 불능 | RAG 검색 실패 시 BM25 단독 검색으로 자동 폴백 (rag.py 예외 처리 적용됨) |
| Redis 불능 | 큐 소비 불가 → 워커 재시작 후 Redis 복구 대기 |

## 4. 장애 후 사후 처리

- [ ] Sentry에서 에러 원인 분석
- [ ] 롤백 원인을 PR/이슈에 기록
- [ ] 재배포 전 원인 수정 및 테스트 통과 확인
- [ ] `docs/DEPLOYMENT_CHECKLIST.md` 체크리스트 재수행
