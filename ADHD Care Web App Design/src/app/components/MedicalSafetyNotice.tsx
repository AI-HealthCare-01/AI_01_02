import { Shield } from "lucide-react";

export default function MedicalSafetyNotice() {
  return (
    <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl flex items-start gap-3">
      <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-amber-700 mb-0.5">의료 안전 고지</p>
        <p className="text-sm text-amber-600 leading-relaxed">
          이 가이드는 AI가 생성한 일반적인 정보로, 의료 전문가의 진단 또는 처방을 대체하지 않습니다. 건강 이상이나 부작용이 느껴질 때는 즉시 담당 의사 또는 약사에게 문의하세요.
        </p>
      </div>
    </div>
  );
}
