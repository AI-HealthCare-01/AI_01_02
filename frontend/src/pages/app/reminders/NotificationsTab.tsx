import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  Circle,
  MoonStar,
  Pill,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { notificationApi, type ApiNotification, type NotificationType } from "@/lib/api";
import { useNotification } from "@/lib/NotificationContext";

type FilterType = "all" | "unread";

type NotificationTone = {
  icon: ReactNode;
  iconWrapClass: string;
  titleClass: string;
  summaryClass: string;
  unreadCardClass: string;
};

const COLLAPSED_VISIBLE_COUNT = 3;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ACTION_HINT_PATTERN = /하세요|해 주세요|권장|상담|확인|예약|유지|줄이|피하|우선|시작|복용|관리|점검|받아/;
const ONE_LINE_CLAMP_STYLE = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 1,
  overflow: "hidden",
};

function isWithinOneWeek(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() <= ONE_WEEK_MS;
}

function formatNotificationTime(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractHealthState(message: string, fallback: string) {
  const normalized = normalizeText(message);
  if (/수면 부족|잦은 각성|졸림|피로/.test(normalized)) return "수면 부족";
  if (/영양|체중|식사/.test(normalized)) return "영양 상태 주의";
  if (/알레르기|발진|호흡곤란/.test(normalized)) return "알레르기 위험";
  if (/음주/.test(normalized)) return "음주 주의";
  if (/흡연/.test(normalized)) return "흡연 주의";
  return fallback;
}

function deriveStatusAction(notification: ApiNotification) {
  const sentences = splitSentences(notification.message);
  const fallbackAction = sentences[1] ?? sentences[0] ?? notification.title;
  const action = sentences.find((sentence, index) => index > 0 && ACTION_HINT_PATTERN.test(sentence))
    ?? fallbackAction;

  let state = notification.title;
  if (notification.type === "MEDICATION_DDAY") {
    state = "약 소진 임박";
  } else if (notification.type === "GUIDE_READY" || notification.type === "REPORT_READY") {
    state = "가이드 업데이트";
  } else if (notification.type === "HEALTH_ALERT") {
    state = extractHealthState(notification.message, notification.title);
  }

  return {
    state,
    action: normalizeText(action),
    summary: `${state} · - 행동: ${normalizeText(action)}`,
  };
}

function getNotificationTone(notification: ApiNotification): NotificationTone {
  const combinedText = `${notification.title} ${notification.message}`;

  if (/수면|취침|잠|각성|졸림/.test(combinedText)) {
    return {
      icon: <MoonStar className="w-5 h-5 text-amber-600" />,
      iconWrapClass: "bg-amber-50 ring-1 ring-amber-100",
      titleClass: "text-amber-900",
      summaryClass: "text-amber-800",
      unreadCardClass: "bg-amber-50/70 border-amber-200 hover:border-amber-300",
    };
  }

  if (notification.type === "MEDICATION_DDAY") {
    return {
      icon: <Pill className="w-5 h-5 text-green-600" />,
      iconWrapClass: "bg-green-50 ring-1 ring-green-100",
      titleClass: "text-green-900",
      summaryClass: "text-green-800",
      unreadCardClass: "bg-green-50/70 border-green-200 hover:border-green-300",
    };
  }

  if (notification.type === "GUIDE_READY" || notification.type === "REPORT_READY" || notification.type === "SYSTEM") {
    return {
      icon: <Sparkles className="w-5 h-5 text-blue-600" />,
      iconWrapClass: "bg-blue-50 ring-1 ring-blue-100",
      titleClass: "text-blue-900",
      summaryClass: "text-blue-800",
      unreadCardClass: "bg-blue-50/70 border-blue-200 hover:border-blue-300",
    };
  }

  return {
    icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
    iconWrapClass: "bg-red-50 ring-1 ring-red-100",
    titleClass: "text-red-900",
    summaryClass: "text-red-800",
    unreadCardClass: "bg-red-50/70 border-red-200 hover:border-red-300",
  };
}

export default function NotificationsTab() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAllInAllTab, setShowAllInAllTab] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { refresh: refreshBadge } = useNotification();

  async function load() {
    try {
      const r = await notificationApi.list({ limit: 50 });
      setNotifications(r.items);
    } catch {
      toast.error("알림을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function markRead(id: string) {
    try {
      const updated = await notificationApi.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
      refreshBadge();
    } catch {
      toast.error("읽음 처리에 실패했습니다.");
    }
  }

  async function markAllRead() {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      refreshBadge();
      toast.success("모든 알림을 읽음 처리했습니다.");
    } catch {
      toast.error("전체 읽음 처리에 실패했습니다.");
    }
  }

  async function deleteRead() {
    try {
      const { updated_count } = await notificationApi.deleteRead();
      setNotifications((prev) => prev.filter((n) => !n.is_read));
      setExpandedId(null);
      toast.success(updated_count > 0 ? "읽은 알림을 삭제했습니다." : "삭제할 읽은 알림이 없습니다.");
    } catch {
      toast.error("읽은 알림 삭제에 실패했습니다.");
    }
  }

  function handleNotificationClick(notification: ApiNotification) {
    if (!notification.is_read) {
      void markRead(notification.id);
    }
    setExpandedId((prev) => (prev === notification.id ? null : notification.id));
  }

  const recentNotifications = notifications.filter((n) => isWithinOneWeek(n.created_at));
  const unread = recentNotifications.filter((n) => !n.is_read);
  const read = recentNotifications.filter((n) => n.is_read);
  const filtered = filter === "unread" ? unread : recentNotifications;
  const displayed = filter === "all" && !showAllInAllTab
    ? filtered.slice(0, COLLAPSED_VISIBLE_COUNT)
    : filtered;
  const canToggleAllFold = filter === "all" && recentNotifications.length > COLLAPSED_VISIBLE_COUNT;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setFilter("all");
              setShowAllInAllTab(false);
            }}
            className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-200 ${
              filter === "all"
                ? "gradient-primary border-transparent text-white shadow-sm"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-200 ${
              filter === "unread"
                ? "gradient-primary border-transparent text-white shadow-sm"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            읽지 않은 알림 {unread.length}개
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={deleteRead}
            disabled={read.length === 0}
            className="min-h-11 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            읽은 알림 삭제
          </button>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unread.length === 0}
            className="min-h-11 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            모두 읽음
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          <Bell className="mx-auto mb-3 h-10 w-10 text-gray-200" />
          <p>{filter === "unread" ? "읽지 않은 알림이 없습니다." : "알림이 없습니다."}</p>
        </div>
      ) : (
        <div>
          <div className="space-y-3">
            {displayed.map((notification) => {
              const tone = getNotificationTone(notification);
              const content = deriveStatusAction(notification);
              const isExpanded = expandedId === notification.id;

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full rounded-2xl border px-4 py-3.5 text-left shadow-sm transition-all duration-200 ${
                    notification.is_read
                      ? "border-gray-200 bg-white/80 opacity-65 hover:opacity-90"
                      : tone.unreadCardClass
                  } ${isExpanded ? "max-h-none" : "max-h-[96px] overflow-hidden"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone.iconWrapClass}`}>
                      {tone.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-bold ${tone.titleClass}`}>
                            {notification.title}
                          </p>
                          <p className={`mt-1 text-sm ${tone.summaryClass}`} style={ONE_LINE_CLAMP_STYLE}>
                            {content.summary}
                          </p>
                        </div>
                        <div className="shrink-0 pt-0.5">
                          {notification.is_read ? (
                            <Check className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Circle className="h-4 w-4 fill-current text-green-500" />
                          )}
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
                          <p className={`text-sm font-bold ${tone.titleClass}`}>
                            상태: {content.state}
                          </p>
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold text-gray-800">- 행동:</span> {content.action}
                          </p>
                          <p className="text-xs leading-relaxed text-gray-500">
                            {notification.message}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {formatNotificationTime(notification.created_at)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {canToggleAllFold && (
            <button
              type="button"
              onClick={() => setShowAllInAllTab((prev) => !prev)}
              className="mt-3 min-h-11 text-sm font-medium text-green-700 transition-colors hover:text-green-800"
            >
              {showAllInAllTab ? "접기" : `전체 알림 보기 (${recentNotifications.length}개)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
