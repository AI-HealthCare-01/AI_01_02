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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// ── 알람 설정 (localStorage 기반) ──────────────────────────────────────────────

const ALARM_KEY = "logly_alarm_settings";

interface AlarmSettings {
  medication: boolean;
  dday: boolean;
}

function loadAlarmSettings(): AlarmSettings {
  try {
    const raw = localStorage.getItem(ALARM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<
        AlarmSettings & { morning?: boolean; evening?: boolean }
      >;
      return {
        medication:
          parsed.medication ?? parsed.morning ?? parsed.evening ?? true,
        dday: parsed.dday ?? true,
      };
    }
  } catch {}
  return { medication: true, dday: true };
}

function saveAlarmSettings(s: AlarmSettings) {
  localStorage.setItem(ALARM_KEY, JSON.stringify(s));
}

// ── Toggle 컴포넌트 ────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
        on ? "bg-green-500" : "bg-gray-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

type FilterType = "all" | "unread";

export default function NotificationsTab() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [alarm, setAlarm] = useState<AlarmSettings>(loadAlarmSettings);
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

  function updateAlarm(key: keyof AlarmSettings, value: boolean) {
    const next = { ...alarm, [key]: value };
    setAlarm(next);
    saveAlarmSettings(next);
  }

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

  const unread = notifications.filter((n) => !n.is_read);
  const displayed = filter === "unread" ? unread : notifications;

  return (
    <div>
      {/* 2-column layout */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* ── 좌측: 필터 + 알림 목록 ── */}
        <div className="flex-1 min-w-0">
          {/* 필터 탭 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filter === "all"
                  ? "bg-green-600 text-white border-green-600"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filter === "unread"
                  ? "bg-green-600 text-white border-green-600"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              읽지않은 알람 {unread.length}개
            </button>
          </div>

          {/* 알림 목록 */}
          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p>{filter === "unread" ? "읽지 않은 알림이 없습니다." : "알림이 없습니다."}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3.5 transition-colors ${
                    n.is_read
                      ? "border-gray-100 cursor-default"
                      : "border-gray-200 hover:bg-gray-50 cursor-pointer"
                  }`}
                >
                  <div className="shrink-0">{TYPE_ICON[n.type]}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${n.is_read ? "text-gray-400" : "text-gray-800"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.message}</p>
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
          )}
        </div>

        {/* ── 우측 패널 ── */}
        <div className="w-full lg:w-56 shrink-0 space-y-3">
          {/* 모두 읽음 버튼 */}
          <button
            onClick={markAllRead}
            disabled={unread.length === 0}
            className="w-full py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            모두 읽음
          </button>

          {/* 알람 관리 */}
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-700 mb-4">
              알람 관리{" "}
              <span className="text-xs font-normal text-gray-400">(켜기/끄기)</span>
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">복약 알림</span>
                <Toggle on={alarm.medication} onChange={(v) => updateAlarm("medication", v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">소진 d-day</span>
                <Toggle on={alarm.dday} onChange={(v) => updateAlarm("dday", v)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 의료 안전 고지 ── */}
      <div className="mt-6 border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-2">의료 안전 고지</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          본 서비스의 알림 및 복약 정보는 참고용이며, 의료진의 처방 및 지시를 대체하지 않습니다.
          복약 관련 이상반응이나 건강 이상이 느껴질 경우 즉시 의료 전문가와 상담하시기 바랍니다.
          처방된 약의 용량, 복용 시간, 주의사항은 반드시 담당 의사 또는 약사의 지도에 따르십시오.
        </p>
      </div>
    </div>
  );
}
