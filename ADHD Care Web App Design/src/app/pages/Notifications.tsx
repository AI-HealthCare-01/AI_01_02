import { useState, useEffect } from "react";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  Pill,
  AlertCircle,
  RefreshCw,
  Info,
  Loader2,
} from "lucide-react";
import { notificationApi, ApiNotification, NotificationType } from "../../lib/api";
import MedicalSafetyNotice from "../components/MedicalSafetyNotice";

type FilterType = "all" | "unread";
type FrontendType = "medication" | "refill" | "guide" | "system";

function toFrontendType(type: NotificationType): FrontendType {
  if (type === "HEALTH_ALERT") return "medication";
  if (type === "GUIDE_READY") return "guide";
  return "system";
}

function relativeTime(isoString: string): string {
  const now = Date.now();
  const diff = now - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return new Date(isoString).toLocaleDateString("ko-KR");
}

const iconMap: Record<FrontendType, JSX.Element> = {
  medication: <Pill className="w-5 h-5" />,
  refill: <AlertCircle className="w-5 h-5" />,
  guide: <RefreshCw className="w-5 h-5" />,
  system: <Bell className="w-5 h-5" />,
};

const colorMap: Record<FrontendType, string> = {
  medication: "bg-[#6B8E23] text-white",
  refill: "bg-red-500 text-white",
  guide: "bg-[#FFD166] text-[#2D3436]",
  system: "bg-blue-500 text-white",
};

export default function Notifications() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = () => {
    setLoading(true);
    notificationApi
      .list({ limit: 50 })
      .then((res) => {
        setNotifications(res.items);
        setUnreadCount(res.unread_count);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "알림을 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  };

  const markAsRead = async (id: string) => {
    try {
      const updated = await notificationApi.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
    setMarkingAll(false);
  };

  const filtered =
    filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-[#2D3436]">알림</h1>
        <p className="text-[#6c6f72]">복약 알림과 중요한 정보를 확인하세요</p>
      </div>

      {/* Unread Summary Card */}
      <div className="bg-[#6B8E23] text-white p-6 rounded-2xl mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <Bell className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-[#FFFCF5] opacity-80">읽지 않은 알림</p>
            <p className="text-4xl font-bold">{loading ? "-" : `${unreadCount}개`}</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition-colors text-sm disabled:opacity-60"
          >
            <CheckCheck className="w-4 h-4" />
            모두 읽음
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#6B8E23] animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border-2 border-red-400 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filter Tabs */}
            <div className="flex gap-2 bg-[#f5f3eb] p-1 rounded-xl w-fit">
              {(["all", "unread"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === f
                      ? "bg-[#6B8E23] text-white shadow-sm"
                      : "text-[#6c6f72] hover:text-[#2D3436]"
                  }`}
                >
                  {f === "all"
                    ? `전체 (${notifications.length})`
                    : `읽지 않음 (${unreadCount})`}
                </button>
              ))}
            </div>

            {/* Notification Items */}
            {filtered.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-[#6B8E23] rounded-2xl p-12 text-center">
                <BellOff className="w-12 h-12 text-[#6c6f72] mx-auto mb-3" />
                <p className="text-[#6c6f72]">
                  {filter === "unread" ? "읽지 않은 알림이 없습니다" : "알림이 없습니다"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((notif) => {
                  const frontendType = toFrontendType(notif.type);
                  return (
                    <div
                      key={notif.id}
                      className={`bg-white rounded-2xl p-4 border-2 transition-all ${
                        notif.is_read
                          ? "border-gray-100 opacity-70"
                          : "border-[#6B8E23] shadow-sm"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorMap[frontendType]}`}
                        >
                          {iconMap[frontendType]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="font-bold text-[#2D3436] text-sm">{notif.title}</h3>
                                {!notif.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-[#6B8E23] shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-[#6c6f72] leading-relaxed">
                                {notif.message}
                              </p>
                            </div>
                            {!notif.is_read && (
                              <button
                                onClick={() => markAsRead(notif.id)}
                                className="shrink-0 w-7 h-7 rounded-lg bg-[#f5f3eb] hover:bg-[#6B8E23] hover:text-white flex items-center justify-center transition-colors text-[#6c6f72]"
                                title="읽음 처리"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Clock className="w-3.5 h-3.5 text-[#6c6f72]" />
                            <span className="text-xs text-[#6c6f72]">
                              {relativeTime(notif.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="space-y-5">
            {/* Policy Note */}
            <div className="bg-[#FFD166] p-4 rounded-2xl">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-[#2D3436] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-[#2D3436] mb-1">알림 정책 안내</p>
                  <p className="text-xs text-[#2D3436] opacity-80 leading-relaxed">
                    약 소진 7일 전부터 D-day 알림이 자동으로 발송됩니다. 처방전을 미리 준비해 약이
                    끊기지 않도록 하세요.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="mt-6">
        <MedicalSafetyNotice />
      </div>
    </div>
  );
}
