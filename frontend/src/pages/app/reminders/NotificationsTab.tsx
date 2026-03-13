import { useEffect, useState } from "react";
import { Bell, PlusCircle, Check, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { notificationApi, ApiNotification, NotificationType } from "@/lib/api";
import { useNotification } from "@/lib/NotificationContext";

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  SYSTEM: <PlusCircle className="w-5 h-5 text-gray-400" />,
  HEALTH_ALERT: <PlusCircle className="w-5 h-5 text-amber-400" />,
  REPORT_READY: <PlusCircle className="w-5 h-5 text-blue-400" />,
  GUIDE_READY: <PlusCircle className="w-5 h-5 text-green-500" />,
  MEDICATION_DDAY: <CalendarClock className="w-5 h-5 text-amber-500" />,
};

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

type FilterType = "all" | "unread";
const COLLAPSED_VISIBLE_COUNT = 3;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

export default function NotificationsTab() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAllInAllTab, setShowAllInAllTab] = useState(false);
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
      toast.success(updated_count > 0 ? "읽은 알림을 삭제했습니다." : "삭제할 읽은 알림이 없습니다.");
    } catch {
      toast.error("읽은 알림 삭제에 실패했습니다.");
    }
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
    <div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          {/* 필터 탭 */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setFilter("all");
                setShowAllInAllTab(false);
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                filter === "all"
                  ? "gradient-primary text-white border-transparent shadow-sm"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                filter === "unread"
                  ? "gradient-primary text-white border-transparent shadow-sm"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              읽지않은 알람 {unread.length}개
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={deleteRead}
              disabled={read.length === 0}
              className="py-2.5 px-4 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              읽은 알림 삭제
            </button>
            <button
              onClick={markAllRead}
              disabled={unread.length === 0}
              className="py-2.5 px-4 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              모두 읽음
            </button>
          </div>
        </div>

        {/* 알림 목록 */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p>{filter === "unread" ? "읽지 않은 알림이 없습니다." : "알림이 없습니다."}</p>
          </div>
        ) : (
          <div>
            <div className="space-y-2">
              {displayed.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`flex items-start gap-3 bg-white/80 rounded-xl px-4 py-3.5 shadow-sm transition-all duration-200 ${
                    n.is_read
                      ? "cursor-default"
                      : "hover:bg-gray-50 cursor-pointer"
                  }`}
                >
                  <div className="shrink-0">{TYPE_ICON[n.type]}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${n.is_read ? "text-gray-400" : "text-gray-800"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 whitespace-normal break-words leading-relaxed">
                      {n.message}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {formatNotificationTime(n.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {n.is_read ? (
                      <Check className="w-4 h-4 text-gray-300" />
                    ) : (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {canToggleAllFold && (
              <button
                type="button"
                onClick={() => setShowAllInAllTab((prev) => !prev)}
                className="mt-3 text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
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
