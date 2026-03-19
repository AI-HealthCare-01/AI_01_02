# 배포 체크리스트 (REQ-106)

배포 마감: 2026-03-13 (완료)
운영 도메인: `logly.life` (HTTPS)
서버: EC2 t3.medium (4GB RAM)
배포 스크립트: `scripts/deployment.sh`, `scripts/certbot.sh`

## 1. 배포 전 필수 확인

### 코드 품질
- [ ] `ruff check app ai_worker` 통과
- [ ] `mypy app ai_worker` 통과
- [ ] `pytest app/tests -q` 통과
- [ ] GitHub Actions `checks.yml` 워크플로우 green

### 환경변수 (`envs/.prod.env`)
- [ ] `OPENAI_API_KEY` 실제 키로 교체
- [ ] `CLOVA_OCR_APIGW_URL`, `CLOVA_OCR_SECRET` 설정
- [ ] `SENTRY_DSN` 설정 (REQ-119)
- [ ] `SECRET_KEY` 운영용 값으로 교체 (`CHANGE_ME` 방지 — 시작 시 검증됨)
- [ ] `COOKIE_DOMAIN` → `logly.life`
- [ ] `FRONTEND_ORIGIN` → `https://logly.life`
- [ ] `DB_PASSWORD`, `DB_ROOT_PASSWORD` 운영용 값으로 교체

### 이미지 빌드 & 푸시
- [ ] `scripts/deployment.sh` 실행 → FastAPI 이미지 빌드/푸시
- [ ] `scripts/deployment.sh` 실행 → AI Worker 이미지 빌드/푸시
- [ ] Docker Hub에서 이미지 태그 확인

### 인프라 확인
- [ ] Docker 네트워크 분리 확인 (frontend: nginx, backend: fastapi/ai-worker/redis/mysql/chromadb)
- [ ] 메모리 제한 설정 확인 (Redis 256M, MySQL 768M, FastAPI 512M, AI-Worker 1G, Nginx 128M, Certbot 64M)
- [ ] 모든 컨테이너 non-root USER 실행 확인
- [ ] 이미지 버전 고정 확인 (nginx:1.27-alpine, chromadb:0.6.3)

## 2. 최초 배포 (신규 서버)

```bash
# 1. SSL 인증서 발급 (도메인 연결 후)
./scripts/certbot.sh

# 2. 배포 실행 (HTTPS 모드 선택)
./scripts/deployment.sh
```

## 3. 배포 후 스모크 테스트

```bash
# 헬스체크 (전용 엔드포인트)
curl -f https://logly.life/health

# Swagger UI
curl -f https://logly.life/api/docs

# 인증 API
curl -X POST https://logly.life/api/v1/auth/login ...

# X-Request-ID 헤더 확인 (REQ-105)
curl -v https://logly.life/api/docs 2>&1 | grep -i x-request-id

# Rate limiting 확인
# Auth: 5 req/s, OCR: 3 req/s, General: 30 req/s
```

- [ ] `/health` 엔드포인트 `{"status": "ok"}` 응답
- [ ] Swagger UI 접근 가능 (`/api/docs`)
- [ ] 회원가입/로그인 API 정상 응답
- [ ] 응답 헤더에 `X-Request-ID` 포함 확인
- [ ] HTTPS 정상 동작 (HTTP→HTTPS 리다이렉트 확인)
- [ ] 보안 헤더 확인 (HSTS, X-Content-Type-Options, X-Frame-Options)
- [ ] Sentry 대시보드에서 이벤트 수신 확인
- [ ] certbot 자동 갱신 컨테이너 실행 확인 (`docker compose ps certbot`)

## 4. 롤백 기준

아래 중 하나라도 해당하면 즉시 롤백 → `docs/ROLLBACK_RUNBOOK.md` 참조

- 배포 후 5xx 에러율 > 5% (5분 기준)
- `/health` 또는 `/api/docs` 접근 불가
- OCR/가이드 작업 생성 API `202` 미반환
- DB 마이그레이션 실패

## 5. 운영 설정 파일 참조

| 파일 | 용도 |
|---|---|
| `docker-compose.prod.yml` | 프로덕션 서비스 정의 |
| `nginx/prod_https.conf` | HTTPS 리버스 프록시 + rate limiting |
| `nginx/prod_http.conf` | HTTP 전용 (HTTPS 전환 전) |
| `envs/example.prod.env` | 환경변수 템플릿 |
| `scripts/deployment.sh` | 이미지 빌드/푸시/배포 자동화 |
| `scripts/certbot.sh` | SSL 인증서 발급 |
