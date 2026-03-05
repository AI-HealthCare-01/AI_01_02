import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import OnboardingShell from "./OnboardingShell";
import { profileApi, HealthProfileUpsertRequest } from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";

export default function Sleep() {
  const navigate = useNavigate();
  const [bedTime, setBedTime] = useState("23:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepLatency, setSleepLatency] = useState("");
  const [nightAwakenings, setNightAwakenings] = useState("");
  const [daytimeSleepiness, setDaytimeSleepiness] = useState(3);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const basic = JSON.parse(sessionStorage.getItem("onboarding_basic") ?? "{}");
      const lifestyle = JSON.parse(sessionStorage.getItem("onboarding_lifestyle") ?? "{}");

      const payload: HealthProfileUpsertRequest = {
        basic_info: basic,
        lifestyle_input: lifestyle,
        sleep_input: {
          bed_time: bedTime || undefined,
          wake_time: wakeTime || undefined,
          sleep_latency_minutes: sleepLatency ? parseInt(sleepLatency) : undefined,
          night_awakenings_per_week: nightAwakenings ? parseInt(nightAwakenings) : undefined,
          daytime_sleepiness_score: daytimeSleepiness,
        },
        nutrition_input: { appetite_score: 5, is_meal_regular: true },
      };

      await profileApi.upsertHealth(payload);
      sessionStorage.removeItem("onboarding_basic");
      sessionStorage.removeItem("onboarding_lifestyle");
      navigate("/onboarding/scan");
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

  return (
    <OnboardingShell step={3} title="수면 패턴" subtitle="수면 습관을 알려주세요">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">평균 취침 시간</label>
            <input
              type="time"
              value={bedTime}
              onChange={(e) => setBedTime(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">평균 기상 시간</label>
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              잠들기까지 걸리는 시간 (분)
            </label>
            <input
              type="number"
              value={sleepLatency}
              onChange={(e) => setSleepLatency(e.target.value)}
              placeholder="30"
              min="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              밤새 깨는 횟수 (회/주)
            </label>
            <input
              type="number"
              value={nightAwakenings}
              onChange={(e) => setNightAwakenings(e.target.value)}
              placeholder="0"
              min="0"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">낮 졸림 정도</label>
            <span className="text-sm font-bold text-green-600">{daytimeSleepiness} / 10</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={daytimeSleepiness}
            onChange={(e) => setDaytimeSleepiness(Number(e.target.value))}
            className="w-full accent-green-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>전혀 없음</span>
            <span>매우 심함</span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={() => navigate("/onboarding/lifestyle")}
          className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          이전
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          {loading ? "저장 중..." : "다음 단계 →"}
        </button>
      </div>
    </OnboardingShell>
  );
}
