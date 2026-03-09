const BASE = "/api/v1";

export function getToken() {
  return localStorage.getItem("access_token");
}
export function setToken(token: string) {
  localStorage.setItem("access_token", token);
}
export function clearToken() {
  localStorage.removeItem("access_token");
}

let _refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/auth/token/refresh`, { credentials: "include" });
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

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const doFetch = (token: string | null) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });

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

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.code ?? err?.detail?.message ?? err?.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const doFetch = (token: string | null) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });

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

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.code ?? err?.detail?.message ?? err?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
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
  }) => request<{ detail: string }>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),

  login: (email: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
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
    return request<{ items: { id: string; role: string; content: string; created_at: string }[]; meta: { limit: number; offset: number; total: number } }>(`/chat/sessions/${sessionId}/messages${qs}`);
  },

  async *streamMessage(sessionId: string, message: string): AsyncGenerator<string> {
    const token = getToken();
    const res = await fetch(`${BASE}/chat/sessions/${sessionId}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.replace(/^data:\s*/, "");
        if (!data || data === "{}") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) yield parsed.content as string;
        } catch { }
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
  [key: string]: unknown; // Keep index signature if other arbitrary data can be present
}

export interface OcrJobResult {
  job_id: string;
  extracted_text: string;
  structured_data: OcrStructuredData;
  created_at: string;
  updated_at: string;
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
};

// ── Profile ───────────────────────────────────────────
export interface HealthProfileUpsertRequest {
  basic_info: {
    height_cm: number;
    weight_kg: number;
    drug_allergies: string[];
  };
  lifestyle_input: {
    exercise_hours: {
      low_intensity: number;
      moderate_intensity: number;
      high_intensity: number;
    };
    digital_usage: {
      pc_hours_per_day: number;
      smartphone_hours_per_day: number;
    };
    substance_usage: {
      caffeine_cups_per_day: number;
      smoking: number;
      alcohol_frequency_per_week: number;
    };
  };
  sleep_input: {
    bed_time?: string;
    wake_time?: string;
    sleep_latency_minutes?: number;
    night_awakenings_per_week?: number;
    daytime_sleepiness_score?: number;
  };
  nutrition_input: {
    appetite_score?: number;
    is_meal_regular?: boolean;
  };
}

export interface HealthProfile {
  id: string;
  basic_info: HealthProfileUpsertRequest["basic_info"];
  lifestyle_input: HealthProfileUpsertRequest["lifestyle_input"];
  sleep_input: HealthProfileUpsertRequest["sleep_input"];
  nutrition_input: HealthProfileUpsertRequest["nutrition_input"];
}

export const profileApi = {
  upsertHealth: (data: HealthProfileUpsertRequest) =>
    request<HealthProfile>("/profiles/health", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getHealth: () => request<HealthProfile>("/profiles/health"),
};

// ── Reminders ─────────────────────────────────────────
export interface Reminder {
  id: string;
  medication_name: string;
  dose: string | null;
  schedule_times: string[];
  start_date: string | null;
  end_date: string | null;
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
      enabled?: boolean;
    },
  ) => request<Reminder>(`/reminders/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: string) => request<void>(`/reminders/${id}`, { method: "DELETE" }),
};

// ── Notifications ─────────────────────────────────────
export type NotificationType = "SYSTEM" | "HEALTH_ALERT" | "REPORT_READY" | "GUIDE_READY";

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
};
