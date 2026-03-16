import { useState } from "react";
import { useNavigate } from "react-router";
import OnboardingShell from "./OnboardingShell";

const CAFFEINE_MG_PER_CUP = 150;

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

export default function Lifestyle() {
  const navigate = useNavigate();
  const [exercise, setExercise] = useState("");
  const [pcHours, setPcHours] = useState("");
  const [phoneHours, setPhoneHours] = useState("");
  const [caffeineCups, setCaffeineCups] = useState("0");
  const [smoking, setSmoking] = useState("none");
  const [alcohol, setAlcohol] = useState("low");
  const caffeineMg = (parseInt(caffeineCups, 10) || 0) * CAFFEINE_MG_PER_CUP;

  const pcNum = pcHours ? parseInt(pcHours) : 0;
  const phoneNum = phoneHours ? parseInt(phoneHours) : 0;
  const pcValid = !pcHours || (pcNum >= 0 && pcNum <= 24);
  const phoneValid = !phoneHours || (phoneNum >= 0 && phoneNum <= 24);
  const canSubmit = pcValid && phoneValid;

  function handleNext() {
    const exerciseMap: Record<string, number> = {
      low: 1,
      moderate: 3,
      high: 5,
    };
    const smokingMap: Record<string, number> = {
      none: 0,
      light: 1,
      heavy: 2,
    };
    const alcoholMap: Record<string, number> = {
      low: 0,
      moderate: 2,
      high: 4,
    };
    sessionStorage.setItem(
      "onboarding_lifestyle",
      JSON.stringify({
        exercise_frequency_per_week: exerciseMap[exercise] ?? 0,
        pc_hours_per_day: parseInt(pcHours) || 0,
        smartphone_hours_per_day: parseInt(phoneHours) || 0,
        caffeine_cups_per_day: parseInt(caffeineCups, 10) || 0,
        smoking: smokingMap[smoking] ?? 0,
        alcohol_frequency_per_week: alcoholMap[alcohol] ?? 0,
      }),
    );
    navigate("/onboarding/sleep");
  }

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400 transition-all duration-200";

  return (
    <OnboardingShell step={2} title="생활 습관" subtitle="일상 생활 패턴을 알려주세요">
      <div className="space-y-6">
        {/* Exercise */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">운동량</label>
          <div className="flex gap-3">
            {EXERCISE_OPTIONS.map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setExercise(value)}
                className={`flex-1 py-3 rounded-xl border text-center transition-all duration-200 ${
                  exercise === value
                    ? "gradient-primary text-white border-transparent shadow-sm"
                    : "border-gray-200 text-gray-500 hover:border-green-300 bg-white/70"
                }`}
              >
                <p className="text-sm font-semibold">{label}</p>
                <p className={`text-xs mt-0.5 ${exercise === value ? "text-green-100" : "text-gray-400"}`}>
                  {desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Digital usage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">디지털 기기 사용 (일 평균)</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pcHours" className="block text-xs text-gray-500 mb-1">PC/노트북 (시간)</label>
              <input
                id="pcHours"
                type="number"
                value={pcHours}
                onChange={(e) => setPcHours(e.target.value)}
                placeholder="4"
                min="0"
                max="24"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="phoneHours" className="block text-xs text-gray-500 mb-1">스마트폰 (시간)</label>
              <input
                id="phoneHours"
                type="number"
                value={phoneHours}
                onChange={(e) => setPhoneHours(e.target.value)}
                placeholder="3"
                min="0"
                max="24"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Substances */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">물질 사용 여부</label>
          <div className="space-y-4">
            <div>
              <label htmlFor="caffeineCups" className="block text-xs text-gray-500 mb-1">커피</label>
              <div className="grid grid-cols-[minmax(0,1fr)_132px] gap-2">
                <select
                  id="caffeineCups"
                  value={caffeineCups}
                  onChange={(e) => setCaffeineCups(e.target.value)}
                  className={inputCls}
                >
                  {Array.from({ length: 11 }, (_, i) => i).map((cup) => (
                    <option key={cup} value={cup}>
                      {cup}잔
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-center whitespace-nowrap text-xs font-medium tabular-nums text-gray-500">
                  카페인 함량 {caffeineMg}mg
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">흡연</label>
              <div className="grid grid-cols-3 gap-2">
                {SMOKING_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSmoking(value)}
                    className={`px-3 py-2 rounded-xl text-xs md:text-sm font-semibold border text-center transition-all duration-200 ${
                      smoking === value
                        ? "gradient-primary text-white border-transparent shadow-sm"
                        : "border-gray-200 text-gray-500 hover:border-green-300 bg-white/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">음주</label>
              <div className="grid grid-cols-3 gap-2">
                {ALCOHOL_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAlcohol(value)}
                    className={`px-3 py-2 rounded-xl text-xs md:text-sm font-semibold border text-center transition-all duration-200 ${
                      alcohol === value
                        ? "gradient-primary text-white border-transparent shadow-sm"
                        : "border-gray-200 text-gray-500 hover:border-green-300 bg-white/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-end gap-1.5">
        {!pcValid && (
          <p className="text-xs text-red-500">PC/노트북 사용 시간은 0~24시간 범위로 입력해주세요.</p>
        )}
        {!phoneValid && (
          <p className="text-xs text-red-500">스마트폰 사용 시간은 0~24시간 범위로 입력해주세요.</p>
        )}
        <div className="w-full flex justify-between">
          <button
            type="button"
            onClick={() => navigate("/onboarding")}
            className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            이전
          </button>
          <button
            onClick={handleNext}
            disabled={!canSubmit}
            className="px-6 py-2.5 gradient-primary text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            다음 단계
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
