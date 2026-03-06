import { useState } from "react";
import { useNavigate } from "react-router";
import OnboardingShell from "./OnboardingShell";

const EXERCISE_OPTIONS = [
  { value: "low", label: "낮음", desc: "주 1회 미만" },
  { value: "moderate", label: "보통", desc: "주 2~3회" },
  { value: "high", label: "높음", desc: "주 4회 이상" },
];

const SUBSTANCE_OPTIONS = ["카페인", "흡연", "음주"];

export default function Lifestyle() {
  const navigate = useNavigate();
  const [exercise, setExercise] = useState("");
  const [pcHours, setPcHours] = useState("");
  const [phoneHours, setPhoneHours] = useState("");
  const [substances, setSubstances] = useState<string[]>([]);

  function toggle(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  function handleNext() {
    const exerciseMap: Record<string, { low_intensity: number; moderate_intensity: number; high_intensity: number }> = {
      low: { low_intensity: 1, moderate_intensity: 0, high_intensity: 0 },
      moderate: { low_intensity: 0, moderate_intensity: 3, high_intensity: 0 },
      high: { low_intensity: 0, moderate_intensity: 0, high_intensity: 5 },
    };
    sessionStorage.setItem(
      "onboarding_lifestyle",
      JSON.stringify({
        exercise_hours: exerciseMap[exercise] ?? { low_intensity: 0, moderate_intensity: 0, high_intensity: 0 },
        digital_usage: {
          pc_hours_per_day: parseFloat(pcHours) || 0,
          smartphone_hours_per_day: parseFloat(phoneHours) || 0,
        },
        substance_usage: {
          caffeine_cups_per_day: substances.includes("카페인") ? 2 : 0,
          smoking: substances.includes("흡연") ? 1 : 0,
          alcohol_frequency_per_week: substances.includes("음주") ? 2 : 0,
        },
      }),
    );
    navigate("/onboarding/sleep");
  }

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

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
                className={`flex-1 py-3 rounded-lg border text-center transition-colors ${
                  exercise === value
                    ? "bg-green-600 text-white border-green-600"
                    : "border-gray-200 text-gray-500 hover:border-green-400"
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
              <label className="block text-xs text-gray-500 mb-1">PC/노트북 (시간)</label>
              <input
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
              <label className="block text-xs text-gray-500 mb-1">스마트폰 (시간)</label>
              <input
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
          <div className="flex gap-2">
            {SUBSTANCE_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle(substances, setSubstances, s)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  substances.includes(s)
                    ? "bg-green-600 text-white border-green-600"
                    : "border-gray-200 text-gray-500 hover:border-green-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={() => navigate("/onboarding")}
          className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          이전
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          다음 단계
        </button>
      </div>
    </OnboardingShell>
  );
}
