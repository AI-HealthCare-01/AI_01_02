import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Edit2, Moon, Dumbbell, Coffee, Cigarette, Wine, Check, X } from "lucide-react";
import { toast } from "sonner";
import { scheduleApi, profileApi, HealthProfile, ScheduleItem, HealthProfileUpsertRequest } from "@/lib/api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function getMondayOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

function calcSleepHours(bedTime?: string, wakeTime?: string): string {
  if (!bedTime || !wakeTime) return "—";
  const [bh, bm] = bedTime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}hr ${m}m` : `${h}hr`;
}

const DOW_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

// ─── main component ───────────────────────────────────────────────────────────

export default function Records() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ label: string; done: boolean; hasItems: boolean }[]>([]);
  const [adherenceRate, setAdherenceRate] = useState<number | null>(null);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  async function loadSchedule(date: Date) {
    try {
      const r = await scheduleApi.getDaily(toDateStr(date));
      setScheduleItems(r.items);
    } catch {
      setScheduleItems([]);
    }
  }

  async function loadWeekly(date: Date) {
    const monday = getMondayOfWeek(date);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    const results = await Promise.all(
      days.map((d) =>
        scheduleApi.getDaily(toDateStr(d)).catch(() => ({ date: toDateStr(d), items: [] })),
      ),
    );
    const weekly = results.map((r, i) => {
      const medItems = r.items.filter((it) => it.category === "MEDICATION");
      const done = medItems.length > 0 && medItems.every((it) => it.status === "DONE");
      return { label: DOW_LABELS[i], done, hasItems: medItems.length > 0 };
    });
    setWeeklyData(weekly);

    // 복약 준수율
    const totalMed = results.flatMap((r) => r.items.filter((it) => it.category === "MEDICATION"));
    if (totalMed.length > 0) {
      const completedMed = totalMed.filter((it) => it.status === "DONE");
      setAdherenceRate(Math.round((completedMed.length / totalMed.length) * 100));
    } else {
      setAdherenceRate(null);
    }
  }

  async function loadProfile() {
    try {
      const p = await profileApi.getHealth();
      setProfile(p);
    } catch {
      // no profile yet
    }
  }

  async function load(date: Date) {
    setLoading(true);
    await Promise.all([loadSchedule(date), loadWeekly(date), loadProfile()]);
    setLoading(false);
  }

  useEffect(() => { load(selectedDate); }, []); // eslint-disable-line

  function goDay(offset: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d);
    load(d);
  }

  const dateLabel = selectedDate.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const pending = scheduleItems.filter((i) => i.status === "PENDING");
  const done = scheduleItems.filter((i) => i.status !== "PENDING");

  const sl = profile?.sleep_input;
  const ls = profile?.lifestyle_input;
  const LIFE_PATTERNS = [
    {
      label: "수면",
      value: calcSleepHours(sl?.bed_time, sl?.wake_time),
      icon: Moon,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "운동",
      value: (() => {
        const ex = ls?.exercise_hours;
        if (!ex) return "—";
        if (ex.high_intensity > 0) return "높음";
        if (ex.moderate_intensity > 0) return "보통";
        if (ex.low_intensity > 0) return "낮음";
        return "없음";
      })(),
      icon: Dumbbell,
      color: "bg-green-50 text-green-600",
    },
    {
      label: "카페인",
      value: ls?.substance_usage?.caffeine_cups_per_day != null
        ? `${ls.substance_usage.caffeine_cups_per_day}잔`
        : "—",
      icon: Coffee,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "흡연",
      value: ls?.substance_usage?.smoking ? "예" : "아니오",
      icon: Cigarette,
      color: "bg-gray-50 text-gray-500",
    },
    {
      label: "음주",
      value: ls?.substance_usage?.alcohol_frequency_per_week != null
        ? `주 ${ls.substance_usage.alcohol_frequency_per_week}회`
        : "—",
      icon: Wine,
      color: "bg-red-50 text-red-400",
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">일상 기록</h1>
      <p className="text-sm text-gray-400 mb-6">날짜별 복약 일정과 생활 패턴을 확인하세요.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="md:col-span-2 space-y-4">
          {/* Date navigator */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => goDay(-1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-gray-700">{dateLabel}</span>
              <button
                onClick={() => goDay(1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                disabled={toDateStr(selectedDate) >= toDateStr(new Date())}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 오늘의 일정 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">오늘의 일정</h3>
            {loading ? (
              <p className="text-center text-sm text-gray-400 py-6">불러오는 중...</p>
            ) : scheduleItems.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">이 날의 일정이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {[...pending, ...done].map((item) => (
                  <div key={item.item_id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${item.status !== "PENDING" ? "opacity-50" : ""}`}>
                    <span className="text-xs text-gray-400 w-10 shrink-0">{formatTime(item.scheduled_at)}</span>
                    <span className="text-sm text-gray-700 flex-1 truncate">{item.title}</span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${
                      item.status === "DONE" ? "bg-green-50 text-green-700" :
                      item.status === "SKIPPED" ? "bg-gray-100 text-gray-400" :
                      "bg-blue-50 text-blue-600"
                    }`}>
                      {item.status === "DONE" ? "완료" : item.status === "SKIPPED" ? "건너뜀" : "예정"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 생활 패턴 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">생활 패턴</h3>
            <div className="flex gap-3 flex-wrap">
              {LIFE_PATTERNS.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl ${color} min-w-[70px]`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-bold">{value}</span>
                  <span className="text-xs opacity-70">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* 이번 주 복약 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">이번 주 복약</h3>
            <div className="space-y-2">
              {weeklyData.map(({ label, done, hasItems }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-4">{label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    {hasItems && (
                      <div className={`h-full rounded-full ${done ? "bg-green-500" : "bg-gray-300"}`} style={{ width: "100%" }} />
                    )}
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    !hasItems ? "border-gray-200" :
                    done ? "border-green-500 bg-green-500" : "border-gray-300"
                  }`}>
                    {hasItems && done && <Check className="w-3 h-3 text-white" />}
                    {hasItems && !done && <X className="w-3 h-3 text-gray-300" />}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <span className="text-sm font-medium text-gray-600">복약 준수율</span>
              <span className="text-lg font-bold text-green-600">
                {adherenceRate !== null ? `${adherenceRate}%` : "—"}
              </span>
            </div>
          </div>

          {/* 일상 정보 수정 버튼 */}
          <button
            onClick={() => setShowEdit(true)}
            className="w-full py-3 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            일상 정보 수정하기
          </button>
        </div>
      </div>

      {showEdit && (
        <EditModal
          profile={profile}
          onClose={() => setShowEdit(false)}
          onSaved={async () => {
            await loadProfile();
            toast.success("정보가 업데이트되었습니다.");
          }}
        />
      )}
    </div>
  );
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: HealthProfile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const sl = profile?.sleep_input;
  const ls = profile?.lifestyle_input;

  const [bedTime, setBedTime] = useState(sl?.bed_time ?? "23:00");
  const [wakeTime, setWakeTime] = useState(sl?.wake_time ?? "07:00");
  const [sleepLatency, setSleepLatency] = useState(String(sl?.sleep_latency_minutes ?? ""));
  const [nightAwakenings, setNightAwakenings] = useState(String(sl?.night_awakenings_per_week ?? ""));
  const [daytimeSleepiness, setDaytimeSleepiness] = useState(sl?.daytime_sleepiness_score ?? 3);
  const [caffeine, setCaffeine] = useState(String(ls?.substance_usage?.caffeine_cups_per_day ?? 1));
  const [smoking, setSmoking] = useState(!!(ls?.substance_usage?.smoking));
  const [alcohol, setAlcohol] = useState(String(ls?.substance_usage?.alcohol_frequency_per_week ?? 1));
  const [appetiteScore, setAppetiteScore] = useState(profile?.nutrition_input?.appetite_score ?? 5);
  const [regularMeals, setRegularMeals] = useState(profile?.nutrition_input?.is_meal_regular ?? true);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const payload: HealthProfileUpsertRequest = {
        basic_info: profile?.basic_info ?? { height_cm: 0, weight_kg: 0, drug_allergies: [] },
        lifestyle_input: {
          exercise_hours: ls?.exercise_hours ?? { low_intensity: 0, moderate_intensity: 0, high_intensity: 0 },
          digital_usage: ls?.digital_usage ?? { pc_hours_per_day: 0, smartphone_hours_per_day: 0 },
          substance_usage: {
            caffeine_cups_per_day: parseFloat(caffeine) || 0,
            smoking: smoking ? 1 : 0,
            alcohol_frequency_per_week: parseFloat(alcohol) || 0,
          },
        },
        sleep_input: {
          bed_time: bedTime,
          wake_time: wakeTime,
          sleep_latency_minutes: sleepLatency ? parseInt(sleepLatency) : undefined,
          night_awakenings_per_week: nightAwakenings ? parseInt(nightAwakenings) : undefined,
          daytime_sleepiness_score: daytimeSleepiness,
        },
        nutrition_input: { appetite_score: appetiteScore, is_meal_regular: regularMeals },
      };
      await profileApi.upsertHealth(payload);
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-4">
        <h3 className="text-base font-bold text-gray-800 mb-5">일상 정보 수정</h3>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs font-semibold text-gray-400 uppercase">수면</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">취침 시간</label>
              <input type="time" value={bedTime} onChange={(e) => setBedTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">기상 시간</label>
              <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">잠들기까지 (분)</label>
              <input type="number" value={sleepLatency} onChange={(e) => setSleepLatency(e.target.value)} placeholder="30" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">야간 각성 (회/주)</label>
              <input type="number" value={nightAwakenings} onChange={(e) => setNightAwakenings(e.target.value)} placeholder="0" className={inputCls} />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-600">낮 졸림 정도</label>
              <span className="text-xs font-bold text-green-600">{daytimeSleepiness}</span>
            </div>
            <input type="range" min="1" max="10" value={daytimeSleepiness} onChange={(e) => setDaytimeSleepiness(Number(e.target.value))} className="w-full accent-green-600" />
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase pt-2">생활습관</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">카페인 (일, 잔)</label>
              <input type="number" value={caffeine} onChange={(e) => setCaffeine(e.target.value)} placeholder="1" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">음주 (주, 회)</label>
              <input type="number" value={alcohol} onChange={(e) => setAlcohol(e.target.value)} placeholder="1" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-2">흡연</label>
            <div className="flex gap-3">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => setSmoking(v)}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${smoking === v ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-500"}`}>
                  {v ? "예" : "아니오"}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase pt-2">영양</p>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-600">식욕 점수</label>
              <span className="text-xs font-bold text-green-600">{appetiteScore}</span>
            </div>
            <input type="range" min="1" max="10" value={appetiteScore} onChange={(e) => setAppetiteScore(Number(e.target.value))} className="w-full accent-green-600" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-2">규칙적 식사</label>
            <div className="flex gap-3">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => setRegularMeals(v)}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${regularMeals === v ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-500"}`}>
                  {v ? "예" : "아니오"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60">
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
