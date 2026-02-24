import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, ChevronLeft } from "lucide-react";

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [formData, setFormData] = useState({
    heightCm: "",
    weightKg: "",
    underlyingDiseases: "",
    psychiatricDiseases: "",
    surgicalHistory: "",
    drugAllergies: "",
    exerciseLow: "",
    exerciseModerate: "",
    exerciseHigh: "",
    pcHoursPerDay: "",
    smartphoneHoursPerDay: "",
    caffeineCupsPerDay: "",
    smoking: "0",
    alcoholFrequencyPerWeek: "",
    bedTime: "",
    wakeTime: "",
    sleepLatencyMinutes: "",
    nightAwakeningsPerWeek: "",
    daytimeSleepinessScore: "",
    appetiteScore: "",
    isMealRegular: "",
  });

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      const toList = (value: string) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      const payload = {
        basic_info: {
          height_cm: Number(formData.heightCm),
          weight_kg: Number(formData.weightKg),
        },
        medical_history: {
          underlying_diseases: toList(formData.underlyingDiseases),
          psychiatric_diseases: toList(formData.psychiatricDiseases),
          surgical_history: toList(formData.surgicalHistory),
          drug_allergies: toList(formData.drugAllergies),
        },
        lifestyle_input: {
          exercise_hours: {
            low_intensity: Number(formData.exerciseLow || 0),
            moderate_intensity: Number(formData.exerciseModerate || 0),
            high_intensity: Number(formData.exerciseHigh || 0),
          },
          digital_usage: {
            pc_hours_per_day: Number(formData.pcHoursPerDay || 0),
            smartphone_hours_per_day: Number(formData.smartphoneHoursPerDay || 0),
          },
          substance_usage: {
            caffeine_cups_per_day: Number(formData.caffeineCupsPerDay || 0),
            smoking: Number(formData.smoking || 0),
            alcohol_frequency_per_week: Number(formData.alcoholFrequencyPerWeek || 0),
          },
        },
        sleep_input: {
          bed_time: formData.bedTime,
          wake_time: formData.wakeTime,
          sleep_latency_minutes: Number(formData.sleepLatencyMinutes || 0),
          night_awakenings_per_week: Number(formData.nightAwakeningsPerWeek || 0),
          daytime_sleepiness_score: Number(formData.daytimeSleepinessScore || 0),
        },
        nutrition_input: {
          appetite_score: Number(formData.appetiteScore || 0),
          is_meal_regular: formData.isMealRegular === "true",
        },
      };
      console.log("health profile payload", payload);
      navigate("/ocr-scan");
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFCF5] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-[#2D3436]">
              Step {step} of {totalSteps}
            </span>
            <span className="text-sm text-[#6c6f72]">{Math.round((step / totalSteps) * 100)}%</span>
          </div>
          <div className="h-2 bg-[#f5f3eb] rounded-full">
            <div
              className="h-full bg-[#20B2AA] rounded-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white border-2 border-[#20B2AA] p-8 rounded-2xl">
          {step === 1 && (
            <div>
              <h2 className="text-3xl font-bold mb-2 text-[#2D3436]">기본 건강 정보</h2>
              <p className="text-[#6c6f72] mb-6">프로필의 basic_info 스키마에 맞춰 입력합니다</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">키 (cm)</label>
                    <input
                      type="number"
                      value={formData.heightCm}
                      onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FFD166] bg-[#FFFCF5] text-[#2D3436]"
                      placeholder="170"
                      min="50"
                      max="230"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">체중 (kg)</label>
                    <input
                      type="number"
                      value={formData.weightKg}
                      onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FFD166] bg-[#FFFCF5] text-[#2D3436]"
                      placeholder="62"
                      min="10"
                      max="300"
                      required
                    />
                  </div>
                </div>

                <p className="text-sm text-[#6c6f72]">
                  이후 단계에서 병력, 생활습관, 수면, 영양 입력을 순차적으로 완료합니다.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-3xl font-bold mb-2 text-[#2D3436]">병력 정보</h2>
              <p className="text-[#6c6f72] mb-6">쉼표(,)로 구분해 입력하면 배열 필드로 저장됩니다</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">기저질환</label>
                  <input
                    value={formData.underlyingDiseases}
                    onChange={(e) => setFormData({ ...formData, underlyingDiseases: e.target.value })}
                    className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                    placeholder="천식, 비염"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">정신과 병력</label>
                  <input
                    value={formData.psychiatricDiseases}
                    onChange={(e) => setFormData({ ...formData, psychiatricDiseases: e.target.value })}
                    className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                    placeholder="우울장애"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">수술 이력</label>
                  <input
                    value={formData.surgicalHistory}
                    onChange={(e) => setFormData({ ...formData, surgicalHistory: e.target.value })}
                    className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                    placeholder="편도 절제술"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">약물 알러지</label>
                  <input
                    value={formData.drugAllergies}
                    onChange={(e) => setFormData({ ...formData, drugAllergies: e.target.value })}
                    className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                    placeholder="페니실린"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-3xl font-bold mb-2 text-[#2D3436]">생활 습관</h2>
              <p className="text-[#6c6f72] mb-6">exercise, digital, substance 입력을 시간/횟수 기준으로 기입합니다</p>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">저강도 운동(주)</label>
                    <input
                      type="number"
                      value={formData.exerciseLow}
                      onChange={(e) => setFormData({ ...formData, exerciseLow: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                      placeholder="2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">중강도 운동(주)</label>
                    <input
                      type="number"
                      value={formData.exerciseModerate}
                      onChange={(e) => setFormData({ ...formData, exerciseModerate: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">고강도 운동(주)</label>
                    <input
                      type="number"
                      value={formData.exerciseHigh}
                      onChange={(e) => setFormData({ ...formData, exerciseHigh: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">PC 사용 시간(일)</label>
                  <input
                    type="number"
                    value={formData.pcHoursPerDay}
                    onChange={(e) => setFormData({ ...formData, pcHoursPerDay: e.target.value })}
                    className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                    placeholder="4"
                    min="0"
                    max="24"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">스마트폰 사용 시간(일)</label>
                  <input
                    type="number"
                    value={formData.smartphoneHoursPerDay}
                    onChange={(e) => setFormData({ ...formData, smartphoneHoursPerDay: e.target.value })}
                    className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                    placeholder="5"
                    min="0"
                    max="24"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">카페인(잔/일)</label>
                    <input
                      type="number"
                      value={formData.caffeineCupsPerDay}
                      onChange={(e) => setFormData({ ...formData, caffeineCupsPerDay: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                      placeholder="2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">흡연(개비/일)</label>
                    <input
                      type="number"
                      value={formData.smoking}
                      onChange={(e) => setFormData({ ...formData, smoking: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">음주(회/주)</label>
                    <input
                      type="number"
                      value={formData.alcoholFrequencyPerWeek}
                      onChange={(e) => setFormData({ ...formData, alcoholFrequencyPerWeek: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-3xl font-bold mb-2 text-[#2D3436]">수면 패턴</h2>
              <p className="text-[#6c6f72] mb-6">취침/기상 시각과 수면 질 지표를 입력합니다</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">취침 시각</label>
                    <input
                      type="time"
                      value={formData.bedTime}
                      onChange={(e) => setFormData({ ...formData, bedTime: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">기상 시각</label>
                    <input
                      type="time"
                      value={formData.wakeTime}
                      onChange={(e) => setFormData({ ...formData, wakeTime: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">입면 지연(분)</label>
                    <input
                      type="number"
                      value={formData.sleepLatencyMinutes}
                      onChange={(e) => setFormData({ ...formData, sleepLatencyMinutes: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                      placeholder="20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">주간 각성 횟수</label>
                    <input
                      type="number"
                      value={formData.nightAwakeningsPerWeek}
                      onChange={(e) => setFormData({ ...formData, nightAwakeningsPerWeek: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                      placeholder="2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[#2D3436]">주간 졸림(0~10)</label>
                    <input
                      type="number"
                      value={formData.daytimeSleepinessScore}
                      onChange={(e) => setFormData({ ...formData, daytimeSleepinessScore: e.target.value })}
                      className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                      min="0"
                      max="10"
                      placeholder="4"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-3xl font-bold mb-2 text-[#2D3436]">영양/식사 정보</h2>
              <p className="text-[#6c6f72] mb-6">최종 저장 전 nutrition_input 필드를 확인합니다</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">식욕 점수 (0~10)</label>
                  <input
                    type="number"
                    value={formData.appetiteScore}
                    onChange={(e) => setFormData({ ...formData, appetiteScore: e.target.value })}
                    className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                    min="0"
                    max="10"
                    placeholder="6"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#2D3436]">식사 규칙성</label>
                  <select
                    value={formData.isMealRegular}
                    onChange={(e) => setFormData({ ...formData, isMealRegular: e.target.value })}
                    className="w-full border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-[#FFFCF5] text-[#2D3436]"
                    required
                  >
                    <option value="">선택</option>
                    <option value="true">규칙적</option>
                    <option value="false">불규칙</option>
                  </select>
                </div>
                <div className="bg-[#FFFCF5] border-2 border-[#20B2AA] rounded-lg p-4 text-sm text-[#6c6f72]">
                  완료 시 /users/health-profile payload 형태를 콘솔로 확인한 뒤 OCR 단계로 이동합니다.
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <button
              onClick={handleBack}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                step === 1 ? "text-[#6c6f72] cursor-not-allowed" : "text-[#2D3436] hover:bg-[#f5f3eb]"
              }`}
              disabled={step === 1}
            >
              <ChevronLeft className="w-5 h-5" />
              이전
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-[#20B2AA] text-white rounded-lg font-medium hover:bg-[#1a8f89] transition-colors"
            >
              {step === totalSteps ? "완료" : "다음"}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
