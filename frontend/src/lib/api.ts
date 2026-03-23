const BASE = "/api/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

export function getToken() {
  return localStorage.getItem("access_token");
}
export function setToken(token: string) {
  localStorage.setItem("access_token", token);
}
export function clearToken() {
  localStorage.removeItem("access_token");
}
export function clearAllUserData() {
  clearToken();
  const CACHE_PREFIXES = ["weekly_med_rate:"];
  const prefixed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && CACHE_PREFIXES.some((p) => key.startsWith(p))) {
      prefixed.push(key);
    }
  }
  prefixed.forEach((k) => localStorage.removeItem(k));
}

/** 다른 사용자 로그인 시 이전 사용자의 localStorage 데이터 정리 */
export function clearPreviousUserData(currentEmail: string) {
  const prev = localStorage.getItem("logly_last_user");
  if (prev && prev !== currentEmail) {
    const USER_KEYS = ["ocr_job_id", "guide_job_id", "logly_chat_sessions"];
    const USER_PREFIXES = ["daily_med_confirmed:"];
    USER_KEYS.forEach((k) => localStorage.removeItem(k));
    const prefixed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && USER_PREFIXES.some((p) => key.startsWith(p))) {
        prefixed.push(key);
      }
    }
    prefixed.forEach((k) => localStorage.removeItem(k));
  }
  localStorage.setItem("logly_last_user", currentEmail);
}

let _refreshPromise: Promise<string | null> | null = null;

const FIELD_LABELS: Record<string, string> = {
  name: "이름", email: "이메일", password: "비밀번호", phone_number: "전화번호",
  birth_date: "생년월일", gender: "성별",
};

function translateMsg(msg: string): string {
  if (msg.startsWith("Value error, ")) return msg.slice(13);
  const m = msg.match(/String should have at least (\d+) character/);
  if (m) return `최소 ${m[1]}자 이상 입력해주세요.`;
  const m2 = msg.match(/String should have at most (\d+) character/);
  if (m2) return `최대 ${m2[1]}자까지 입력 가능합니다.`;
  if (msg.includes("not a valid email")) return "올바른 이메일 형식이 아닙니다.";
  if (msg.includes("Input should be")) return "올바른 값을 선택해주세요.";
  if (msg.includes("Field required")) return "필수 입력 항목입니다.";
  return msg;
}

function extractErrorMessage(err: Record<string, unknown>, status: number): string {
  const detail = err?.detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail.map((d: { loc?: string[]; msg?: string }) => {
      const field = d.loc?.filter((l) => l !== "body").pop();
      const label = (field && FIELD_LABELS[field]) || field;
      const translated = translateMsg(d.msg ?? "");
      return label ? `${label}: ${translated}` : translated;
    }).filter(Boolean);
    if (messages.length > 0) return messages.join("\n");
  }
  const code = err?.code as string | undefined;
  const message = err?.message as string | undefined;
  if (code && message) return `${code} ${message}`;
  return message ?? code ?? `HTTP ${status}`;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/auth/token/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access_token) {
      setToken(data.access_token);
      return data.access_token as string;
    }
    return null;
  } catch {
    return null;
  }
}

