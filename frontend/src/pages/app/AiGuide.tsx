import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Sparkles } from "lucide-react";
import { guideApi, GuideJobResult, GuideStatus } from "@/lib/api";

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-warm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-all duration-200 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
            <Bell className="w-3.5 h-3.5 text-green-600" />
          </div>
          <span className="text-sm font-bold text-gray-700">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100/60">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{children}</p>
        </div>
      )}
    </div>
  );
}

export default function AiGuide() {
  const [status, setStatus] = useState<GuideStatus | "IDLE">("IDLE");
  const [result, setResult] = useState<GuideJobResult | null>(null);
  const [error, setError] = useState("");
  const cancelledRef = useRef(false);

  async function loadGuide() {
    const jobId = localStorage.getItem("guide_job_id");
    if (!jobId) {
      setStatus("IDLE");
      return;
    }
    setError("");
    try {
      const s = await guideApi.getJobStatus(jobId);
      if (s.status === "SUCCEEDED") {
        const r = await guideApi.getJobResult(jobId);
        setResult(r);
        setStatus("SUCCEEDED");
      } else if (s.status === "FAILED") {
        setStatus("FAILED");
        setError(s.error_message ?? "가이드 생성에 실패했습니다.");
      } else {
        setStatus(s.status);
        pollStatus(jobId);
      }
    } catch {
      setStatus("FAILED");
      setError("가이드를 불러오지 못했습니다.");
    }
  }

  async function pollStatus(jobId: string) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      if (cancelledRef.current) return;
      try {
        const s = await guideApi.getJobStatus(jobId);
        if (s.status === "SUCCEEDED") {
          const r = await guideApi.getJobResult(jobId);
          if (cancelledRef.current) return;
          setResult(r);
          setStatus("SUCCEEDED");
          return;
        }
        if (s.status === "FAILED") {
          setStatus("FAILED");
          setError(s.error_message ?? "가이드 생성에 실패했습니다.");
          return;
        }
      } catch {
        break;
      }
    }
    if (!cancelledRef.current) {
      setStatus("FAILED");
      setError("가이드 생성 시간이 초과되었습니다.");
    }
  }

  useEffect(() => {
    cancelledRef.current = false;
    loadGuide();
    return () => { cancelledRef.current = true; };
  }, []); // eslint-disable-line

  const updatedAt = result?.updated_at
    ? new Date(result.updated_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-full p-4 md:p-8 max-w-3xl mx-auto stagger-children">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">AI 가이드</h1>
          <p className="text-sm text-gray-400 mt-0.5 font-medium">복약 및 생활습관 맞춤 가이드</p>
        </div>
        <button
          onClick={loadGuide}
          className="p-2.5 rounded-xl hover:bg-white text-gray-400 hover:text-gray-600 hover:shadow-sm transition-all duration-200"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* IDLE */}
      {status === "IDLE" && (
        <div className="card-warm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-gray-500 font-semibold">아직 생성된 가이드가 없습니다.</p>
          <p className="text-sm text-gray-400 mt-1">처방전 스캔 후 AI 가이드가 생성됩니다.</p>
        </div>
      )}

      {/* Processing banner */}
      {(status === "QUEUED" || status === "PROCESSING") && (
        <div className="gradient-primary text-white rounded-2xl px-6 py-5 flex items-center gap-4 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <p className="font-bold">AI 가이드 생성중</p>
            <p className="text-sm text-green-100 mt-0.5">잠시만 기다려주세요...</p>
          </div>
        </div>
      )}

      {/* FAILED */}
      {status === "FAILED" && (
        <div className="card-warm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-gray-600 font-semibold">{error}</p>
          <button
            onClick={loadGuide}
            className="mt-4 px-5 py-2 gradient-primary text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all duration-200"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Completed */}
      {status === "SUCCEEDED" && result && (
        <div className="space-y-4">
          {/* Success banner */}
          <div className="gradient-primary text-white rounded-2xl px-6 py-5 flex items-center gap-4 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold">AI 가이드 생성완료</p>
              {updatedAt && (
                <p className="text-sm text-green-100 mt-0.5">최후 업데이트: {updatedAt}</p>
              )}
            </div>
          </div>

          {result.medication_guidance && (
            <Accordion title="복약 안내">{result.medication_guidance}</Accordion>
          )}
          {result.lifestyle_guidance && (
            <Accordion title="생활 습관 가이드">{result.lifestyle_guidance}</Accordion>
          )}
          {result.safety_notice && (
            <Accordion title="주의사항">{result.safety_notice}</Accordion>
          )}

          {result.source_references?.length > 0 && (
            <div className="card-warm p-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">참고 자료</p>
              <ul className="space-y-1">
                {result.source_references.map((ref, i) => (
                  <li key={i} className="text-xs text-gray-500">
                    {ref.title} — <span className="text-gray-400">{ref.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center pt-2">
            본 가이드는 참고용 정보이며, 의료진의 진료 및 처방을 대체하지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}
