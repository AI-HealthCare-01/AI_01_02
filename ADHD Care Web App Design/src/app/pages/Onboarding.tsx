import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import { profileApi } from "../../lib/api";

const TOTAL_STEPS = 5;

const STEP_LABELS = [
  "기본 정보",
  "병력 사항",
  "생활습관",
  "수면 패턴",
  "영양 상태",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1 - basic_info
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  // Step 2 - medical_history
  const [underlyingDiseases, setUnderlyingDiseases] = useState<string[]>([]);
  const [psychiatricDiseases, setPsychiatricDiseases] = useState<string[]>([]);
  const [surgicalHistory, setSurgicalHistory] = useState("");
  const [drugAllergies, setDrugAllergies] = useState("");

  // Step 3 - lifestyle_input
  const [exercise, setExercise] = useState("");
  const [digitalUsage, setDigitalUsage] = useState<string[]>([]);
  const [substanceUsage, setSubstanceUsage] = useState<string[]>([]);

  // Step 4 - sleep_input
  const [bedTime, setBedTime] = useState("23:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepLatency, setSleepLatency] = useState("");
  const [nightAwakenings, setNightAwakenings] = useState("");
  const [daytimeSleepiness, setDaytimeSleepiness] = useState(5);

  // Step 5 - nutrition_input
  const [appetiteScore, setAppetiteScore] = useState(5);
  const [regularMeals, setRegularMeals] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const exerciseHoursMap: Record<string, { low_intensity: number; moderate_intensity: number; high_intensity: number }> = {
    low:      { low_intensity: 1, moderate_intensity: 0, high_intensity: 0 },
    moderate: { low_intensity: 0, moderate_intensity: 3, high_intensity: 0 },
    high:     { low_intensity: 0, moderate_intensity: 0, high_intensity: 5 },
  };

  const handleNext = async () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await profileApi.upsertHealth({
        basic_info: {
          height_cm: parseFloat(height) || 0,
          weight_kg: parseFloat(weight) || 0,
          drug_allergies: drugAllergies ? [drugAllergies] : [],
        },
        lifestyle_input: {
          exercise_hours: exerciseHoursMap[exercise] ?? { low_intensity: 0, moderate_intensity: 0, high_intensity: 0 },
          digital_usage: {
            pc_hours_per_day: digitalUsage.includes("PC/노트북") ? 4 : 0,
            smartphone_hours_per_day: digitalUsage.includes("스마트폰") ? 4 : 0,
          },
          substance_usage: {
            caffeine_cups_per_day: substanceUsage.includes("카페인") ? 2 : 0,
            smoking: substanceUsage.includes("흡연") ? 1 : 0,
            alcohol_frequency_per_week: substanceUsage.includes("음주") ? 2 : 0,
          },
        },
        sleep_input: {
          bed_time: bedTime || undefined,
          wake_time: wakeTime || undefined,
          sleep_latency_minutes: sleepLatency ? parseInt(sleepLatency) : undefined,
          night_awakenings_per_week: nightAwakenings ? parseInt(nightAwakenings) : undefined,
          daytime_sleepiness_score: daytimeSleepiness,
        },
        nutrition_input: {
          appetite_score: appetiteScore,
          is_meal_regular: regularMeals ?? undefined,
        },
      });
      navigate("/");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const toggleItem = (list: string[], setter: (v: string[]) => void, item: string) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const inputBase =
    "w-full border-2 border-[#6B8E23] rounded-xl px-4 py-3 text-[#2D3436] bg-[#FFFCF5] placeholder-[#6c6f72] focus:outline-none focus:ring-2 focus:ring-[#FFD166]";

  const ChipButton = ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
        active
          ? "bg-[#6B8E23] text-white border-[#6B8E23]"
          : "bg-white border-gray-200 text-[#6c6f72] hover:border-[#6B8E23] hover:text-[#2D3436]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#FFFCF5] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    i + 1 < step
                      ? "bg-[#6B8E23] text-white"
                      : i + 1 === step
                      ? "bg-[#6B8E23] text-white ring-4 ring-[#6B8E23]/20"
                      : "bg-gray-200 text-[#6c6f72]"
                  }`}
                >
                  {i + 1 < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs hidden md:block ${i + 1 === step ? "text-[#6B8E23] font-medium" : "text-[#6c6f72]"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-full bg-[#6B8E23] rounded-full transition-all duration-500"
              style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-[#6B8E23] font-medium">Step {step}/{TOTAL_STEPS}</span>
            <span className="text-xs text-[#6c6f72]">{Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100)}% 완료</span>
          </div>
        </div>

        <div className="bg-white border-2 border-[#6B8E23] p-8 rounded-2xl shadow-sm">

          {/* Step 1: 기본 정보 */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-1 text-[#2D3436]">기본 정보</h2>
              <p className="text-[#6c6f72] text-sm mb-6">신체 정보를 입력해주세요</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">키 (cm)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className={inputBase}
                    placeholder="170"
                    min="100"
                    max="250"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">체중 (kg)</label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className={inputBase}
                    placeholder="65"
                    min="20"
                    max="300"
                  />
                </div>
              </div>
              {height && weight && (
                <div className="mt-4 p-3 bg-[#f5f3eb] rounded-xl">
                  <p className="text-sm text-[#6c6f72]">
                    BMI:{" "}
                    <span className="font-bold text-[#2D3436]">
                      {(parseFloat(weight) / ((parseFloat(height) / 100) ** 2)).toFixed(1)}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: 병력 사항 */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-1 text-[#2D3436]">병력 사항</h2>
              <p className="text-[#6c6f72] text-sm mb-6">해당하는 항목을 선택하거나 직접 입력해주세요</p>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">기저 질환</label>
                  <div className="flex flex-wrap gap-2">
                    {["고혈압", "당뇨", "갑상선 질환", "심장 질환", "없음"].map((d) => (
                      <ChipButton
                        key={d}
                        label={d}
                        active={underlyingDiseases.includes(d)}
                        onClick={() => toggleItem(underlyingDiseases, setUnderlyingDiseases, d)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">정신건강 병력</label>
                  <div className="flex flex-wrap gap-2">
                    {["ADHD", "불안장애", "우울증", "수면장애", "없음"].map((d) => (
                      <ChipButton
                        key={d}
                        label={d}
                        active={psychiatricDiseases.includes(d)}
                        onClick={() => toggleItem(psychiatricDiseases, setPsychiatricDiseases, d)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">수술 이력 (선택)</label>
                  <input
                    type="text"
                    value={surgicalHistory}
                    onChange={(e) => setSurgicalHistory(e.target.value)}
                    className={inputBase}
                    placeholder="예: 2020년 충수염 수술"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">약물 알레르기 (선택)</label>
                  <input
                    type="text"
                    value={drugAllergies}
                    onChange={(e) => setDrugAllergies(e.target.value)}
                    className={inputBase}
                    placeholder="예: 페니실린"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 생활습관 */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-1 text-[#2D3436]">생활습관</h2>
              <p className="text-[#6c6f72] text-sm mb-6">일상 생활 패턴을 알려주세요</p>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">운동량</label>
                  <div className="flex gap-3">
                    {[
                      { value: "low", label: "낮음", desc: "주 1회 미만" },
                      { value: "moderate", label: "보통", desc: "주 2~3회" },
                      { value: "high", label: "높음", desc: "주 4회 이상" },
                    ].map(({ value, label, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setExercise(value)}
                        className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                          exercise === value
                            ? "bg-[#6B8E23] text-white border-[#6B8E23]"
                            : "bg-white border-gray-200 hover:border-[#6B8E23]"
                        }`}
                      >
                        <p className="text-sm font-bold">{label}</p>
                        <p className={`text-xs mt-0.5 ${exercise === value ? "text-[#FFFCF5] opacity-80" : "text-[#6c6f72]"}`}>{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">디지털 기기 사용</label>
                  <div className="flex flex-wrap gap-2">
                    {["PC/노트북", "스마트폰"].map((d) => (
                      <ChipButton
                        key={d}
                        label={d}
                        active={digitalUsage.includes(d)}
                        onClick={() => toggleItem(digitalUsage, setDigitalUsage, d)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">물질 사용 여부</label>
                  <div className="flex flex-wrap gap-2">
                    {["카페인", "흡연", "음주"].map((s) => (
                      <ChipButton
                        key={s}
                        label={s}
                        active={substanceUsage.includes(s)}
                        onClick={() => toggleItem(substanceUsage, setSubstanceUsage, s)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: 수면 패턴 */}
          {step === 4 && (
            <div>
              <h2 className="text-2xl font-bold mb-1 text-[#2D3436]">수면 패턴</h2>
              <p className="text-[#6c6f72] text-sm mb-6">수면 습관을 알려주세요</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">평균 취침 시간</label>
                    <input type="time" value={bedTime} onChange={(e) => setBedTime(e.target.value)} className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">평균 기상 시간</label>
                    <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className={inputBase} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">수면 잠들기까지 걸리는 시간 (분)</label>
                  <input
                    type="number"
                    value={sleepLatency}
                    onChange={(e) => setSleepLatency(e.target.value)}
                    className={inputBase}
                    placeholder="예: 30"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">밤새 깨는 횟수</label>
                  <input
                    type="number"
                    value={nightAwakenings}
                    onChange={(e) => setNightAwakenings(e.target.value)}
                    className={inputBase}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-sm font-medium text-[#2D3436]">낮 졸림 정도</label>
                    <span className="text-sm font-bold text-[#6B8E23]">{daytimeSleepiness} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={daytimeSleepiness}
                    onChange={(e) => setDaytimeSleepiness(Number(e.target.value))}
                    className="w-full accent-[#6B8E23]"
                  />
                  <div className="flex justify-between text-xs text-[#6c6f72] mt-1">
                    <span>전혀 없음</span>
                    <span>매우 심함</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: 영양 상태 */}
          {step === 5 && (
            <div>
              <h2 className="text-2xl font-bold mb-1 text-[#2D3436]">영양 상태</h2>
              <p className="text-[#6c6f72] text-sm mb-6">식사 습관을 알려주세요</p>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-sm font-medium text-[#2D3436]">식욕 점수</label>
                    <span className="text-sm font-bold text-[#6B8E23]">{appetiteScore} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={appetiteScore}
                    onChange={(e) => setAppetiteScore(Number(e.target.value))}
                    className="w-full accent-[#6B8E23]"
                  />
                  <div className="flex justify-between text-xs text-[#6c6f72] mt-1">
                    <span>매우 낮음</span>
                    <span>매우 높음</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">규칙적인 식사</label>
                  <div className="flex gap-3">
                    {[
                      { value: true, label: "예", desc: "매일 정해진 시간에 식사" },
                      { value: false, label: "아니오", desc: "불규칙한 식사 패턴" },
                    ].map(({ value, label, desc }) => (
                      <button
                        key={String(value)}
                        type="button"
                        onClick={() => setRegularMeals(value)}
                        className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                          regularMeals === value
                            ? "bg-[#6B8E23] text-white border-[#6B8E23]"
                            : "bg-white border-gray-200 hover:border-[#6B8E23]"
                        }`}
                      >
                        <p className="font-bold">{label}</p>
                        <p className={`text-xs mt-1 ${regularMeals === value ? "text-[#FFFCF5] opacity-80" : "text-[#6c6f72]"}`}>{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-[#f5f3eb] p-4 rounded-xl">
                  <p className="text-sm font-medium text-[#2D3436] mb-1">거의 다 완료되었습니다! 🎉</p>
                  <p className="text-xs text-[#6c6f72]">
                    입력하신 정보를 바탕으로 개인 맞춤형 복약 가이드와 AI 코치가 제공됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          {submitError && (
            <p className="mt-4 text-sm text-red-500 text-center">{submitError}</p>
          )}
          <div className="flex justify-between mt-8 gap-4">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${
                step === 1
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-[#2D3436] hover:bg-[#f5f3eb]"
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              이전
            </button>
            <button
              onClick={handleNext}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 bg-[#6B8E23] text-white rounded-xl hover:bg-[#556b1c] transition-colors font-medium disabled:opacity-60"
            >
              {submitting ? "저장 중..." : step === TOTAL_STEPS ? "완료" : "다음"}
              {!submitting && <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
