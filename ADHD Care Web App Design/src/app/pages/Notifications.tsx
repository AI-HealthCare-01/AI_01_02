import { useMemo, useState } from "react";
import { Bell, CheckCheck, Clock3, Pill, Sparkles } from "lucide-react";

type NotificationType = "GUIDE_READY" | "MEDICATION_REMINDER" | "MEDICATION_DDAY";

type NotificationItem = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

type ReminderItem = {
  id: number;
  medicationName: string;
  scheduleTimes: string[];
  enabled: boolean;
};

const initialNotifications: NotificationItem[] = [
  {
    id: 1,
    type: "GUIDE_READY",
    title: "맞춤 가이드 생성 완료",
    message: "최신 OCR 결과를 기반으로 새로운 복약/생활습관 가이드가 준비되었습니다.",
    isRead: false,
    createdAt: "방금 전",
  },
  {
    id: 2,
    type: "MEDICATION_REMINDER",
    title: "복약 리마인더",
    message: "아토목세틴 40mg 복용 예정 시간(20:00)입니다.",
    isRead: false,
    createdAt: "오늘 19:58",
  },
  {
    id: 3,
    type: "MEDICATION_DDAY",
    title: "약 소진 D-day",
    message: "메틸페니데이트 서방정이 6일 후 소진 예정입니다. 재처방 일정을 확인하세요.",
    isRead: true,
    createdAt: "오늘 08:00",
  },
];

const initialReminders: ReminderItem[] = [
  {
    id: 1,
    medicationName: "메틸페니데이트 서방정 18mg",
    scheduleTimes: ["08:00"],
    enabled: true,
  },
  {
    id: 2,
    medicationName: "아토목세틴 40mg",
    scheduleTimes: ["20:00"],
    enabled: true,
  },
];

export default function Notifications() {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [reminders, setReminders] = useState<ReminderItem[]>(initialReminders);

  const filteredNotifications = useMemo(
    () => (onlyUnread ? notifications.filter((item) => !item.isRead) : notifications),
    [notifications, onlyUnread],
  );

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const ddayItems = notifications.filter((item) => item.type === "MEDICATION_DDAY");

  const markOneAsRead = (id: number) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const toggleReminder = (id: number) => {
    setReminders((prev) =>
      prev.map((reminder) => (reminder.id === id ? { ...reminder, enabled: !reminder.enabled } : reminder)),
    );
  };

  const getTypeChip = (type: NotificationType) => {
    if (type === "GUIDE_READY") return "bg-[#dcf7f5] text-[#156f6a]";
    if (type === "MEDICATION_REMINDER") return "bg-[#fff5d6] text-[#8a6510]";
    return "bg-[#ffe9e8] text-[#a73a36]";
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2 text-[#2D3436]">알림 센터</h1>
          <p className="text-[#6c6f72]">가이드 완료, 복약 리마인더, D-day 알림을 한 곳에서 관리합니다</p>
        </div>
        <div className="bg-[#20B2AA] text-white px-4 py-3 rounded-xl min-w-40">
          <div className="text-xs opacity-90">미읽음</div>
          <div className="text-3xl font-bold">{unreadCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border-2 border-[#20B2AA] p-4 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOnlyUnread(false)}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  !onlyUnread ? "bg-[#20B2AA] text-white" : "bg-[#f5f3eb] text-[#6c6f72]"
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setOnlyUnread(true)}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  onlyUnread ? "bg-[#20B2AA] text-white" : "bg-[#f5f3eb] text-[#6c6f72]"
                }`}
              >
                미읽음
              </button>
            </div>
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                unreadCount > 0 ? "bg-[#FFD166] text-[#2D3436] hover:bg-[#ffc84d]" : "bg-[#f5f3eb] text-[#6c6f72]"
              }`}
            >
              <CheckCheck className="w-4 h-4" />
              전체 읽음 처리
            </button>
          </div>

          <div className="space-y-3">
            {filteredNotifications.map((item) => (
              <div
                key={item.id}
                className={`bg-white border-2 p-4 rounded-2xl ${
                  item.isRead ? "border-[#f0eee8]" : "border-[#20B2AA]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${getTypeChip(item.type)}`}>
                        {item.type}
                      </span>
                      <span className="text-xs text-[#6c6f72]">{item.createdAt}</span>
                    </div>
                    <h3 className="font-bold text-[#2D3436]">{item.title}</h3>
                    <p className="text-sm text-[#6c6f72] mt-1">{item.message}</p>
                  </div>
                  {!item.isRead && (
                    <button
                      onClick={() => markOneAsRead(item.id)}
                      className="text-xs bg-[#20B2AA] text-white px-3 py-1 rounded-lg hover:bg-[#1a8f89]"
                    >
                      읽음
                    </button>
                  )}
                </div>
              </div>
            ))}

            {filteredNotifications.length === 0 && (
              <div className="bg-white border-2 border-dashed border-[#20B2AA] p-10 rounded-2xl text-center text-[#6c6f72]">
                표시할 알림이 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border-2 border-[#20B2AA] p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Pill className="w-5 h-5 text-[#20B2AA]" />
              <h2 className="font-bold text-[#2D3436]">복약 리마인더</h2>
            </div>
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="bg-[#FFFCF5] border border-[#20B2AA] rounded-lg p-3">
                  <div className="font-medium text-[#2D3436]">{reminder.medicationName}</div>
                  <p className="text-xs text-[#6c6f72] mt-1">{reminder.scheduleTimes.join(", ")}</p>
                  <button
                    onClick={() => toggleReminder(reminder.id)}
                    className={`mt-2 text-xs px-2 py-1 rounded ${
                      reminder.enabled ? "bg-[#20B2AA] text-white" : "bg-[#f5f3eb] text-[#6c6f72]"
                    }`}
                  >
                    {reminder.enabled ? "활성" : "비활성"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#FFD166] p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3 text-[#2D3436]">
              <Clock3 className="w-5 h-5" />
              <h2 className="font-bold">약 소진 D-day</h2>
            </div>
            <div className="space-y-2 text-sm text-[#2D3436]">
              {ddayItems.map((item) => (
                <div key={item.id} className="bg-white/70 rounded-lg p-2">
                  {item.message}
                </div>
              ))}
            </div>
            <p className="text-xs text-[#2D3436] mt-3 opacity-80">소진 7일 전부터 알림이 노출됩니다.</p>
          </div>

          <div className="bg-[#20B2AA] text-white p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-5 h-5" />
              <h2 className="font-bold">알림 정책 요약</h2>
            </div>
            <ul className="text-sm space-y-1 text-[#FFFCF5] opacity-95">
              <li>가이드 생성 완료 시 GUIDE_READY 발행</li>
              <li>사용자별 읽음/미읽음 상태 분리</li>
              <li>리마인더 시간 설정 기반 알림 발송</li>
            </ul>
            <div className="mt-3 text-xs flex items-center gap-1 text-[#FFFCF5] opacity-80">
              <Sparkles className="w-3 h-3" />
              API: /api/v1/notifications, /api/v1/reminders
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
