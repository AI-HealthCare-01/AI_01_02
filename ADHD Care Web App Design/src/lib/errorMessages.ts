// REQ-111: 백엔드 에러 코드 → 사용자 안내 메시지 매핑 테이블
const ERROR_MESSAGE_MAP: Record<string, string> = {
  AUTH_INVALID_TOKEN: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  AUTH_MISSING_TOKEN: "로그인이 필요합니다.",
  AUTH_INVALID_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않습니다.",
  AUTH_EMAIL_DUPLICATE: "이미 사용 중인 이메일입니다.",
  AUTH_PHONE_DUPLICATE: "이미 사용 중인 전화번호입니다.",
  AUTH_USER_INACTIVE: "비활성화된 계정입니다. 고객센터에 문의해 주세요.",
  RESOURCE_NOT_FOUND: "요청한 정보를 찾을 수 없습니다.",
  PERMISSION_DENIED: "접근 권한이 없습니다.",
  VALIDATION_ERROR: "입력값을 확인해 주세요.",
  OCR_JOB_FAILED: "처방전 인식에 실패했습니다. 다시 촬영해 주세요.",
  OCR_LOW_CONFIDENCE: "이미지 품질이 낮습니다. 더 선명하게 촬영해 주세요.",
  OCR_UNSUPPORTED_FILE: "지원하지 않는 파일 형식입니다. (JPG, PNG, PDF만 가능)",
  OCR_FILE_TOO_LARGE: "파일 크기가 너무 큽니다.",
  GUIDE_JOB_FAILED: "AI 가이드 생성에 실패했습니다. 다시 시도해 주세요.",
  LLM_TIMEOUT: "AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
  EXTERNAL_API_ERROR: "외부 서비스 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  RATE_LIMIT_EXCEEDED: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
};

/**
 * 백엔드 에러 메시지 또는 에러 코드를 사용자 친화적 한국어 메시지로 변환
 */
export function toUserMessage(error: unknown): string {
  if (!(error instanceof Error)) return "알 수 없는 오류가 발생했습니다.";
  const raw = error.message;

  // 에러 코드가 직접 포함된 경우
  for (const [code, msg] of Object.entries(ERROR_MESSAGE_MAP)) {
    if (raw.includes(code)) return msg;
  }

  // HTTP 상태 코드 기반 fallback
  if (raw.includes("HTTP 401")) return ERROR_MESSAGE_MAP.AUTH_INVALID_TOKEN;
  if (raw.includes("HTTP 403")) return ERROR_MESSAGE_MAP.PERMISSION_DENIED;
  if (raw.includes("HTTP 404")) return ERROR_MESSAGE_MAP.RESOURCE_NOT_FOUND;
  if (raw.includes("HTTP 413")) return ERROR_MESSAGE_MAP.OCR_FILE_TOO_LARGE;
  if (raw.includes("HTTP 429")) return ERROR_MESSAGE_MAP.RATE_LIMIT_EXCEEDED;
  if (raw.includes("HTTP 5")) return "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

  // 원문 메시지가 한국어이면 그대로 사용
  return raw || "오류가 발생했습니다. 다시 시도해 주세요.";
}
