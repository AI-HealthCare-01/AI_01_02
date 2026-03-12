interface ErrorMeta {
  message: string;
  action?: string;
}

const ERROR_MAP: Record<string, ErrorMeta> = {
  VALIDATION_ERROR:          { message: "입력 항목을 확인해주세요.", action: "입력 항목 수정 후 다시 시도해주세요." },
  FILE_INVALID_TYPE:         { message: "지원하지 않는 파일 형식입니다.", action: "PNG, JPG, PDF 파일을 선택해주세요." },
  FILE_TOO_LARGE:            { message: "파일 크기가 너무 큽니다.", action: "파일 크기를 줄인 후 다시 시도해주세요." },
  AUTH_INVALID_TOKEN:        { message: "인증에 실패했습니다. 다시 로그인해주세요." },
  AUTH_INVALID_CREDENTIALS:  { message: "이메일 또는 비밀번호가 올바르지 않습니다.", action: "입력 정보를 확인 후 다시 시도해주세요." },
  AUTH_TOKEN_EXPIRED:        { message: "로그인이 만료되었습니다. 다시 로그인해주세요." },
  AUTH_FORBIDDEN:            { message: "접근 권한이 없습니다." },
  AUTH_ACCOUNT_INACTIVE:     { message: "비활성화된 계정입니다.", action: "고객센터에 문의해주세요." },
  RESOURCE_NOT_FOUND:        { message: "요청한 정보를 찾을 수 없습니다." },
  DUPLICATE_EMAIL:           { message: "이미 사용 중인 이메일입니다.", action: "다른 이메일을 입력해주세요." },
  DUPLICATE_PHONE:           { message: "이미 사용 중인 전화번호입니다.", action: "다른 번호를 입력해주세요." },
  STATE_CONFLICT:            { message: "현재 상태에서 처리할 수 없습니다.", action: "작업 상태를 확인 후 다시 시도해주세요." },
  OCR_LOW_CONFIDENCE:        { message: "사진 인식 품질이 낮습니다.", action: "더 선명한 사진으로 다시 촬영해주세요." },
  RATE_LIMITED:              { message: "요청이 너무 많습니다.", action: "잠시 후 다시 시도해주세요." },
  INTERNAL_ERROR:            { message: "서버 오류가 발생했습니다.", action: "잠시 후 다시 시도해주세요." },
  OCR_QUEUE_UNAVAILABLE:     { message: "OCR 처리 서비스가 일시적으로 불가합니다.", action: "잠시 후 다시 시도해주세요." },
  QUEUE_UNAVAILABLE:         { message: "처리 서비스가 일시적으로 불가합니다.", action: "잠시 후 다시 시도해주세요." },
  EXTERNAL_SERVICE_TIMEOUT:  { message: "외부 서비스 응답이 지연되고 있습니다.", action: "잠시 후 다시 시도해주세요." },
};

export function toUserMessage(error: unknown): string {
  if (!(error instanceof Error)) return "알 수 없는 오류가 발생했습니다.";

  const raw = error.message;

  // Try to extract error code from message (format: "CODE" or starts with known code)
  for (const code of Object.keys(ERROR_MAP)) {
    if (raw.includes(code)) {
      const meta = ERROR_MAP[code];
      return meta.action ? `${meta.message} ${meta.action}` : meta.message;
    }
  }

  // HTTP status fallback
  if (raw.includes("HTTP 401")) return ERROR_MAP.AUTH_INVALID_TOKEN.message;
  if (raw.includes("HTTP 403")) return ERROR_MAP.AUTH_FORBIDDEN.message;
  if (raw.includes("HTTP 404")) return ERROR_MAP.RESOURCE_NOT_FOUND.message;
  if (raw.includes("HTTP 409")) return ERROR_MAP.STATE_CONFLICT.message;
  if (raw.includes("HTTP 429")) return ERROR_MAP.RATE_LIMITED.message;
  if (raw.includes("HTTP 5"))   return ERROR_MAP.INTERNAL_ERROR.message;

  return raw || "오류가 발생했습니다.";
}
