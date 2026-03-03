# 배포 체크리스트 (REQ-106)

배포 마감: 2026-03-13  
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
- [ ] `SECRET_KEY` 운영용 값으로 교체
- [ ] `COOKIE_DOMAIN` 실제 도메인으로 교체
- [ ] `DB_PASSWORD`, `DB_ROOT_PASSWORD` 운영용 값으로 교체

### 이미지 빌드 & 푸시
- [ ] `scripts/deployment.sh` 실행 → FastAPI 이미지 빌드/푸시
- [ ] `scripts/deployment.sh` 실행 → AI Worker 이미지 빌드/푸시
- [ ] Docker Hub에서 이미지 태그 확인

## 2. 최초 배포 (신규 서버)

```bash
# 1. SSL 인증서 발급 (도메인 연결 후)
./scripts/certbot.sh

# 2. 배포 실행
./scripts/deployment.sh
```

## 3. 배포 후 스모크 테스트

```bash
# 헬스체크
curl -f https://<도메인>/api/docs

# 인증 API
curl -X POST https://<도메인>/api/v1/auth/signup ...

# X-Request-ID 헤더 확인 (REQ-105)
curl -v https://<도메인>/api/docs 2>&1 | grep -i x-request-id
```

- [ ] Swagger UI 접근 가능 (`/api/docs`)
- [ ] 회원가입/로그인 API 정상 응답
- [ ] 응답 헤더에 `X-Request-ID` 포함 확인
- [ ] Sentry 대시보드에서 이벤트 수신 확인

## 4. 롤백 기준

아래 중 하나라도 해당하면 즉시 롤백 → `docs/ROLLBACK_RUNBOOK.md` 참조

- 배포 후 5xx 에러율 > 5% (5분 기준)
- `/api/docs` 접근 불가
- OCR/가이드 작업 생성 API `202` 미반환
- DB 마이그레이션 실패
