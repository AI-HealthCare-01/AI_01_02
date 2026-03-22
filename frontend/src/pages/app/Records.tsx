import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit2, CalendarDays, X } from "lucide-react";
import { toast } from "sonner";
import {
  scheduleApi,
  profileApi,
  ocrApi,
  guideApi,
  diaryApi,
  HealthProfile,
  ScheduleItem,
  OcrMedication,
  HealthProfileUpsertRequest,
  Reminder,
  reminderApi,
} from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";
import { toDateStr, getMondayOfWeek } from "@/lib/dateUtils";
import MedicationScheduleCard from "@/components/medication/MedicationScheduleCard";

const CAFFEINE_MG_PER_CUP = 150;

// ─── helpers ──────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

const DOW_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const WEEKLY_RATE_STORAGE_PREFIX = "weekly_med_rate";

function getWeekdayIndexMondayStart(d: Date) {
  const day = d.getDay(); // 0=Sun
  return day === 0 ? 6 : day - 1;
}

function getDailyConfirmStorageKey(date: string) {
  return `daily_med_confirmed:${date}`;
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Records() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [weeklyRates, setWeeklyRates] = useState<Array<number | null>>(Array(7).fill(null));
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [ocrMeds, setOcrMeds] = useState<OcrMedication[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showMobileProfileDetails, setShowMobileProfileDetails] = useState(false);
  const [dailyDiary, setDailyDiary] = useState("");
  const weekCacheRef = useRef<Record<string, Awaited<ReturnType<typeof scheduleApi.getDaily>>[]>>({});

  async function loadSchedule(date: Date) {
    try {
      const r = await scheduleApi.getDaily(toDateStr(date));
      setScheduleItems(r.items);
    } catch (err) {
      console.warn("Failed to load schedule:", err);
      setScheduleItems([]);
    }
  }

  function getWeeklyRateStorageKey(date: Date) {
    return `${WEEKLY_RATE_STORAGE_PREFIX}:${toDateStr(getMondayOfWeek(date))}`;
  }

  async function loadWeeklyRates(date: Date) {
    const monday = getMondayOfWeek(date);
    const mondayKey = toDateStr(monday);
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });

    let dailySchedules: Awaited<ReturnType<typeof scheduleApi.getDaily>>[];
    if (weekCacheRef.current[mondayKey]) {
      dailySchedules = weekCacheRef.current[mondayKey];
    } else {
      dailySchedules = await Promise.all(
        weekDates.map((d) => scheduleApi.getDaily(toDateStr(d)).catch(() => ({ date: toDateStr(d), items: [] }))),
      );
      weekCacheRef.current[mondayKey] = dailySchedules;
    }

    const computedRates = weekDates.map((_d, i) => {
      const medicationItems = dailySchedules[i].items
        .filter((item) => item.category === "MEDICATION");
      if (medicationItems.length === 0) return null;
      const doneCount = medicationItems.filter((item) => item.status === "DONE").length;
      return Math.round((doneCount / medicationItems.length) * 100);
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
    } catch (err) {
      console.warn("Failed to load profile:", err);
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
    } catch (err) {
      console.warn("Failed to load OCR medications:", err);
      setOcrMeds([]);
      return [] as OcrMedication[];
    }
  }

  async function loadReminders() {
    try {
      const response = await reminderApi.list(true);
      setReminders(response.items);
    } catch (err) {
      console.warn("Failed to load reminders:", err);
      setReminders([]);
    }
  }

  async function updateMedicationStatus(itemId: string, status: "PENDING" | "DONE" | "SKIPPED") {
    try {
      const updated = await scheduleApi.updateStatus(itemId, status);
      setScheduleItems((prev) => prev.map((it) => (it.item_id === itemId ? updated : it)));
      const mondayKey = toDateStr(getMondayOfWeek(selectedDate));
      delete weekCacheRef.current[mondayKey];
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    }
  }

  const handleDailyProgressChange = useCallback((progress: number, totalCount: number) => {
    if (totalCount === 0) return;
    const dayIndex = getWeekdayIndexMondayStart(selectedDate);
    setWeeklyRates((prev) => {
      if (prev[dayIndex] === progress) return prev;
      const next = [...prev];
      next[dayIndex] = progress;
      localStorage.setItem(getWeeklyRateStorageKey(selectedDate), JSON.stringify(next));
      return next;
    });
  }, [selectedDate]);

  async function load(date: Date) {
    setLoading(true);
    await Promise.all([loadSchedule(date), loadProfile(), loadOcrMedications(), loadReminders()]);
    await loadWeeklyRates(date);
    setLoading(false);
  }

  useEffect(() => { load(selectedDate); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    diaryApi.getByDate(toDateStr(selectedDate))
      .then((r) => setDailyDiary(r.content))
      .catch((err) => {
        console.warn("Failed to load diary:", err);
        toast.error(toUserMessage(err));
        setDailyDiary("");
      });
  }, [selectedDate]);

  async function saveDailyDiary() {
    try {
      await diaryApi.upsert(toDateStr(selectedDate), dailyDiary.trim());
      toast.success("오늘의 일기를 저장했습니다.");
    } catch (err) {
      toast.error(toUserMessage(err));
    }
  }

  function goDay(offset: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d);
    setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    load(d);
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setCalendarOpen(false);
    load(date);
  }

  const todayStr = toDateStr(new Date());
  const today = new Date();
  const calendarMonthLabel = calendarMonth.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return {
        date,
        inCurrentMonth: date.getMonth() === calendarMonth.getMonth(),
        isFuture: toDateStr(date) > todayStr,
      };
    });
  }, [calendarMonth, todayStr]);
  const dateLabel = selectedDate.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const weeklyRatesWithValues = weeklyRates.filter((v): v is number => v !== null);
  const weeklyAverageRate = weeklyRatesWithValues.length > 0
    ? Math.round(weeklyRatesWithValues.reduce((sum, v) => sum + v, 0) / weeklyRatesWithValues.length)
    : null;
  const smokingLabel = (() => {
    const v = profile?.lifestyle?.smoking ?? 0;
    if (v === 0) return "비흡연";
    if (v <= 1) return "하루 5개비 이하";
    return "하루 6개비 이상";
  })();
  const alcoholLabel = (() => {
    const v = profile?.lifestyle?.alcohol_frequency_per_week ?? 0;
    if (v <= 0) return "월 1회 이하";
    if (v <= 2) return "주 1~2회";
    return "주 3회 이상";
  })();
  const regularMealsLabel = profile?.nutrition_status?.meal_regular ? "규칙적" : "불규칙";

  return (
    <div className="min-h-full p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">일상 기록</h1>
      <p className="text-sm text-gray-400 mb-6">날짜별 복약 일정과 복약 여부를 확인하세요.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="md:col-span-2 space-y-4">
          {/* Date navigator */}
          <div className="card-warm p-4 relative">
            <div className="flex items-center justify-between">
              <button
                onClick={() => goDay(-1)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-all duration-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCalendarOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all duration-200"
              >
                <span>{dateLabel}</span>
                <CalendarDays className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => goDay(1)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-all duration-200"
                disabled={toDateStr(selectedDate) >= toDateStr(new Date())}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {calendarOpen && (
              <>
                <button
                  type="button"
                  aria-label="캘린더 닫기"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setCalendarOpen(false)}
                />
                <div className="absolute left-1/2 top-full z-20 mt-3 w-[320px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1))}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all duration-200"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all duration-200"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-gray-800">{calendarMonthLabel}</p>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={
                          calendarMonth.getFullYear() > today.getFullYear()
                          || (calendarMonth.getFullYear() === today.getFullYear()
                              && calendarMonth.getMonth() >= today.getMonth())
                        }
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1))}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={calendarMonth.getFullYear() >= today.getFullYear()}
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mb-2 grid grid-cols-7 gap-1">
                    {DOW_LABELS.map((label) => (
                      <div key={label} className="py-1 text-center text-xs font-semibold text-gray-400">
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map(({ date, inCurrentMonth, isFuture }) => {
                      const selected = isSameDay(date, selectedDate);
                      return (
                        <button
                          key={toDateStr(date)}
                          type="button"
                          onClick={() => selectDate(date)}
                          disabled={isFuture}
                          className={`h-10 rounded-xl text-sm font-medium transition-all duration-200 ${
                            selected
                              ? "bg-green-500 text-white shadow-sm"
                              : inCurrentMonth
                                ? "text-gray-700 hover:bg-green-50"
                                : "text-gray-300 hover:bg-gray-50"
                          } disabled:cursor-not-allowed disabled:text-gray-200 disabled:hover:bg-transparent`}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card-warm p-4 md:hidden">
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-700">입력된 일상정보</h3>
                <p className="mt-1 text-xs leading-5 text-gray-400">
                  현재 저장된 일상정보 전체를 바로 확인할 수 있습니다.
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowMobileProfileDetails(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-600 transition-all duration-200 hover:border-gray-300 hover:text-gray-800"
                >
                  <span>전체 보기</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <MedicationScheduleCard
            title="복약 일정"
            loading={loading}
            ocrMeds={ocrMeds}
            reminders={reminders}
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
          <div className="hidden md:block card-warm p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">입력된 일상정보</h3>
            <div className="rounded-xl border border-gray-200 bg-white/70 p-3">
              <ProfileInfoContent
                profile={profile}
                smokingLabel={smokingLabel}
                alcoholLabel={alcoholLabel}
                regularMealsLabel={regularMealsLabel}
              />
            </div>
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

      {showMobileProfileDetails && (
        <MobileProfileInfoSheet
          profile={profile}
          smokingLabel={smokingLabel}
          alcoholLabel={alcoholLabel}
          regularMealsLabel={regularMealsLabel}
          onClose={() => setShowMobileProfileDetails(false)}
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
  const bi = profile?.basic_info;
  const EXERCISE_OPTIONS = [
    { value: "low", label: "낮음", desc: "주 1회 이하" },
    { value: "moderate", label: "보통", desc: "주 2~3회" },
    { value: "high", label: "높음", desc: "주 4회 이상" },
  ];
  const SMOKING_OPTIONS = [
    { value: "none", label: "비흡연" },
    { value: "light", label: "하루 5개비 이하 또는 주 1~3회" },
    { value: "heavy", label: "하루 6개비 이상" },
  ];
  const ALCOHOL_OPTIONS = [
    { value: "low", label: "월 1회 이하" },
    { value: "moderate", label: "주 1~2회" },
    { value: "high", label: "주 3회 이상" },
  ];

  const [bedTime, setBedTime] = useState(sl?.bed_time ?? "23:00");
  const [wakeTime, setWakeTime] = useState(sl?.wake_time ?? "07:00");
  const [height, setHeight] = useState(String(bi?.height_cm ?? ""));
  const [weight, setWeight] = useState(String(bi?.weight_kg ?? ""));
  const [allergyInput, setAllergyInput] = useState("");
  const [allergies, setAllergies] = useState<string[]>(bi?.drug_allergies ?? []);
  const [sleepLatency, setSleepLatency] = useState(String(sl?.sleep_latency_minutes ?? ""));
  const [nightAwakenings, setNightAwakenings] = useState(String(sl?.night_awakenings_per_week ?? ""));
  const [daytimeSleepiness, setDaytimeSleepiness] = useState(sl?.daytime_sleepiness ?? 3);
  const [exercise, setExercise] = useState(() => {
    const freq = ls?.exercise_frequency_per_week ?? 0;
    if (freq >= 4) return "high";
    if (freq >= 2) return "moderate";
    return "low";
  });
  const [pcHours, setPcHours] = useState(String(ls?.pc_hours_per_day ?? 0));
  const [phoneHours, setPhoneHours] = useState(String(ls?.smartphone_hours_per_day ?? 0));
  const [coffee, setCoffee] = useState(String(ls?.caffeine_cups_per_day ?? 0));
  const coffeeMg = (parseInt(coffee, 10) || 0) * CAFFEINE_MG_PER_CUP;
  const [smoking, setSmoking] = useState(() => {
    const v = ls?.smoking ?? 0;
    if (v >= 2) return "heavy";
    if (v >= 1) return "light";
    return "none";
  });
  const [alcohol, setAlcohol] = useState(() => {
    const freq = ls?.alcohol_frequency_per_week ?? 0;
    if (freq >= 3) return "high";
    if (freq >= 1) return "moderate";
    return "low";
  });
  const [appetiteScore, setAppetiteScore] = useState(profile?.nutrition_status?.appetite_level ?? 5);
  const [regularMeals, setRegularMeals] = useState(profile?.nutrition_status?.meal_regular ?? true);
  const [loading, setLoading] = useState(false);

  function addAllergy() {
    const value = allergyInput.trim();
    if (!value) return;
    if (allergies.includes(value)) {
      setAllergyInput("");
      return;
    }
    setAllergies((prev) => [...prev, value]);
    setAllergyInput("");
  }

  function removeAllergy(target: string) {
    setAllergies((prev) => prev.filter((item) => item !== target));
  }

  async function handleSave() {
    setLoading(true);
    try {
      const exerciseMap: Record<string, number> = { low: 1, moderate: 3, high: 5 };
      const smokingMap: Record<string, number> = { none: 0, light: 1, heavy: 2 };
      const alcoholMap: Record<string, number> = { low: 0, moderate: 2, high: 4 };
      const normalizedAllergies = Array.from(
        new Set(allergies.map((item) => item.trim()).filter((item) => item.length > 0)),
      );
      const payload: HealthProfileUpsertRequest = {
        basic_info: {
          height_cm: parseFloat(height) || 0,
          weight_kg: parseFloat(weight) || 0,
          drug_allergies: normalizedAllergies,
        },
        lifestyle: {
          exercise_frequency_per_week: exerciseMap[exercise] ?? 0,
          pc_hours_per_day: parseInt(pcHours) || 0,
          smartphone_hours_per_day: parseInt(phoneHours) || 0,
          caffeine_cups_per_day: parseInt(coffee, 10) || 0,
          smoking: smokingMap[smoking] ?? 0,
          alcohol_frequency_per_week: alcoholMap[alcohol] ?? 0,
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
      const currentGuideJobId = localStorage.getItem("guide_job_id");
      const currentOcrJobId = localStorage.getItem("ocr_job_id");

      try {
        if (currentGuideJobId) {
          const refreshed = await guideApi.refreshJob(currentGuideJobId, "profile_updated_from_records");
          localStorage.setItem("guide_job_id", refreshed.refreshed_job_id);
          toast.success("AI 가이드를 최신 정보로 업데이트 중입니다.");
        } else if (currentOcrJobId) {
          const created = await guideApi.createJob(currentOcrJobId);
          localStorage.setItem("guide_job_id", created.job_id);
          toast.success("AI 가이드를 생성 중입니다.");
        }
      } catch {
        // 프로필 저장은 성공했으므로 가이드 갱신 실패는 안내만 한다.
        toast.error("일상 정보는 저장되었지만 AI 가이드 갱신에 실패했습니다.");
      }

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
          <p className="text-xs font-semibold text-gray-400 uppercase">기본 정보</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">키 (cm)</label>
              <input
                type="number"
                min="100"
                max="250"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="170"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">체중 (kg)</label>
              <input
                type="number"
                min="20"
                max="300"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="65"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">약물 알레르기</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={allergyInput}
                onChange={(e) => setAllergyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAllergy())}
                placeholder="예: 페니실린"
                className={inputCls}
              />
              <button
                type="button"
                onClick={addAllergy}
                className="px-4 py-2.5 gradient-primary text-white text-xs font-semibold rounded-xl hover:shadow-md transition-all duration-200 shrink-0"
              >
                추가
              </button>
            </div>
            {allergies.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {allergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-3 py-1 rounded-full"
                  >
                    {allergy}
                    <button
                      type="button"
                      onClick={() => removeAllergy(allergy)}
                      className="ml-0.5 text-green-500 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

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
          <div>
            <label className="block text-xs text-gray-600 mb-2">운동량</label>
            <div className="flex gap-2">
              {EXERCISE_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExercise(value)}
                  className={`flex-1 py-2 rounded-xl border text-center transition-all duration-200 ${
                    exercise === value
                      ? "gradient-primary text-white border-transparent shadow-sm"
                      : "border-gray-200 text-gray-500 hover:border-green-300 bg-white/70"
                  }`}
                >
                  <p className="text-xs font-semibold">{label}</p>
                  <p className={`text-[10px] mt-0.5 ${exercise === value ? "text-green-100" : "text-gray-400"}`}>
                    {desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">PC/노트북 (시간)</label>
              <input type="number" min="0" max="24" value={pcHours} onChange={(e) => setPcHours(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">스마트폰 (시간)</label>
              <input type="number" min="0" max="24" value={phoneHours} onChange={(e) => setPhoneHours(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">커피</label>
              <div className="grid grid-cols-[minmax(0,1fr)_132px] gap-2">
                <select value={coffee} onChange={(e) => setCoffee(e.target.value)} className={inputCls}>
                  {Array.from({ length: 11 }, (_, i) => i).map((cup) => (
                    <option key={cup} value={cup}>
                      {cup}잔
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-center whitespace-nowrap text-xs font-medium tabular-nums text-gray-500">
                  카페인 함량 {coffeeMg}mg
                </div>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-2">흡연</label>
            <div className="grid grid-cols-3 gap-2">
              {SMOKING_OPTIONS.map(({ value, label }) => (
                <button key={value} type="button" onClick={() => setSmoking(value)}
                  className={`px-2 py-2 rounded-xl text-xs border transition-all duration-200 ${
                    smoking === value ? "gradient-primary text-white border-transparent font-bold" : "border-gray-200 text-gray-500"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-2">음주</label>
            <div className="grid grid-cols-3 gap-2">
              {ALCOHOL_OPTIONS.map(({ value, label }) => (
                <button key={value} type="button" onClick={() => setAlcohol(value)}
                  className={`px-2 py-2 rounded-xl text-xs border transition-all duration-200 ${
                    alcohol === value ? "gradient-primary text-white border-transparent font-bold" : "border-gray-200 text-gray-500"
                  }`}>
                  {label}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-700 text-right">{value}</span>
    </div>
  );
}

function ProfileInfoContent({
  profile,
  smokingLabel,
  alcoholLabel,
  regularMealsLabel,
}: {
  profile: HealthProfile | null;
  smokingLabel: string;
  alcoholLabel: string;
  regularMealsLabel: string;
}) {
  if (!profile) {
    return <p className="text-sm text-gray-400">온보딩 정보가 아직 없습니다.</p>;
  }

  return (
    <div className="space-y-2 text-sm text-gray-700">
      <InfoRow label="키/몸무게" value={`${profile.basic_info.height_cm}cm / ${profile.basic_info.weight_kg}kg`} />
      <InfoRow label="운동 빈도" value={`주 ${profile.lifestyle.exercise_frequency_per_week}회`} />
      <InfoRow label="PC/스마트폰" value={`${profile.lifestyle.pc_hours_per_day}h / ${profile.lifestyle.smartphone_hours_per_day}h`} />
      <InfoRow label="커피" value={`${profile.lifestyle.caffeine_cups_per_day}잔`} />
      <InfoRow label="흡연" value={smokingLabel} />
      <InfoRow label="음주" value={alcoholLabel} />
      <InfoRow label="취침/기상" value={`${profile.sleep_input.bed_time} / ${profile.sleep_input.wake_time}`} />
      <InfoRow label="식사 패턴" value={regularMealsLabel} />
    </div>
  );
}

function MobileProfileInfoSheet({
  profile,
  smokingLabel,
  alcoholLabel,
  regularMealsLabel,
  onClose,
}: {
  profile: HealthProfile | null;
  smokingLabel: string;
  alcoholLabel: string;
  regularMealsLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="입력된 일상정보 닫기"
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[82vh] rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(42,38,34,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-gray-800">입력된 일상정보</h3>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              현재 저장된 일상정보 전체를 바로 확인할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <ProfileInfoContent
              profile={profile}
              smokingLabel={smokingLabel}
              alcoholLabel={alcoholLabel}
              regularMealsLabel={regularMealsLabel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
