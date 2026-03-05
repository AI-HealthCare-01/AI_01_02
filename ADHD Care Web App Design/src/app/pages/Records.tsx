import { useState } from "react";
import {
  Calendar,
  TrendingUp,
  Activity,
  Moon,
  Coffee,
  Dumbbell,
  Pill,
  Edit3,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import MedicalSafetyNotice from "../components/MedicalSafetyNotice";

interface DayRecord {
  date: string;
  medication: { morning: boolean; evening: boolean };
  symptoms: { concentration: number; impulse: number; mood: number };
  lifestyle: { sleep: number; exercise: number; caffeine: number };
  notes: string;
}

const mockRecords: Record<string, DayRecord> = {
  "2026-02-24": {
    date: "2026-02-24",
    medication: { morning: true, evening: false },
    symptoms: { concentration: 7, impulse: 6, mood: 8 },
    lifestyle: { sleep: 7, exercise: 30, caffeine: 2 },
    notes: "오늘 집중력이 좋았음. 오후에 약간의 두통이 있었지만 금방 나아졌음.",
  },
  "2026-02-23": {
    date: "2026-02-23",
    medication: { morning: true, evening: true },
    symptoms: { concentration: 8, impulse: 7, mood: 7 },
    lifestyle: { sleep: 6.5, exercise: 0, caffeine: 3 },
    notes: "운동을 못해서 저녁에 집중하기 어려웠음.",
  },
  "2026-02-22": {
    date: "2026-02-22",
    medication: { morning: true, evening: true },
    symptoms: { concentration: 6, impulse: 5, mood: 6 },
    lifestyle: { sleep: 8, exercise: 45, caffeine: 1 },
    notes: "피곤하지만 운동 후 기분이 좋아졌음.",
  },
};

const weekData = [
  { day: "월", concentration: 7, mood: 8, taken: true },
  { day: "화", concentration: 8, mood: 7, taken: true },
  { day: "수", concentration: 6, mood: 6, taken: true },
  { day: "목", concentration: 7, mood: 7, taken: false },
  { day: "금", concentration: 8, mood: 8, taken: true },
  { day: "토", concentration: 7, mood: 8, taken: true },
  { day: "일", concentration: 7, mood: 7, taken: true },
];

export default function Records() {
  const [selectedDate, setSelectedDate] = useState("2026-02-24");
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  const record = mockRecords[selectedDate] || mockRecords["2026-02-24"];

  const navigateDate = (direction: "prev" | "next") => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + (direction === "next" ? 1 : -1));
    const newDate = d.toISOString().split("T")[0];
    setSelectedDate(newDate);
  };

  const startEdit = () => {
    setEditNotes(record.notes);
    setEditing(true);
  };

  const ScoreBar = ({
    label,
    value,
    max = 10,
  }: {
    label: string;
    value: number;
    max?: number;
  }) => (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-sm text-[#2D3436]">{label}</span>
        <span className="text-sm font-bold text-[#2D3436]">{value}/{max}</span>
      </div>
      <div className="h-2.5 bg-[#f5f3eb] rounded-full">
        <div
          className="h-full bg-[#6B8E23] rounded-full transition-all"
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1 text-[#2D3436]">일상 기록</h1>
        <p className="text-[#6c6f72]">증상과 생활 패턴을 기록하고 분석하세요</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Daily Record */}
        <div className="lg:col-span-2 space-y-4">
          {/* Date Navigator */}
          <div className="bg-[#6B8E23] text-white p-5 rounded-2xl">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigateDate("prev")}
                className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h2 className="font-bold text-lg">
                  {new Date(selectedDate).toLocaleDateString("ko-KR", {
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })}
                </h2>
                <p className="text-sm text-[#FFFCF5] opacity-80">오늘의 기록</p>
              </div>
              <button
                onClick={() => navigateDate("next")}
                className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-[#556b1c] border border-[#556b1c] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
              />
            </div>
          </div>

          {/* Medication Status */}
          <div className="bg-white border-2 border-[#6B8E23] p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Pill className="w-5 h-5 text-[#6B8E23]" />
              <h3 className="font-bold text-[#2D3436]">복약 현황</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "아침 복약", value: record.medication.morning, time: "08:00" },
                { label: "저녁 복약", value: record.medication.evening, time: "20:00" },
              ].map(({ label, value, time }) => (
                <div
                  key={label}
                  className={`p-4 rounded-xl border-2 text-center ${
                    value
                      ? "bg-[#6B8E23] text-white border-[#6B8E23]"
                      : "bg-[#FFFCF5] border-gray-200"
                  }`}
                >
                  <div className={`text-2xl mb-1 ${value ? "" : "text-gray-400"}`}>
                    {value ? "✓" : "—"}
                  </div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className={`text-xs mt-0.5 ${value ? "text-[#FFFCF5] opacity-70" : "text-[#6c6f72]"}`}>
                    {time}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Symptoms */}
          <div className="bg-white border-2 border-[#6B8E23] p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-[#6B8E23]" />
              <h3 className="font-bold text-[#2D3436]">증상 기록</h3>
            </div>
            <div className="space-y-3">
              <ScoreBar label="집중력" value={record.symptoms.concentration} />
              <ScoreBar label="충동 조절" value={record.symptoms.impulse} />
              <ScoreBar label="기분" value={record.symptoms.mood} />
            </div>
          </div>

          {/* Lifestyle */}
          <div className="bg-white border-2 border-[#6B8E23] p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[#6B8E23]" />
              <h3 className="font-bold text-[#2D3436]">생활 패턴</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { icon: Moon, value: `${record.lifestyle.sleep}h`, label: "수면" },
                { icon: Dumbbell, value: `${record.lifestyle.exercise}분`, label: "운동" },
                { icon: Coffee, value: `${record.lifestyle.caffeine}잔`, label: "카페인" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="p-3 bg-[#f5f3eb] rounded-xl">
                  <Icon className="w-6 h-6 mx-auto mb-1.5 text-[#6B8E23]" />
                  <div className="text-xl font-bold text-[#2D3436]">{value}</div>
                  <div className="text-xs text-[#6c6f72] mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white border-2 border-[#6B8E23] p-5 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#6B8E23]" />
                <h3 className="font-bold text-[#2D3436]">오늘의 일기</h3>
              </div>
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={() => setEditing(false)}
                      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[#6c6f72] hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="w-8 h-8 rounded-lg bg-[#6B8E23] flex items-center justify-center text-white hover:bg-[#556b1c] transition-colors"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startEdit}
                    className="w-8 h-8 rounded-lg bg-[#f5f3eb] flex items-center justify-center text-[#6c6f72] hover:bg-[#6B8E23] hover:text-white transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {editing ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full border-2 border-[#6B8E23] rounded-xl px-4 py-3 text-sm text-[#2D3436] bg-[#FFFCF5] resize-none focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                rows={4}
              />
            ) : (
              <p className="text-sm text-[#6c6f72] leading-relaxed">{record.notes}</p>
            )}
          </div>
        </div>

        {/* Right: Stats & Weekly Overview */}
        <div className="space-y-4">
          {/* Weekly Stats */}
          <div className="bg-[#6B8E23] text-white p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5" />
              <h3 className="font-bold">주간 통계</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: "평균 집중력", value: "7.1/10" },
                { label: "평균 수면", value: "6.9h" },
                { label: "복약 준수율", value: "94%" },
                { label: "평균 운동", value: "25분/일" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-sm text-[#FFFCF5] opacity-80">{label}</span>
                  <span className="font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Overview Grid */}
          <div className="bg-white border-2 border-[#6B8E23] p-5 rounded-2xl">
            <h3 className="font-bold text-[#2D3436] mb-4">이번 주 복약 및 집중력</h3>
            <div className="space-y-2">
              {weekData.map((day, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 text-sm font-medium text-[#2D3436] shrink-0">{day.day}</div>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      day.taken ? "bg-[#6B8E23]" : "bg-gray-200"
                    }`}
                  >
                    {day.taken && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="flex-1">
                    <div className="h-5 bg-[#f5f3eb] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#6B8E23] rounded-full transition-all"
                        style={{ width: `${(day.concentration / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-6 text-sm text-right text-[#2D3436] shrink-0">{day.concentration}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-[#6c6f72]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#6B8E23]" />
                복약 완료
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-gray-200" />
                복약 미완료
              </div>
            </div>
          </div>

          {/* Add Record Button */}
          <button className="w-full bg-[#FFD166] border-2 border-[#FFD166] text-[#2D3436] py-4 rounded-2xl font-bold hover:bg-[#ffc84d] hover:border-[#ffc84d] transition-colors flex items-center justify-center gap-2">
            <Edit3 className="w-5 h-5" />
            오늘의 기록 추가
          </button>

          {/* Symptom Trend */}
          <div className="bg-white border-2 border-[#6B8E23] p-5 rounded-2xl">
            <h3 className="font-bold text-[#2D3436] mb-3">증상 추세 (최근 7일)</h3>
            <div className="space-y-2">
              {[
                { label: "집중력 평균", score: 7.1, max: 10 },
                { label: "충동 조절 평균", score: 6.1, max: 10 },
                { label: "기분 평균", score: 7.3, max: 10 },
              ].map(({ label, score, max }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-[#6c6f72] mb-1">
                    <span>{label}</span>
                    <span className="font-bold text-[#2D3436]">{score}</span>
                  </div>
                  <div className="h-2 bg-[#f5f3eb] rounded-full">
                    <div
                      className="h-full bg-[#6B8E23] rounded-full"
                      style={{ width: `${(score / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <MedicalSafetyNotice />
    </div>
  );
}