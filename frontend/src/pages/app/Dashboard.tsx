import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { RefreshCw, Pill, BookOpen, MessageCircle, NotebookPen, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  scheduleApi,
  userApi,
  reminderApi,
  ScheduleItem,
  UserInfo,
  DdayReminder,
} from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";
import NotificationsTab from "./reminders/NotificationsTab";

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "예정",
  DONE: "완료",
  SKIPPED: "건너뜀",
};

const QUICK_NAV = [
  { label: "내 약 정보", icon: Pill, to: "/medications", color: "text-green-600 bg-green-50" },
  { label: "AI 가이드", icon: BookOpen, to: "/ai-guide", color: "text-blue-600 bg-blue-50" },
  { label: "챗봇", icon: MessageCircle, to: "/chat", color: "text-purple-600 bg-purple-50" },
  { label: "일상 기록", icon: NotebookPen, to: "/records", color: "text-red-500 bg-red-50" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [dday, setDday] = useState<DdayReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();

  async function load() {
    setLoading(true);
    try {
      const [userData, scheduleData, ddayData] = await Promise.all([
        userApi.me(),
        scheduleApi.getDaily(formatDate(today)),
        reminderApi.getDday(7),
      ]);
      setUser(userData);
      setItems(scheduleData.items);
      setDday(ddayData.items);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function updateStatus(itemId: string, status: "DONE" | "SKIPPED") {
    try {
      const updated = await scheduleApi.updateStatus(itemId, status);
      setItems((prev) => prev.map((it) => (it.item_id === itemId ? updated : it)));
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    }
  }

  const pending = items.filter((i) => i.status === "PENDING");
  const done = items.filter((i) => i.status !== "PENDING");
  const progress = items.length > 0 ? Math.round((done.length / items.length) * 100) : 0;

  const dateLabel = today.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="min-h-full p-4 md:p-8 max-w-3xl mx-auto space-y-5 stagger-children">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {user ? `안녕하세요, ${user.name}님` : "안녕하세요"}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 font-medium">{dateLabel}</p>
        </div>
        <button
          onClick={load}
          className="p-2.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-600 hover:shadow-sm transition-all duration-200"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* D-day alert banner */}
      {dday.length > 0 && (
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-200/60 rounded-2xl px-5 py-4">
          <div>
            <p className="text-sm font-bold text-amber-800">약 소진 임박 알림</p>
            <p className="text-sm text-amber-700 mt-0.5">
              <span className="font-bold">{dday[0].medication_name}</span>이(가){" "}
              <span className="font-bold">D-{dday[0].remaining_days}일</span> 남았습니다.
            </p>
          </div>
          <button
            onClick={() => navigate("/onboarding/scan")}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 hover:shadow-md transition-all duration-200 shrink-0 ml-4"
          >
            <Upload className="w-3.5 h-3.5" />
            처방전 업로드
          </button>
        </div>
      )}

      {/* Quick navigation */}
      <div className="card-warm p-5">
        <div className="flex justify-around">
          {QUICK_NAV.map(({ label, icon: Icon, to, color }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex flex-col items-center gap-2 group"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color} group-hover:scale-110 group-hover:shadow-md transition-all duration-200`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs text-gray-500 font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Today's schedule */}
      <div className="card-warm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-800">오늘의 일정</h2>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold text-green-600">{progress}%</span>
            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full gradient-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-sm text-gray-400 py-6">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">오늘 등록된 일정이 없습니다.</p>
        ) : (
          <div className="space-y-1.5">
            {pending.map((item) => (
              <ScheduleRow key={item.item_id} item={item} onUpdate={updateStatus} />
            ))}
            {done.map((item) => (
              <ScheduleRow key={item.item_id} item={item} onUpdate={updateStatus} />
            ))}
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="card-warm p-5">
        <h2 className="text-base font-bold text-gray-800 mb-4">알림</h2>
        <NotificationsTab />
      </div>

      {/* ── 의료 안전 고지 ── */}
      <div className="border border-gray-200 rounded-xl p-5">
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

function ScheduleRow({
  item,
  onUpdate,
}: {
  item: ScheduleItem;
  onUpdate: (id: string, status: "DONE" | "SKIPPED") => void;
}) {
  const isPending = item.status === "PENDING";
  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
        isPending ? "hover:bg-gray-50" : "opacity-45"
      }`}
    >
      <span className="text-xs text-gray-400 w-10 shrink-0 font-medium">{formatTime(item.scheduled_at)}</span>
      <span className="text-sm text-gray-700 flex-1 font-medium">{item.title}</span>
      {isPending ? (
        <div className="flex gap-1.5">
          <button
            onClick={() => onUpdate(item.item_id, "DONE")}
            className="px-3 py-1 text-xs font-semibold bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-all duration-150"
          >
            완료
          </button>
          <button
            onClick={() => onUpdate(item.item_id, "SKIPPED")}
            className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-400 rounded-lg hover:bg-gray-200 transition-all duration-150"
          >
            건너뜀
          </button>
        </div>
      ) : (
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
            item.status === "DONE"
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          {STATUS_LABEL[item.status]}
        </span>
      )}
    </div>
  );
}
