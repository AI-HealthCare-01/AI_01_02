import { useState, useEffect } from "react";
import {
  Brain,
  Pill,
  Activity,
  AlertTriangle,
  BookOpen,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ExternalLink,
  ScanLine,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router";
import { guideApi, GuideJobResult, GuideStatus } from "../../lib/api";
import MedicalSafetyNotice from "../components/MedicalSafetyNotice";

type PageState = "loading" | "no_prescription" | "pending" | "loaded" | "error";

export default function AiGuide() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [guideResult, setGuideResult] = useState<GuideJobResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    medication: true,
    lifestyle: false,
    caution: false,
  });
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const jobId = localStorage.getItem("guide_job_id");
    if (!jobId) {
      setPageState("no_prescription");
      return;
    }
    loadGuide(jobId);
  }, []);

  const loadGuide = async (jobId: string) => {
    setPageState("loading");
    try {
      // Check status first
      const status = await guideApi.getJobStatus(jobId);
      if (status.status === "COMPLETED") {
        const result = await guideApi.getJobResult(jobId);
        setGuideResult(result);
        setPageState("loaded");
      } else if (status.status === "FAILED") {
        setErrorMsg(status.error_message ?? "가이드 생성에 실패했습니다.");
        setPageState("error");
      } else {
        // QUEUED or PROCESSING - poll
        setPageState("pending");
        pollGuide(jobId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "가이드를 불러오는 데 실패했습니다.";
      setErrorMsg(msg);
      setPageState("error");
    }
  };

  const pollGuide = async (jobId: string) => {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const status = await guideApi.getJobStatus(jobId);
        if (status.status === "COMPLETED") {
          const result = await guideApi.getJobResult(jobId);
          setGuideResult(result);
          setPageState("loaded");
          return;
        }
        if (status.status === "FAILED") {
          setErrorMsg(status.error_message ?? "가이드 생성에 실패했습니다.");
          setPageState("error");
          return;
        }
      } catch {
        // continue polling on transient errors
      }
    }
    setErrorMsg("가이드 생성 시간이 초과되었습니다.");
    setPageState("error");
  };

  const toggleSection = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCheck = (key: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updatedAt = guideResult
    ? new Date(guideResult.updated_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const sections = guideResult
    ? [
        {
          id: "medication",
          icon: <Pill className="w-6 h-6" />,
          title: "복약 안내",
          color: "bg-[#6B8E23]",
          content: guideResult.medication_guidance,
        },
        {
          id: "lifestyle",
          icon: <Activity className="w-6 h-6" />,
          title: "생활습관 가이드",
          color: "bg-blue-600",
          content: guideResult.lifestyle_guidance,
        },
        {
          id: "caution",
          icon: <AlertTriangle className="w-6 h-6" />,
          title: "주의사항",
          color: "bg-red-500",
          content: guideResult.safety_notice,
        },
      ]
    : [];

  const sources = guideResult?.source_references ?? [];

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-[#2D3436]">AI 가이드</h1>
        <p className="text-[#6c6f72]">개인 건강 데이터 기반 맞춤형 복약 및 생활습관 안내</p>
      </div>

      {/* Loading State */}
      {pageState === "loading" && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-[#6B8E23] animate-spin" />
          <p className="text-[#6c6f72]">가이드를 불러오는 중...</p>
        </div>
      )}

      {/* Pending State */}
      {pageState === "pending" && (
        <div className="bg-[#6B8E23] text-white p-8 rounded-2xl text-center">
          <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold mb-2">AI 가이드 생성 중...</h2>
          <p className="text-[#FFFCF5] opacity-80 text-sm">
            처방전 데이터를 분석하여 맞춤형 가이드를 생성하고 있습니다. 잠시만 기다려 주세요.
          </p>
        </div>
      )}

      {/* Error State */}
      {pageState === "error" && (
        <div className="space-y-4">
          <div className="bg-red-50 border-2 border-red-400 p-6 rounded-2xl">
            <p className="font-bold text-red-700 mb-1">가이드 생성 실패</p>
            <p className="text-sm text-red-600">{errorMsg}</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("guide_job_id");
              navigate("/ocr-scan");
            }}
            className="w-full bg-[#6B8E23] text-white py-3.5 rounded-xl font-medium hover:bg-[#556b1c] transition-colors"
          >
            처방전 다시 스캔하기
          </button>
        </div>
      )}

      {/* No Prescription State */}
      {pageState === "no_prescription" && (
        <div className="bg-white border-2 border-dashed border-[#6B8E23] p-12 rounded-2xl text-center">
          <div className="inline-flex w-16 h-16 bg-[#f5f3eb] rounded-2xl items-center justify-center mb-4">
            <ScanLine className="w-8 h-8 text-[#6B8E23]" />
          </div>
          <h2 className="text-xl font-bold text-[#2D3436] mb-2">처방전 스캔이 필요합니다</h2>
          <p className="text-sm text-[#6c6f72] mb-6 leading-relaxed">
            AI 맞춤 복약 가이드를 받으려면 먼저 처방전을 업로드해 주세요.
          </p>
          <button
            onClick={() => navigate("/ocr-scan")}
            className="bg-[#6B8E23] text-white px-8 py-3 rounded-xl font-medium hover:bg-[#556b1c] transition-colors"
          >
            처방전 스캔하러 가기
          </button>
        </div>
      )}

      {/* Loaded State */}
      {pageState === "loaded" && guideResult && (
        <>
          {/* AI Generated Banner */}
          <div className="bg-[#6B8E23] text-white p-5 rounded-2xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold">AI 맞춤 가이드 생성됨</h2>
                <p className="text-sm text-[#FFFCF5] opacity-80">
                  최종 업데이트: {updatedAt}
                  {guideResult.adherence_rate_percent != null &&
                    ` · 복약 준수율 ${guideResult.adherence_rate_percent.toFixed(0)}%`}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const jobId = localStorage.getItem("guide_job_id");
                if (jobId) loadGuide(jobId);
              }}
              className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Guide Sections */}
          <div className="space-y-4 mb-8">
            {sections.map((section) => (
              <div
                key={section.id}
                className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-[#f5f3eb] transition-colors"
                >
                  <div
                    className={`w-10 h-10 ${section.color} rounded-xl flex items-center justify-center text-white shrink-0`}
                  >
                    {section.icon}
                  </div>
                  <span className="flex-1 text-left font-bold text-[#2D3436]">{section.title}</span>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      expanded[section.id]
                        ? "bg-[#6B8E23] text-white"
                        : "bg-[#f5f3eb] text-[#6c6f72]"
                    }`}
                  >
                    {expanded[section.id] ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {expanded[section.id] && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => toggleCheck(section.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                          checkedItems[section.id]
                            ? "bg-[#6B8E23] border-[#6B8E23]"
                            : "border-gray-300 hover:border-[#6B8E23]"
                        }`}
                      >
                        {checkedItems[section.id] && <CheckCircle className="w-4 h-4 text-white" />}
                      </button>
                      <p
                        className={`text-sm text-[#6c6f72] leading-relaxed whitespace-pre-wrap flex-1 ${
                          checkedItems[section.id] ? "opacity-50 line-through" : ""
                        }`}
                      >
                        {section.content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Medical Safety Notice */}
          <MedicalSafetyNotice />

          {/* Sources & References */}
          {sources.length > 0 && (
            <div className="bg-white border-2 border-gray-100 p-6 rounded-2xl mb-6 mt-6">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="w-5 h-5 text-[#6B8E23]" />
                <h3 className="font-bold text-[#2D3436]">참고 문헌 및 출처</h3>
              </div>
              <div className="space-y-2">
                {sources.map((src, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 hover:bg-[#f5f3eb] rounded-lg transition-colors cursor-pointer"
                  >
                    <span className="w-5 h-5 bg-[#f5f3eb] rounded text-xs flex items-center justify-center text-[#6c6f72] shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-[#2D3436] flex-1">{src.title}</span>
                    <ExternalLink className="w-4 h-4 text-[#6c6f72]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA to Chatbot */}
          <div className="bg-[#FFD166] p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-[#2D3436] mb-1">궁금한 점이 있으신가요?</h3>
              <p className="text-sm text-[#2D3436] opacity-80">
                가이드 내용에 대해 더 자세히 알고 싶다면 AI 챗봇에게 질문해 보세요.
              </p>
            </div>
            <button
              onClick={() => navigate("/chatbot")}
              className="flex items-center gap-2 bg-[#2D3436] text-white px-6 py-3 rounded-xl hover:bg-[#1a1d1f] transition-colors font-medium shrink-0"
            >
              <MessageSquare className="w-5 h-5" />
              챗봇에게 질문하기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
