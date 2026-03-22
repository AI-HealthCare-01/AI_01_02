import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Pill, BookOpen, MessageCircle, NotebookPen, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  scheduleApi,
  userApi,
  reminderApi,
  ocrApi,
  OcrMedication,
  Reminder,
  ScheduleItem,
  UserInfo,
  DdayReminder,
} from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";
import { toDateStr } from "@/lib/dateUtils";
import NotificationsTab from "./reminders/NotificationsTab";
import MedicationScheduleCard from "@/components/medication/MedicationScheduleCard";

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
  const [ocrMeds, setOcrMeds] = useState<OcrMedication[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayKey, setTodayKey] = useState(() => toDateStr(new Date()));
  const today = useMemo(() => new Date(todayKey + "T00:00:00"), [todayKey]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const newKey = toDateStr(new Date());
        setTodayKey((prev) => {
          if (prev !== newKey) return newKey;
          return prev;
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  async function loadOcrMedications() {
    const jobId = localStorage.getItem("ocr_job_id");
    if (!jobId) {
      setOcrMeds([]);
      return;
    }
    try {
      const res = await ocrApi.getJobResult(jobId);
      const meds = res.structured_data?.extracted_medications ?? res.structured_data?.medications ?? [];
      setOcrMeds(Array.isArray(meds) ? meds : []);
    } catch {
      setOcrMeds([]);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const [userData, scheduleData, ddayData, reminderData] = await Promise.all([
        userApi.me(),
        scheduleApi.getDaily(todayKey),
        reminderApi.getDday(7),
        reminderApi.list(true),
      ]);
      setUser(userData);
      setItems(scheduleData.items);
      setDday(ddayData.items);
      setReminders(reminderData.items);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
    await loadOcrMedications();
  }

  useEffect(() => { load(); }, [todayKey]); // eslint-disable-line

  async function updateMedicationStatus(itemId: string, status: "PENDING" | "DONE" | "SKIPPED") {
    try {
      const updated = await scheduleApi.updateStatus(itemId, status);
      setItems((prev) => prev.map((it) => (it.item_id === itemId ? updated : it)));
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    }
  }

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

      <MedicationScheduleCard
        title="복약 일정"
        loading={loading}
        ocrMeds={ocrMeds}
        reminders={reminders}
        scheduleItems={items}
        storageDateKey={todayKey}
        onUpdateScheduleStatus={updateMedicationStatus}
      />

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
