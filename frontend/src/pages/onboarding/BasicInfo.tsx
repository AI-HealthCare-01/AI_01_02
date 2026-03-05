import { useState } from "react";
import { useNavigate } from "react-router";
import OnboardingShell from "./OnboardingShell";

export default function BasicInfo() {
  const navigate = useNavigate();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [allergyInput, setAllergyInput] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);

  function addAllergy() {
    const v = allergyInput.trim();
    if (v && !allergies.includes(v)) setAllergies((a) => [...a, v]);
    setAllergyInput("");
  }

  function removeAllergy(a: string) {
    setAllergies((list) => list.filter((x) => x !== a));
  }

  function handleNext() {
    sessionStorage.setItem(
      "onboarding_basic",
      JSON.stringify({
        height_cm: parseFloat(height) || 0,
        weight_kg: parseFloat(weight) || 0,
        drug_allergies: allergies,
      }),
    );
    navigate("/onboarding/lifestyle");
  }

  const bmi =
    height && weight
      ? (parseFloat(weight) / (parseFloat(height) / 100) ** 2).toFixed(1)
      : null;

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

  return (
    <OnboardingShell step={1} title="기본 정보" subtitle="신체 정보를 입력해주세요">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">키 (cm)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="170"
              min="100"
              max="250"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">체중 (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="65"
              min="20"
              max="300"
              className={inputCls}
            />
          </div>
        </div>

        {bmi && (
          <div className="bg-green-50 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">BMI</span>
            <span className="text-sm font-bold text-green-700">{bmi}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            약물 알레르기 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
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
              className="px-4 py-2.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors shrink-0"
            >
              추가
            </button>
          </div>
          {allergies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {allergies.map((a) => (
                <span
                  key={a}
                  className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-3 py-1 rounded-full"
                >
                  {a}
                  <button
                    type="button"
                    onClick={() => removeAllergy(a)}
                    className="ml-0.5 text-green-500 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
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