async function withAuthRefresh(
  doFetch: (token: string | null) => Promise<Response>,
): Promise<Response> {
  let res = await doFetch(getToken());

  if (res.status === 401) {
    if (!_refreshPromise) {
      _refreshPromise = refreshAccessToken().finally(() => { _refreshPromise = null; });
    }
    const newToken = await _refreshPromise;
    if (newToken) {
      res = await doFetch(newToken);
    } else {
      clearToken();
      window.location.href = "/login";
      throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
    }
  }

  return res;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const doFetch = (token: string | null) =>
    fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });

  try {
    const res = await withAuthRefresh(doFetch);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(extractErrorMessage(err, res.status));
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestNoAuth<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(extractErrorMessage(err, res.status));
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

const UPLOAD_TIMEOUT_MS = 120_000;

async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  const doFetch = (token: string | null) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });

  try {
    const res = await withAuthRefresh(doFetch);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(extractErrorMessage(err, res.status));
    }
    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("업로드 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  signup: (body: {
    email: string;
    password: string;
    name: string;
    gender: "MALE" | "FEMALE";
    birth_date: string;
    phone_number: string;
  }) => requestNoAuth<{ detail: string }>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),

  login: (email: string, password: string) =>
    requestNoAuth<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: (): Promise<void> => {
    const token = getToken();
    return fetch(`${BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(() => {})
      .catch((err) => { console.warn("Logout server call failed:", err); });
  },
};

// ── Schedules ─────────────────────────────────────────
export interface ScheduleItem {
  item_id: string;
  category: string;
  title: string;
  scheduled_at: string;
  status: "PENDING" | "DONE" | "SKIPPED";
  completed_at: string | null;
}

export const scheduleApi = {
  getDaily: (date: string) =>
    request<{ date: string; items: ScheduleItem[] }>(`/schedules/daily?date=${date}`),

  updateStatus: (itemId: string, status: "PENDING" | "DONE" | "SKIPPED") =>
    request<ScheduleItem>(`/schedules/items/${itemId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// ── Chat ──────────────────────────────────────────────
export interface ChatSession {
  id: string;
  status: string;
  title: string | null;
  created_at: string;
}

export interface ChatReference {
  document_id: string;
  title: string;
  source: string;
  url?: string | null;
  score?: number | null;
}

export interface ChatMessageItem {
  id: string;
  role: string;
  content: string;
  created_at: string;
  references: ChatReference[];
}

export type ChatStreamChunk =
  | { type: "token"; content: string }
  | { type: "reference"; references: ChatReference[] };

export const chatApi = {
  createSession: (title?: string) =>
    request<ChatSession>("/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ title: title ?? null }),
    }),

  deleteSession: (sessionId: string) =>
    request<void>(`/chat/sessions/${sessionId}`, { method: "DELETE" }),

  getPromptOptions: () =>
    request<{ items: { id: string; label: string; category: string }[] }>("/chat/prompt-options"),

  getMessages: (sessionId: string, params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    if (params?.offset !== undefined) q.set("offset", String(params.offset));
    const qs = q.toString() ? `?${q}` : "";
    return request<{
      items: ChatMessageItem[];
      meta: { limit: number; offset: number; total: number };
    }>(`/chat/sessions/${sessionId}/messages${qs}`);
  },

  async *streamMessage(sessionId: string, message: string): AsyncGenerator<ChatStreamChunk> {
    const doFetch = (token: string | null) =>
      fetch(`${BASE}/chat/sessions/${sessionId}/stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message }),
      });
    const res = await withAuthRefresh(doFetch);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!res.body) throw new Error("스트리밍 응답을 받을 수 없습니다.");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let currentEvent = "message";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.replace(/^event:\s*/, "").trim();
          continue;
        }
        if (line === "") {
          currentEvent = "message";
          continue;
        }
        if (!line.startsWith("data:")) continue;
        const data = line.replace(/^data:\s*/, "");
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          if (currentEvent === "token" && parsed.content) {
            yield { type: "token", content: parsed.content as string };
          }
          if (currentEvent === "reference") {
            yield {
              type: "reference",
              references: (parsed.references ?? []) as ChatReference[],
            };
          }
        } catch { console.warn("Malformed SSE chunk skipped:", data); }
      }
    }
  },
};

// ── Users ─────────────────────────────────────────────
export interface UserInfo {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  birthday: string;
  gender: "MALE" | "FEMALE";
  created_at: string;
}

export const userApi = {
  me: () => request<UserInfo>("/users/me"),

  update: (data: Partial<Omit<UserInfo, "id" | "created_at">>) =>
    request<UserInfo>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),

  deleteAccount: () => request<void>("/users/me", { method: "DELETE" }),
};

// ── OCR ───────────────────────────────────────────────
export interface OcrMedication {
  drug_name: string;
  dose: number | null;
  frequency_per_day: number | null;
  dosage_per_once: number | null;
  intake_time: string | null;
  dispensed_date: string | null;
  total_days: number | null;
  confidence: number | null;
}

export type OcrStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "COMPLETED" | "FAILED";

export interface OcrJobStatusResponse {
  job_id: string;
  document_id: string;
  status: OcrStatus;
  retry_count: number;
  max_retries: number;
  failure_code: string | null;
  error_message: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface OcrStructuredData {
  needs_user_review?: boolean;
  extracted_medications?: OcrMedication[];
  medications?: OcrMedication[];
  [key: string]: unknown; // Keep index signature if other arbitrary data can be present
}

export interface OcrJobResult {
  job_id: string;
  extracted_text: string;
  structured_data: OcrStructuredData;
  created_at: string;
  updated_at: string;
}

export interface MedicationInfo {
  item_name: string | null;
  efficacy: string | null;
  usage: string | null;
  warnings: string | null;
  precautions: string | null;
  interactions: string | null;
  side_effects: string | null;
  storage: string | null;
  source: string | null;
}

export const ocrApi = {
  uploadDocument: (file: File, documentType = "PRESCRIPTION") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_type", documentType);
    return requestForm<{ id: string; file_name: string }>("/ocr/documents/upload", fd);
  },

  createJob: (documentId: string) =>
    request<{ job_id: string; status: OcrStatus }>("/ocr/jobs", {
      method: "POST",
      body: JSON.stringify({ document_id: documentId }),
    }),

  getJobStatus: (jobId: string) => request<OcrJobStatusResponse>(`/ocr/jobs/${jobId}`),

  getJobResult: (jobId: string) => request<OcrJobResult>(`/ocr/jobs/${jobId}/result`),

  confirmResult: (
    jobId: string,
    confirmed: boolean,
    correctedMedications: OcrMedication[],
    comment?: string,
  ) =>
    request<{ job_id: string; needs_user_review: boolean }>(`/ocr/jobs/${jobId}/confirm`, {
      method: "PATCH",
      body: JSON.stringify({ confirmed, corrected_medications: correctedMedications, comment }),
    }),
};

export const medicationApi = {
  getInfo: (name: string) =>
    request<MedicationInfo>(`/medications/info?name=${encodeURIComponent(name)}`),
};

// ── Guide ─────────────────────────────────────────────
export interface GuideSourceReference {
  title: string;
  source: string;
  url?: string;
}

export type GuideStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export interface GuideJobResult {
  job_id: string;
  medication_guidance: string;
  lifestyle_guidance: string;
  risk_level: string;
  safety_notice: string;
  source_references: GuideSourceReference[];
  adherence_rate_percent: number | null;
  structured_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const guideApi = {
  createJob: (ocrJobId: string) =>
    request<{ job_id: string; status: GuideStatus }>("/guides/jobs", {
      method: "POST",
      body: JSON.stringify({ ocr_job_id: ocrJobId }),
    }),

  getLatestJobStatus: () =>
    request<{ job_id: string; ocr_job_id: string; status: GuideStatus; error_message: string | null }>(
      "/guides/jobs/latest",
    ),

  getJobStatus: (jobId: string) =>
    request<{ job_id: string; status: GuideStatus; error_message: string | null }>(
      `/guides/jobs/${jobId}`,
    ),

  getJobResult: (jobId: string) => request<GuideJobResult>(`/guides/jobs/${jobId}/result`),

  refreshJob: (jobId: string, reason?: string) =>
    request<{ refreshed_job_id: string; status: GuideStatus }>(`/guides/jobs/${jobId}/refresh`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  submitFeedback: (jobId: string, data: { rating: number; is_helpful: boolean; comment?: string }) =>
    request<{ id: string; guide_job_id: string }>(`/guides/jobs/${jobId}/feedback`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Profile ───────────────────────────────────────────
export interface HealthProfileUpsertRequest {
  basic_info: {
    height_cm: number;
    weight_kg: number;
    drug_allergies: string[];
  };
  lifestyle: {
    exercise_frequency_per_week: number;
    pc_hours_per_day: number;
    smartphone_hours_per_day: number;
    caffeine_cups_per_day: number;
    smoking: number;
    alcohol_frequency_per_week: number;
  };
  sleep_input: {
    bed_time: string;
    wake_time: string;
    sleep_latency_minutes: number;
    night_awakenings_per_week: number;
    daytime_sleepiness: number;
  };
  nutrition_status: {
    appetite_level: number;
    meal_regular: boolean;
  };
  weekly_refresh_weekday?: number | null;
  weekly_refresh_time?: string | null;
  weekly_adherence_rate?: number | null;
}

export interface HealthProfile {
  user_id: string;
  basic_info: HealthProfileUpsertRequest["basic_info"];
  lifestyle: HealthProfileUpsertRequest["lifestyle"];
  sleep_input: HealthProfileUpsertRequest["sleep_input"];
  nutrition_status: HealthProfileUpsertRequest["nutrition_status"];
  computed: {
    bmi: number;
    sleep_time_hours: number;
    caffeine_mg: number;
    digital_time_hours: number;
  };
  weekly_refresh_weekday: number | null;
  weekly_refresh_time: string | null;
  weekly_adherence_rate: number | null;
  onboarding_completed_at: string | null;
  updated_at: string;
}

export const profileApi = {
  upsertHealth: (data: HealthProfileUpsertRequest) =>
    request<HealthProfile>("/users/me/health-profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getHealth: () => request<HealthProfile>("/users/me/health-profile"),
};

// ── Reminders ─────────────────────────────────────────
export interface Reminder {
  id: string;
  medication_name: string;
  dose: string | null;
  schedule_times: string[];
  start_date: string | null;
  end_date: string | null;
  dispensed_date: string | null;
  total_days: number | null;
  daily_intake_count: number | null;
  confirmed_intake_count: number;
  responded_intake_count: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DdayReminder {
  medication_name: string;
  remaining_days: number;
  estimated_depletion_date: string;
}

export const reminderApi = {
  list: (enabled?: boolean) => {
    const qs = enabled !== undefined ? `?enabled=${enabled}` : "";
    return request<{ items: Reminder[] }>(`/reminders${qs}`);
  },

  getDday: (days = 7) =>
    request<{ items: DdayReminder[] }>(`/reminders/medication-dday?days=${days}`),

  create: (data: {
    medication_name: string;
    dose?: string;
    schedule_times: string[];
    start_date?: string;
    end_date?: string;
    total_days?: number;
    daily_intake_count?: number;
    enabled?: boolean;
  }) => request<Reminder>("/reminders", { method: "POST", body: JSON.stringify(data) }),

  update: (
    id: string,
    data: {
      medication_name: string;
      dose?: string;
      schedule_times: string[];
      start_date?: string;
      end_date?: string;
      dispensed_date?: string;
      total_days?: number;
      enabled?: boolean;
    },
  ) => request<Reminder>(`/reminders/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: string) => request<void>(`/reminders/${id}`, { method: "DELETE" }),
};

// ── Notifications ─────────────────────────────────────
export type NotificationType = "SYSTEM" | "HEALTH_ALERT" | "REPORT_READY" | "GUIDE_READY" | "MEDICATION_DDAY";

export interface ApiNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export const notificationApi = {
  getUnreadCount: () =>
    request<{ unread_count: number }>("/notifications/unread-count"),

  list: (params?: { limit?: number; offset?: number; is_read?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    if (params?.offset !== undefined) q.set("offset", String(params.offset));
    if (params?.is_read !== undefined) q.set("is_read", String(params.is_read));
    const qs = q.toString() ? `?${q}` : "";
    return request<{ items: ApiNotification[]; unread_count: number }>(`/notifications${qs}`);
  },

  markAsRead: (id: string) =>
    request<ApiNotification>(`/notifications/${id}/read`, { method: "PATCH" }),

  markAllAsRead: () =>
    request<{ updated_count: number }>("/notifications/read-all", { method: "PATCH" }),

  deleteRead: () =>
    request<{ updated_count: number }>("/notifications/read", { method: "DELETE" }),
};

// ── Diaries ──────────────────────────────────────────
export interface DiaryResponse {
  date: string;
  content: string;
  updated_at: string;
}

export const diaryApi = {
  upsert: (date: string, content: string) =>
    request<DiaryResponse>(`/diaries/${date}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  getByDate: (date: string) => request<DiaryResponse>(`/diaries/${date}`),
};
