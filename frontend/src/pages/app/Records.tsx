import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { scheduleApi, profileApi, ocrApi, HealthProfile, ScheduleItem, OcrMedication, HealthProfileUpsertRequest } from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";
import MedicationScheduleCard from "@/components/medication/MedicationScheduleCard";

// ─── helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMondayOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

const DOW_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const WEEKLY_RATE_STORAGE_PREFIX = "weekly_med_rate";
const DAILY_DIARY_STORAGE_PREFIX = "daily_diary";

function getWeekdayIndexMondayStart(d: Date) {
  const day = d.getDay(); // 0=Sun
  return day === 0 ? 6 : day - 1;
}

function getDailyConfirmStorageKey(date: string) {
  return `daily_med_confirmed:${date}`;
}

function getDailyDiaryStorageKey(date: string) {
  return `${DAILY_DIARY_STORAGE_PREFIX}:${date}`;
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Records() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [weeklyRates, setWeeklyRates] = useState<Array<number | null>>(Array(7).fill(null));
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [ocrMeds, setOcrMeds] = useState<OcrMedication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [dailyDiary, setDailyDiary] = useState("");

  async function loadSchedule(date: Date) {
    try {
      const r = await scheduleApi.getDaily(toDateStr(date));
      setScheduleItems(r.items);
    } catch {
      setScheduleItems([]);
    }
  }

  function getWeeklyRateStorageKey(date: Date) {
    return `${WEEKLY_RATE_STORAGE_PREFIX}:${toDateStr(getMondayOfWeek(date))}`;
  }

  async function loadWeeklyRates(date: Date, meds: OcrMedication[]) {
    if (meds.length === 0) {
      setWeeklyRates(Array(7).fill(null));
      return;
    }

    const monday = getMondayOfWeek(date);
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });

    const dailySchedules = await Promise.all(
      weekDates.map((d) => scheduleApi.getDaily(toDateStr(d)).catch(() => ({ date: toDateStr(d), items: [] }))),
    );

    const computedRates = weekDates.map((d, i) => {
      const dateStr = toDateStr(d);
      const medicationItems = dailySchedules[i].items
        .filter((item) => item.category === "MEDICATION")
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

      let manualMap: Record<string, boolean> = {};
      try {
        const raw = localStorage.getItem(getDailyConfirmStorageKey(dateStr));
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, boolean>;
          manualMap = parsed ?? {};
        }
      } catch {
        manualMap = {};
      }

      const completed = meds.reduce((acc, med, idx) => {
        const scheduleItem = medicationItems[idx];
        if (scheduleItem) return acc + (scheduleItem.status === "DONE" ? 1 : 0);
        const manualKey = `${med.drug_name}-${med.intake_time ?? ""}-${idx}`;
        return acc + (manualMap[manualKey] ? 1 : 0);
      }, 0);

      return Math.round((completed / meds.length) * 100);
    });

    setWeeklyRates(computedRates);
    try {
      localStorage.setItem(getWeeklyRateStorageKey(date), JSON.stringify(computedRates));
    } catch {
      // ignore storage write failures
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

  async function loadOcrMedications() {
    const jobId = localStorage.getItem("ocr_job_id");
    if (!jobId) {
      setOcrMeds([]);
      return [] as OcrMedication[];
    }
    try {
      const res = await ocrApi.getJobResult(jobId);
      const meds = res.structured_data?.extracted_medications ?? res.structured_data?.medications ?? [];
      const normalized = Array.isArray(meds) ? meds : [];
      setOcrMeds(normalized);
      return normalized;
    } catch {
      setOcrMeds([]);
      return [] as OcrMedication[];
    }
  }

  async function updateMedicationStatus(itemId: string, status: "DONE" | "SKIPPED") {
    try {
      const updated = await scheduleApi.updateStatus(itemId, status);
      setScheduleItems((prev) => prev.map((it) => (it.item_id === itemId ? updated : it)));
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    }
  }

  function handleDailyProgressChange(progress: number, totalCount: number) {
    if (totalCount === 0) return;
    const dayIndex = getWeekdayIndexMondayStart(selectedDate);
    setWeeklyRates((prev) => {
      if (prev[dayIndex] === progress) return prev;
      const next = [...prev];
      next[dayIndex] = progress;
      localStorage.setItem(getWeeklyRateStorageKey(selectedDate), JSON.stringify(next));
      return next;
    });
  }

  async function load(date: Date) {
    setLoading(true);
    const [, , meds] = await Promise.all([loadSchedule(date), loadProfile(), loadOcrMedications()]);
    await loadWeeklyRates(date, meds);
    setLoading(false);
  }

  useEffect(() => { load(selectedDate); }, []); // eslint-disable-line

  useEffect(() => {
    const key = getDailyDiaryStorageKey(toDateStr(selectedDate));
    try {
      const saved = localStorage.getItem(key);
      setDailyDiary(saved ?? "");
    } catch {
      setDailyDiary("");
    }
  }, [selectedDate]);

  function saveDailyDiary() {
    const key = getDailyDiaryStorageKey(toDateStr(selectedDate));
    try {
      localStorage.setItem(key, dailyDiary.trim());
      toast.success("오늘의 일기를 저장했습니다.");
    } catch {
      toast.error("일기 저장에 실패했습니다.");
    }
  }

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
  const weeklyRatesWithValues = weeklyRates.filter((v): v is number => v !== null);
  const weeklyAverageRate = weeklyRatesWithValues.length > 0
    ? Math.round(weeklyRatesWithValues.reduce((sum, v) => sum + v, 0) / weeklyRatesWithValues.length)
    : null;

  return (
    <div className="min-h-full p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">일상 기록</h1>
      <p className="text-sm text-gray-400 mb-6">날짜별 복약 일정과 복약 여부를 확인하세요.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="md:col-span-2 space-y-4">
          {/* Date navigator */}
          <div className="card-warm p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => goDay(-1)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-all duration-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-gray-700">{dateLabel}</span>
              <button
                onClick={() => goDay(1)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-all duration-200"
                disabled={toDateStr(selectedDate) >= toDateStr(new Date())}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <MedicationScheduleCard
            title="복약 일정"
            loading={loading}
            ocrMeds={ocrMeds}
            scheduleItems={scheduleItems}
            storageDateKey={toDateStr(selectedDate)}
            onUpdateScheduleStatus={updateMedicationStatus}
            onProgressChange={handleDailyProgressChange}
          />

          {/* 오늘의 일기 */}
          <div className="card-warm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">오늘의 일기</h3>
            <textarea
              value={dailyDiary}
              onChange={(e) => setDailyDiary(e.target.value)}
              spellCheck={false}
              placeholder="오늘의 컨디션, 복약 후 변화, 메모를 자유롭게 기록하세요."
              className="w-full h-56 resize-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={saveDailyDiary}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-all duration-200"
              >
                저장
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* 이번 주 복약 */}
          <div className="card-warm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">이번 주 복약</h3>
            <div className="space-y-2">
              {DOW_LABELS.map((label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-4">{label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${weeklyRates[i] ?? 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 w-10 text-right">
                    {weeklyRates[i] !== null ? `${weeklyRates[i]}%` : "-"}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-600">주간 평균 복약율</span>
              <span className="text-lg font-bold text-green-600">
                {weeklyAverageRate !== null ? `${weeklyAverageRate}%` : "—"}
              </span>
            </div>
          </div>

          {/* 입력된 일상정보 */}
          <div className="card-warm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">입력된 일상정보</h3>
            <div className="h-56 rounded-xl border border-gray-200 bg-white/70" />
          </div>

          {/* 일상 정보 수정 버튼 */}
          <button
            onClick={() => setShowEdit(true)}
            className="w-full py-3 bg-red-400 hover:bg-red-500 text-white text-sm font-bold rounded-xl hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
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
  const ls = profile?.lifestyle;

  const [bedTime, setBedTime] = useState(sl?.bed_time ?? "23:00");
  const [wakeTime, setWakeTime] = useState(sl?.wake_time ?? "07:00");
  const [sleepLatency, setSleepLatency] = useState(String(sl?.sleep_latency_minutes ?? ""));
  const [nightAwakenings, setNightAwakenings] = useState(String(sl?.night_awakenings_per_week ?? ""));
  const [daytimeSleepiness, setDaytimeSleepiness] = useState(sl?.daytime_sleepiness ?? 3);
  const [caffeine, setCaffeine] = useState(String(ls?.caffeine_cups_per_day ?? 1));
  const [smoking, setSmoking] = useState(!!(ls?.smoking));
  const [alcohol, setAlcohol] = useState(String(ls?.alcohol_frequency_per_week ?? 1));
  const [appetiteScore, setAppetiteScore] = useState(profile?.nutrition_status?.appetite_level ?? 5);
  const [regularMeals, setRegularMeals] = useState(profile?.nutrition_status?.meal_regular ?? true);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const payload: HealthProfileUpsertRequest = {
        basic_info: profile?.basic_info ?? { height_cm: 0, weight_kg: 0, drug_allergies: [] },
        lifestyle: {
          exercise_frequency_per_week: ls?.exercise_frequency_per_week ?? 0,
          pc_hours_per_day: ls?.pc_hours_per_day ?? 0,
          smartphone_hours_per_day: ls?.smartphone_hours_per_day ?? 0,
          caffeine_cups_per_day: parseFloat(caffeine) || 0,
          smoking: smoking ? 1 : 0,
          alcohol_frequency_per_week: parseFloat(alcohol) || 0,
        },
        sleep_input: {
          bed_time: bedTime,
          wake_time: wakeTime,
          sleep_latency_minutes: sleepLatency ? parseInt(sleepLatency) : 0,
          night_awakenings_per_week: nightAwakenings ? parseInt(nightAwakenings) : 0,
          daytime_sleepiness: daytimeSleepiness,
        },
        nutrition_status: { appetite_level: appetiteScore, meal_regular: regularMeals },
      };
      await profileApi.upsertHealth(payload);
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

  return (
    <div className="fixed inset-0 bg-black/25 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-4 animate-page-enter">
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
                  className={`flex-1 py-2 rounded-xl text-sm border transition-all duration-200 ${smoking === v ? "gradient-primary text-white border-green-600 font-bold" : "border-gray-200 text-gray-500"}`}>
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
                  className={`flex-1 py-2 rounded-xl text-sm border transition-all duration-200 ${regularMeals === v ? "gradient-primary text-white border-green-600 font-bold" : "border-gray-200 text-gray-500"}`}>
                  {v ? "예" : "아니오"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200">취소</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 text-sm font-bold gradient-primary text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-60">
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
