import { useState, useEffect } from "react";
import {
  Calendar, Clock, TrendingUp, AlertCircle, ScanLine, Brain,
  MessageSquare, Bell, ChevronRight, Notebook,
} from "lucide-react";
import { useNavigate } from "react-router";
import { scheduleApi, ScheduleItem } from "../../lib/api";
import MedicalSafetyNotice from "../components/MedicalSafetyNotice";

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "완료",
  PENDING: "예정",
  SKIPPED: "건너뜀",
};
const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-[#6B8E23] text-white",
  PENDING: "bg-[#FFD166] text-[#2D3436] hover:bg-[#FFD166]/80",
  SKIPPED: "bg-[#f5f3eb] text-[#6c6f72]",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    scheduleApi.getDaily(today)
      .then((res) => setItems(res.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleStatus = async (item: ScheduleItem) => {
    const next = item.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      const updated = await scheduleApi.updateStatus(item.item_id, next);
      setItems((prev) => prev.map((i) => (i.item_id === updated.item_id ? updated : i)));
    } catch {}
  };

  const quickLinks = [
    { icon: ScanLine, label: "처방전 스캔", path: "/ocr-scan", color: "#8A9A5B", bgColor: "bg-[#8A9A5B]/10" },
    { icon: Brain, label: "AI 가이드", path: "/ai-coach", color: "#6B9BD1", bgColor: "bg-[#6B9BD1]/10" },
    { icon: MessageSquare, label: "챗봇", path: "/chat", color: "#E6B566", bgColor: "bg-[#E6B566]/10" },
    { icon: Bell, label: "알림", path: "/notifications", color: "#D88E73", bgColor: "bg-[#D88E73]/10" },
    { icon: Notebook, label: "일상기록", path: "/records", color: "#9D4EDD", bgColor: "bg-[#9D4EDD]/10" },
  ];

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#2D3436]">안녕하세요 👋</h1>
        <p className="text-[#6c6f72] mt-1">
          {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <button key={link.path} onClick={() => navigate(link.path)}
              className="flex flex-col items-center gap-2 p-2 bg-transparent hover:-translate-y-0.5 transition-all">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${link.bgColor} border`}
                style={{ borderColor: link.color }}>
                <Icon className="w-7 h-7" strokeWidth={1.5} style={{ color: link.color }} />
              </div>
              <span className="text-xs font-medium text-[#2D3436] text-center leading-tight">{link.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Today's Schedule */}
        <div className="lg:col-span-2 bg-white border-2 border-[#6B8E23] p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-[#2D3436]">오늘의 일정</h2>
            <Calendar className="w-5 h-5 text-[#6B8E23]" />
          </div>

          {loading && <p className="text-sm text-[#6c6f72]">불러오는 중...</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-[#6c6f72]">오늘 등록된 일정이 없습니다.</p>
          )}

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.item_id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#f5f3eb] transition-colors">
                <div className="text-sm font-bold w-14 text-[#2D3436] shrink-0">
                  {new Date(item.scheduled_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="flex-1 text-sm text-[#2D3436]">{item.title}</div>
                <button onClick={() => toggleStatus(item)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition-colors ${STATUS_STYLE[item.status] ?? STATUS_STYLE.PENDING}`}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Side */}
        <div className="space-y-4">
          <div className="bg-white border-2 border-[#6B8E23] p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-[#6B8E23]" />
              <h3 className="font-bold text-[#2D3436]">복약 준수율</h3>
            </div>
            <div className="text-4xl font-bold text-[#2D3436] mb-1">
              {items.length === 0 ? "-" : `${Math.round((items.filter((i) => i.status === "COMPLETED").length / items.length) * 100)}%`}
            </div>
            <p className="text-xs text-[#6c6f72] mb-3">오늘 기준</p>
            <div className="h-2 bg-[#f5f3eb] rounded-full">
              <div className="h-full bg-[#6B8E23] rounded-full transition-all"
                style={{ width: items.length === 0 ? "0%" : `${Math.round((items.filter((i) => i.status === "COMPLETED").length / items.length) * 100)}%` }} />
            </div>
          </div>

          <div className="bg-[#FFD166] p-5 rounded-2xl">
            <h3 className="font-bold text-[#2D3436] mb-2">AI 가이드 추천</h3>
            <p className="text-sm text-[#2D3436] opacity-80 mb-3 leading-relaxed">
              AI 가이드를 통해 맞춤형 복약 및 생활습관 안내를 받아보세요.
            </p>
            <button onClick={() => navigate("/ai-coach")}
              className="w-full bg-[#2D3436] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#1a1d1f] transition-colors flex items-center justify-center gap-2">
              가이드 보기 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <MedicalSafetyNotice />
    </div>
  );
}
