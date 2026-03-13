from enum import StrEnum

from starlette import status


class ErrorCode(StrEnum):
    # 인증/인가
    AUTH_INVALID_TOKEN = "AUTH_INVALID_TOKEN"
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"
    AUTH_FORBIDDEN = "AUTH_FORBIDDEN"
    AUTH_ACCOUNT_INACTIVE = "AUTH_ACCOUNT_INACTIVE"
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"

    # 입력 검증
    VALIDATION_ERROR = "VALIDATION_ERROR"
    FILE_INVALID_TYPE = "FILE_INVALID_TYPE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"

    # 리소스
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    STATE_CONFLICT = "STATE_CONFLICT"
    DUPLICATE_EMAIL = "DUPLICATE_EMAIL"
    DUPLICATE_PHONE = "DUPLICATE_PHONE"

    # OCR
    OCR_LOW_CONFIDENCE = "OCR_LOW_CONFIDENCE"
    OCR_QUEUE_UNAVAILABLE = "OCR_QUEUE_UNAVAILABLE"

    # 외부 서비스
    EXTERNAL_SERVICE_TIMEOUT = "EXTERNAL_SERVICE_TIMEOUT"
    QUEUE_UNAVAILABLE = "QUEUE_UNAVAILABLE"

    # 서버
    INTERNAL_ERROR = "INTERNAL_ERROR"
    RATE_LIMITED = "RATE_LIMITED"


# (http_status, user_message, action_hint, retryable)
_ERROR_META: dict[ErrorCode, tuple[int, str, str | None, bool]] = {
    ErrorCode.AUTH_INVALID_TOKEN: (
        status.HTTP_401_UNAUTHORIZED,
        "인증 정보가 유효하지 않습니다. 다시 로그인해주세요.",
        "로그인 페이지로 이동",
        False,
    ),
    ErrorCode.AUTH_TOKEN_EXPIRED: (
        status.HTTP_401_UNAUTHORIZED,
        "세션이 만료되었습니다. 다시 로그인해주세요.",
        "로그인 페이지로 이동",
        False,
    ),
    ErrorCode.AUTH_FORBIDDEN: (
        status.HTTP_403_FORBIDDEN,
        "접근 권한이 없습니다.",
        None,
        False,
    ),
    ErrorCode.AUTH_ACCOUNT_INACTIVE: (
        status.HTTP_423_LOCKED,
        "비활성화된 계정입니다. 고객센터에 문의해주세요.",
        None,
        False,
    ),
    ErrorCode.AUTH_INVALID_CREDENTIALS: (
        status.HTTP_401_UNAUTHORIZED,
        "이메일 또는 비밀번호가 올바르지 않습니다.",
        "입력 정보를 확인 후 다시 시도해주세요.",
        False,
    ),
    ErrorCode.VALIDATION_ERROR: (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "입력값을 확인해주세요.",
        "입력 항목 수정 후 다시 시도",
        False,
    ),
    ErrorCode.FILE_INVALID_TYPE: (
        status.HTTP_400_BAD_REQUEST,
        "지원하지 않는 파일 형식입니다. (JPG, JPEG, PNG, PDF만 허용)",
        "다른 파일을 선택해주세요.",
        False,
    ),
    ErrorCode.FILE_TOO_LARGE: (
        status.HTTP_413_CONTENT_TOO_LARGE,
        "파일 크기가 제한을 초과했습니다.",
        "파일 크기를 줄인 후 다시 시도해주세요.",
        False,
    ),
    ErrorCode.RESOURCE_NOT_FOUND: (
        status.HTTP_404_NOT_FOUND,
        "요청한 정보를 찾을 수 없습니다.",
        None,
        False,
    ),
    ErrorCode.STATE_CONFLICT: (
        status.HTTP_409_CONFLICT,
        "현재 상태에서는 해당 작업을 수행할 수 없습니다.",
        "작업 상태를 확인 후 다시 시도해주세요.",
        True,
    ),
    ErrorCode.DUPLICATE_EMAIL: (
        status.HTTP_409_CONFLICT,
        "이미 사용 중인 이메일입니다.",
        "다른 이메일을 입력해주세요.",
        False,
    ),
    ErrorCode.DUPLICATE_PHONE: (
        status.HTTP_409_CONFLICT,
        "이미 사용 중인 휴대폰 번호입니다.",
        "다른 번호를 입력해주세요.",
        False,
    ),
    ErrorCode.OCR_LOW_CONFIDENCE: (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "문서 인식 품질이 낮습니다. 재촬영하거나 직접 수정해주세요.",
        "재촬영 또는 직접 수정",
        True,
    ),
    ErrorCode.OCR_QUEUE_UNAVAILABLE: (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "OCR 처리 서비스가 일시적으로 불가합니다. 잠시 후 다시 시도해주세요.",
        "잠시 후 재시도",
        True,
    ),
    ErrorCode.EXTERNAL_SERVICE_TIMEOUT: (
        status.HTTP_504_GATEWAY_TIMEOUT,
        "외부 서비스 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.",
        "잠시 후 재시도",
        True,
    ),
    ErrorCode.QUEUE_UNAVAILABLE: (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "서비스가 일시적으로 불가합니다. 잠시 후 다시 시도해주세요.",
        "잠시 후 재시도",
        True,
    ),
    ErrorCode.INTERNAL_ERROR: (
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        "잠시 후 재시도",
        True,
    ),
    ErrorCode.RATE_LIMITED: (
        status.HTTP_429_TOO_MANY_REQUESTS,
        "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        "잠시 후 재시도",
        True,
    ),
}


class AppException(Exception):  # noqa: N818
    """도메인 에러 코드 기반 표준 예외."""

    def __init__(
        self, code: ErrorCode, *, developer_message: str | None = None, action_hint: str | None = None
    ) -> None:
        meta = _ERROR_META[code]
        self.code = code
        self.http_status: int = meta[0]
        self.user_message: str = meta[1]
        self.action_hint: str | None = action_hint if action_hint is not None else meta[2]
        self.retryable: bool = meta[3]
        self.developer_message = developer_message
        super().__init__(developer_message or self.user_message)
