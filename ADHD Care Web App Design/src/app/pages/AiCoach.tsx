import { useNavigate } from "react-router";
import {
  Brain,
  TriangleAlert,
  Pill,
  HeartPulse,
  ShieldAlert,
  MessageCircle,
  FileText,
  CheckCircle,
} from "lucide-react";

export default function AiCoach() {
  const navigate = useNavigate();

  const medicationGuidance = [
    "메틸페니데이트 18mg: 아침 식후 고정 복용, 복용 시각 편차는 1시간 이내 유지",
    "아토목세틴 40mg: 저녁 식후 복용, 복용 누락 시 임의 증량 금지",
    "카페인은 복용 직후보다 2시간 이후 섭취 권장",
  ];

  const lifestyleGuidance = [
    "취침 2시간 전 스마트폰 사용량 줄이기",
    "주 3회 이상 중강도 운동 30분 유지",
    "수분 섭취를 일정하게 유지하고 공복 복용 회피",
  ];

  const cautions = [
    "두근거림/불면/식욕저하가 지속되면 의료진 상담 필요",
    "약물 병용 시 상호작용 위험이 있으므로 자의 조정 금지",
    "복약 중단/증량/감량 판단은 진료 후 결정",
  ];

  const riskFlags = [
    { label: "수면 부족", value: "주의", color: "text-[#a73a36] bg-[#ffe9e8]" },
    { label: "카페인 과다", value: "관찰", color: "text-[#8a6510] bg-[#fff5d6]" },
    { label: "복약 준수율", value: "양호", color: "text-[#156f6a] bg-[#dcf7f5]" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-[#2D3436]">LLM 기반 안내 가이드</h1>
        <p className="text-[#6c6f72]">프로필 + OCR 처방 정보 + 근거 문서를 결합한 구조화 가이드</p>
      </div>

      <div className="bg-[#20B2AA] text-white p-6 rounded-2xl mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
              <Brain className="w-6 h-6 text-[#20B2AA]" />
            </div>
            <div>
              <h2 className="font-bold text-lg">가이드 생성 상태: SUCCEEDED</h2>
              <p className="text-sm text-[#FFFCF5] opacity-90">생성 시각: 2026-02-24 09:42 · ocr_job_id: 148</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/chat")}
            className="bg-[#FFD166] text-[#2D3436] px-4 py-2 rounded-lg font-medium hover:bg-[#ffc84d] transition-colors flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            실시간 챗봇으로 질문하기
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-5 h-5 text-[#20B2AA]" />
            <h2 className="text-xl font-bold text-[#2D3436]">복약 안내</h2>
          </div>
          <ul className="space-y-2 text-sm text-[#2D3436]">
            {medicationGuidance.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 text-[#20B2AA]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <HeartPulse className="w-5 h-5 text-[#20B2AA]" />
            <h2 className="text-xl font-bold text-[#2D3436]">생활습관 가이드</h2>
          </div>
          <ul className="space-y-2 text-sm text-[#2D3436]">
            {lifestyleGuidance.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 text-[#20B2AA]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-[#20B2AA]" />
            <h2 className="text-xl font-bold text-[#2D3436]">주의사항</h2>
          </div>
          <ul className="space-y-2 text-sm text-[#2D3436]">
            {cautions.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 mt-0.5 text-[#a73a36]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#FFD166] p-6 rounded-2xl text-[#2D3436]">
          <h3 className="font-bold mb-3">의료진 상담 고지</h3>
          <p className="text-sm leading-relaxed opacity-90">
            본 가이드는 의료진 진료를 대체하지 않습니다. 증상 악화, 부작용 지속, 복약 변경 필요 시 반드시 의료진과 상담하세요.
          </p>
        </div>

        <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
          <h3 className="font-bold text-[#2D3436] mb-3">위험도/플래그</h3>
          <div className="space-y-2 mb-4">
            {riskFlags.map((flag) => (
              <div key={flag.label} className="flex items-center justify-between">
                <span className="text-sm text-[#2D3436]">{flag.label}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${flag.color}`}>{flag.value}</span>
              </div>
            ))}
          </div>

          <h3 className="font-bold text-[#2D3436] mb-2">근거 출처</h3>
          <a
            href="https://www.nimh.nih.gov"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[#156f6a] hover:underline flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            NIMH ADHD Medication Guidance
          </a>
        </div>
      </div>
    </div>
  );
}
