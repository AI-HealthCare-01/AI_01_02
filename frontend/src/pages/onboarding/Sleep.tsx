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

  const latencyNum = sleepLatency ? parseInt(sleepLatency) : 0;
  const awakeningsNum = nightAwakenings ? parseInt(nightAwakenings) : 0;
  const latencyValid = !sleepLatency || (latencyNum >= 0 && latencyNum <= 720);
  const awakeningsValid = !nightAwakenings || (awakeningsNum >= 0 && awakeningsNum <= 70);
  const canSubmit = latencyValid && awakeningsValid && !loading;

  async function handleSubmit() {
    setLoading(true);
    try {
      const basic = JSON.parse(sessionStorage.getItem("onboarding_basic") ?? "{}");
      const lifestyle = JSON.parse(sessionStorage.getItem("onboarding_lifestyle") ?? "{}");

      const payload: HealthProfileUpsertRequest = {
        basic_info: basic,
        lifestyle: {
          exercise_frequency_per_week: lifestyle.exercise_frequency_per_week ?? 0,
          pc_hours_per_day: lifestyle.pc_hours_per_day ?? 0,
          smartphone_hours_per_day: lifestyle.smartphone_hours_per_day ?? 0,
          caffeine_cups_per_day: lifestyle.caffeine_cups_per_day ?? 0,
          smoking: lifestyle.smoking ?? 0,
          alcohol_frequency_per_week: lifestyle.alcohol_frequency_per_week ?? 0,
        },
        sleep_input: {
          bed_time: bedTime,
          wake_time: wakeTime,
          sleep_latency_minutes: sleepLatency ? parseInt(sleepLatency) : 0,
          night_awakenings_per_week: nightAwakenings ? parseInt(nightAwakenings) : 0,
          daytime_sleepiness: daytimeSleepiness,
        },
        nutrition_status: { appetite_level: 5, meal_regular: true },
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
    "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400 transition-all duration-200";

  return (
    <OnboardingShell step={3} title="수면 패턴" subtitle="수면 습관을 알려주세요">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="bedTime" className="block text-sm font-medium text-gray-700 mb-1.5">평균 취침 시간</label>
            <input
              id="bedTime"
              type="time"
              value={bedTime}
              onChange={(e) => setBedTime(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="wakeTime" className="block text-sm font-medium text-gray-700 mb-1.5">평균 기상 시간</label>
            <input
              id="wakeTime"
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sleepLatency" className="block text-sm font-medium text-gray-700 mb-1.5">
              잠들기까지 걸리는 시간 (분)
            </label>
            <input
              id="sleepLatency"
              type="number"
              value={sleepLatency}
              onChange={(e) => setSleepLatency(e.target.value)}
              placeholder="30"
              min="0"
              max="720"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="nightAwakenings" className="block text-sm font-medium text-gray-700 mb-1.5">
              밤새 깨는 횟수 (회/주)
            </label>
            <input
              id="nightAwakenings"
              type="number"
              value={nightAwakenings}
              onChange={(e) => setNightAwakenings(e.target.value)}
              placeholder="0"
              min="0"
              max="70"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label htmlFor="daytimeSleepiness" className="text-sm font-medium text-gray-700">낮 졸림 정도</label>
            <span className="text-sm font-bold text-green-600">{daytimeSleepiness} / 10</span>
          </div>
          <input
            id="daytimeSleepiness"
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

      <div className="mt-8 flex flex-col items-end gap-1.5">
        {!latencyValid && (
          <p className="text-xs text-red-500">잠들기까지 걸리는 시간은 0~720분 범위로 입력해주세요.</p>
        )}
        {!awakeningsValid && (
          <p className="text-xs text-red-500">밤새 깨는 횟수는 0~70회 범위로 입력해주세요.</p>
        )}
        <div className="w-full flex justify-between">
          <button
            type="button"
            onClick={() => navigate("/onboarding/lifestyle")}
            className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            이전
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-6 py-2.5 gradient-primary text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {loading ? "저장 중..." : "다음 단계 →"}
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
