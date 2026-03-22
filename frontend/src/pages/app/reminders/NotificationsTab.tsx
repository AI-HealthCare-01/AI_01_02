import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CheckCircle2,
  Circle,
  MoonStar,
  Pill,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { notificationApi, ApiNotification, scheduleApi } from "@/lib/api";
import { useNotification } from "@/lib/NotificationContext";

type FilterType = "all" | "unread";
type NotificationVisualCategory = "sleep" | "medication" | "guide" | "risk";

interface NotificationVisualTone {
  icon: LucideIcon;
  iconBadgeClass: string;
  unreadCardClass: string;
  stateTextClass: string;
  unreadStatusIconClass: string;
}

const COLLAPSED_VISIBLE_COUNT = 3;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const VISUAL_TONE_MAP: Record<NotificationVisualCategory, NotificationVisualTone> = {
  sleep: {
    icon: MoonStar,
    iconBadgeClass: "border border-amber-100 bg-amber-50 text-amber-600",
    unreadCardClass: "border border-amber-100 bg-amber-50/60",
    stateTextClass: "text-amber-700",
    unreadStatusIconClass: "text-amber-500",
  },
  medication: {
    icon: Pill,
    iconBadgeClass: "border border-green-100 bg-green-50 text-green-600",
    unreadCardClass: "border border-green-100 bg-green-50/60",
    stateTextClass: "text-green-700",
    unreadStatusIconClass: "text-green-500",
  },
  guide: {
    icon: Sparkles,
    iconBadgeClass: "border border-blue-100 bg-blue-50 text-blue-600",
    unreadCardClass: "border border-blue-100 bg-blue-50/55",
    stateTextClass: "text-blue-700",
    unreadStatusIconClass: "text-blue-500",
  },
  risk: {
    icon: TriangleAlert,
    iconBadgeClass: "border border-red-100 bg-red-50 text-red-600",
    unreadCardClass: "border border-red-100 bg-red-50/60",
    stateTextClass: "text-red-700",
    unreadStatusIconClass: "text-red-500",
  },
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

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getActionTaken(payload: Record<string, unknown>) {
  const value = payload?.action_taken;
  return value === "DONE" || value === "SKIPPED" ? value : null;
}

function getNotificationCategory(notification: ApiNotification): NotificationVisualCategory {
  const event = String(notification.payload?.event ?? "");
  const alertType = String(notification.payload?.alert_type ?? "").toUpperCase();
  const content = `${notification.title} ${notification.message}`;

  if (content.includes("수면") || alertType.includes("SLEEP")) return "sleep";
  if (
    event === "medication_reminder"
    || event === "medication_confirmation_required"
    || notification.type === "MEDICATION_DDAY"
    || content.includes("복약")
    || content.includes("복용")
    || content.includes("약 소진")
  ) {
    return "medication";
  }
  if (
    notification.type === "GUIDE_READY"
    || notification.type === "REPORT_READY"
    || content.includes("가이드")
    || content.includes("리포트")
    || content.includes("보고서")
  ) {
    return "guide";
  }
  return notification.type === "HEALTH_ALERT" ? "risk" : "guide";
}

function getNotificationStateText(notification: ApiNotification, category: NotificationVisualCategory): string {
  const event = String(notification.payload?.event ?? "");

  if (category === "sleep") return notification.title.includes("수면") ? notification.title : "수면 주의";
  if (event === "medication_reminder") return "복약 예정";
  if (event === "medication_confirmation_required") return "복약 기록 필요";
  if (notification.type === "MEDICATION_DDAY") return "약 소진 임박";
  if (notification.type === "GUIDE_READY") return "가이드 확인";
  if (notification.type === "REPORT_READY") return "리포트 확인";
  if (notification.type === "HEALTH_ALERT") return notification.title || "위험 신호";
  return notification.title || "알림";
}

function getNotificationSummary(notification: ApiNotification): string {
  const event = String(notification.payload?.event ?? "");
  const normalized = normalizeText(notification.message);
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);

  if (event === "medication_confirmation_required" && sentences.length > 1) {
    return sentences[1];
  }

  return sentences[0] ?? normalized;
}

