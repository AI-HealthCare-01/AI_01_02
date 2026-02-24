# ADHD Care Web App Design

Figma 와이어프레임 기반 React 코드입니다.  
프로젝트 기준 문서(`docs/REQUIREMENTS_DEFINITION.md`, `docs/API_SPECIFICATION.md`, `docs/TEAM_DEVELOPMENT_GUIDELINE.md`)와 정합성을 맞춰 아래 4대 기능 중심으로 구성했습니다.

1. LLM 기반 안내 가이드 생성
2. 실시간 챗봇
3. OCR 기반 의료정보 인식
4. 알림 기능

## 범위 정리

- 포함:
  - 회원가입/로그인
  - 건강 프로필 온보딩(구조화 입력)
  - OCR 업로드/처리/신뢰도 검토/수정 플로우
  - LLM 가이드 화면(`복약 안내/생활습관/주의사항`)
  - 실시간 챗봇 화면(세션/스트리밍/가드레일 표현)
  - 알림 센터(목록/미읽음/읽음 처리/리마인더/D-day)
- 제외:
  - 알약 이미지 분류 기반 복약 분석(알약 식별 카메라 기능)

## 주요 화면 경로

- `/login`
- `/signup`
- `/onboarding`
- `/` (대시보드)
- `/ocr-scan`
- `/ai-coach`
- `/chat`
- `/notifications`
- `/medications`
- `/records`

## 실행

```bash
npm i
npm run dev
```

> 현재 코드에는 API 연동 대신 목업 데이터/시뮬레이션 로직이 포함되어 있습니다.
