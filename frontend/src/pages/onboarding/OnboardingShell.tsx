import { Check } from "lucide-react";

const STEPS = ["기본 정보", "생활 습관", "수면 패턴"];

interface Props {
  step: number; // 1-3
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function OnboardingShell({ step, title, subtitle, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-green-600 tracking-tight">logly</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((label, i) => {
            const num = i + 1;
            const done = num < step;
            const active = num === step;
            return (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done
                        ? "bg-green-600 text-white"
                        : active
                          ? "bg-green-600 text-white ring-4 ring-green-100"
                          : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" /> : num}
                  </div>
                  <span
                    className={`text-xs mt-1 font-medium ${active ? "text-green-600" : "text-gray-400"}`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-16 h-0.5 mb-5 mx-1 ${num < step ? "bg-green-600" : "bg-gray-200"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-1">{title}</h2>
          <p className="text-sm text-gray-400 mb-6">{subtitle}</p>
          {children}
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">
          {step} / {STEPS.length} 단계 완료
        </p>
      </div>
    </div>
  );
}