function NotificationCard({
  notification,
  expanded,
  onToggleExpanded,
  onMedicationAction,
}: {
  notification: ApiNotification;
  expanded: boolean;
  onToggleExpanded: (notification: ApiNotification) => void;
  onMedicationAction: (notification: ApiNotification, status: "DONE" | "SKIPPED") => void;
}) {
  const category = getNotificationCategory(notification);
  const tone = VISUAL_TONE_MAP[category];
  const Icon = tone.icon;
  const statusText = getNotificationStateText(notification, category);
  const summary = getNotificationSummary(notification);
  const actionTaken = getActionTaken(notification.payload);
  const timestamp = formatNotificationTime(notification.created_at);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void onToggleExpanded(notification);
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => void onToggleExpanded(notification)}
      onKeyDown={handleKeyDown}
      className={`overflow-hidden rounded-[24px] px-4 py-4 shadow-sm transition-all duration-200 md:px-5 ${
        expanded ? "max-h-none" : "max-h-[108px]"
      } ${
        notification.is_read
          ? "border border-gray-200 bg-white opacity-65"
          : `${tone.unreadCardClass} cursor-pointer hover:shadow-md`
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.iconBadgeClass}`}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${notification.is_read ? "text-gray-500" : "text-gray-800"}`}>
            {notification.title}
          </p>
          <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-gray-500">
            <span className={`font-semibold ${tone.stateTextClass}`}>{statusText}</span>
            <span className="mx-1.5 text-gray-300">•</span>
            <span>{summary}</span>
          </p>
        </div>

        <div className="shrink-0 pt-0.5">
          {notification.is_read ? (
            <CheckCircle2 className="h-5 w-5 text-gray-300" />
          ) : (
            <Circle className={`h-5 w-5 fill-current ${tone.unreadStatusIconClass}`} />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className={`text-sm font-semibold ${tone.stateTextClass}`}>{statusText}</p>
          <p className="mt-2 break-words text-sm leading-6 text-gray-600">{notification.message}</p>

          {notification.payload?.event === "medication_confirmation_required" && !actionTaken && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onMedicationAction(notification, "DONE");
                }}
                className="rounded-lg bg-green-500 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-green-600"
              >
                복약 확인
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onMedicationAction(notification, "SKIPPED");
                }}
                className="rounded-lg bg-amber-100 px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-200"
              >
                건너뜀
              </button>
            </div>
          )}

          {notification.payload?.event === "medication_confirmation_required" && actionTaken && (
            <p className="mt-3 text-[11px] font-medium text-gray-400">
              {actionTaken === "DONE" ? "복약 완료로 기록됨" : "건너뜀으로 기록됨"}
            </p>
          )}

          {timestamp ? <p className="mt-3 text-[11px] text-gray-400">{timestamp}</p> : null}
        </div>
      )}
    </article>
  );
}

export default function NotificationsTab() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAllInAllTab, setShowAllInAllTab] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const { refresh: refreshBadge } = useNotification();

  async function load() {
    try {
      const response = await notificationApi.list({ limit: 50 });
      setNotifications(response.items);
    } catch {
      toast.error("알림을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function markRead(id: string) {
    try {
      const updated = await notificationApi.markAsRead(id);
      setNotifications((prev) => prev.map((item) => (item.id === id ? updated : item)));
      refreshBadge();
    } catch {
      toast.error("읽음 처리에 실패했습니다.");
    }
  }

  async function markAllRead() {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      refreshBadge();
      toast.success("모든 알림을 읽음 처리했습니다.");
    } catch {
      toast.error("전체 읽음 처리에 실패했습니다.");
    }
  }

  async function deleteRead() {
    try {
      const { updated_count } = await notificationApi.deleteRead();
      setNotifications((prev) => {
        const next = prev.filter((item) => !item.is_read);
        const survivingIds = new Set(next.map((item) => item.id));
        setExpandedIds((ids) => ids.filter((id) => survivingIds.has(id)));
        return next;
      });
      toast.success(updated_count > 0 ? "읽은 알림을 삭제했습니다." : "삭제할 읽은 알림이 없습니다.");
    } catch {
      toast.error("읽은 알림 삭제에 실패했습니다.");
    }
  }

  async function handleMedicationConfirmationAction(
    notification: ApiNotification,
    status: "DONE" | "SKIPPED",
  ) {
    const scheduleItemId = String(notification.payload?.schedule_item_id ?? "");
    if (!scheduleItemId) {
      toast.error("복약 일정 정보를 찾지 못했습니다.");
      return;
    }

    try {
      await scheduleApi.updateStatus(scheduleItemId, status);
    } catch {
      toast.error("복약 상태 업데이트에 실패했습니다.");
      return;
    }

    try {
      const updatedNotification = notification.is_read
        ? notification
        : await notificationApi.markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? {
                ...updatedNotification,
                is_read: true,
                payload: {
                  ...updatedNotification.payload,
                  action_taken: status,
                },
              }
            : item,
        ),
      );
      refreshBadge();
    } catch {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? { ...item, payload: { ...item.payload, action_taken: status } }
            : item,
        ),
      );
    }
    toast.success(status === "DONE" ? "복약 완료로 기록했어요." : "건너뜀으로 기록했어요.");
  }

  async function handleToggleExpanded(notification: ApiNotification) {
    if (!notification.is_read) {
      await markRead(notification.id);
    }

    setExpandedIds((prev) =>
      prev.includes(notification.id)
        ? prev.filter((id) => id !== notification.id)
        : [...prev, notification.id],
    );
  }

  const recentNotifications = notifications.filter((notification) => isWithinOneWeek(notification.created_at));
  const unread = recentNotifications.filter((notification) => !notification.is_read);
  const read = recentNotifications.filter((notification) => notification.is_read);
  const filtered = filter === "unread" ? unread : recentNotifications;
  const displayed = filter === "all" && !showAllInAllTab
    ? filtered.slice(0, COLLAPSED_VISIBLE_COUNT)
    : filtered;
  const canToggleAllFold = filter === "all" && recentNotifications.length > COLLAPSED_VISIBLE_COUNT;

  return (
    <div>
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setFilter("all");
                setShowAllInAllTab(false);
              }}
              className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                filter === "all"
                  ? "gradient-primary border-transparent text-white shadow-sm"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                filter === "unread"
                  ? "gradient-primary border-transparent text-white shadow-sm"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              읽지 않은 알림 {unread.length}개
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={deleteRead}
              disabled={read.length === 0}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              읽은 알림 삭제
            </button>
            <button
              onClick={markAllRead}
              disabled={unread.length === 0}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
              {displayed.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  expanded={expandedIds.includes(notification.id)}
                  onToggleExpanded={handleToggleExpanded}
                  onMedicationAction={(item, status) => {
                    void handleMedicationConfirmationAction(item, status);
                  }}
                />
              ))}
            </div>

            {canToggleAllFold && (
              <button
                type="button"
                onClick={() => setShowAllInAllTab((prev) => !prev)}
                className="mt-3 text-sm font-medium text-green-700 transition-colors hover:text-green-800"
              >
                {showAllInAllTab ? "접기" : `전체 알림 보기 (${recentNotifications.length}개)`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
