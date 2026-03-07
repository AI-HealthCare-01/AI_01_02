import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Sparkles } from "lucide-react";
import { guideApi, GuideJobResult, GuideStatus } from "@/lib/api";

interface MedicationGuideItem {
  drug_name?: string;
  dose?: number | null;
  dosage_per_once?: number | null;
  frequency_per_day?: number | null;
  intake_time?: string[];
  side_effect?: string | null;
  refill_reminder_days_before?: string | null;
}

const LIFESTYLE_GUIDE_LABEL_MAP: Record<string, string> = {
  nutrition_guide: "식사 가이드",
  exercise_guide: "운동 가이드",
  concentration_strategy: "스크린 타임 제한 가이드",
  sleep_guide: "운동 가이드",
  caffeine_guide: "카페인 가이드",
  smoking_guide: "흡연 가이드",
  drinking_guide: "음주 가이드",
};

function formatMedicationGuidanceText(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return raw;

    const lines = parsed
      .filter((item): item is MedicationGuideItem => typeof item === "object" && item !== null)
      .map((med) => {
        const drugName = med.drug_name ?? "약물";
        const doseText = med.dose != null ? `${med.dose}mg` : "용량 정보 없음";
        const frequency = med.frequency_per_day != null ? med.frequency_per_day : "-";
        const dosage = med.dosage_per_once != null ? med.dosage_per_once : "-";
        const intakeTimes = Array.isArray(med.intake_time) ? med.intake_time : [];
        const intakeLine = intakeTimes.length > 0 ? `복용 시간: ${intakeTimes.join(", ")}` : "";
        const sideEffectLine = med.side_effect ? `⚠️ 주의: ${med.side_effect} 현상이 있을 수 있습니다.` : "";
        const refillLine = med.refill_reminder_days_before
          ? `🔔 ${med.refill_reminder_days_before}에 미리 알림을 드릴게요!`
          : "";

        return [
          `${drugName} (${doseText}) 안내입니다.`,
          `하루에 ${frequency}번, 한 번에 ${dosage}알씩 드시면 됩니다.`,
          intakeLine,
          sideEffectLine,
          refillLine,
        ]
          .filter(Boolean)
          .join("\n");
      });

    return lines.length > 0 ? lines.join("\n\n") : raw;
  } catch {
    return raw;
  }
}

function formatLifestyleGuidanceText(raw: string): string {
  const buildBlock = (key: string, content: string): string => {
    const label = LIFESTYLE_GUIDE_LABEL_MAP[key] ?? key;
    return `${label}\n${content.trim()}`;
  };

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const blocks = Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => typeof value === "string" && String(value).trim().length > 0)
        .map(([key, value]) => buildBlock(key, String(value)));
      if (blocks.length > 0) return blocks.join("\n\n");
    }
  } catch {
    // fallback to line-based parser
  }

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = lines
    .map((line) => {
      const sepIndex = line.indexOf(":");
      if (sepIndex <= 0) return null;
      const key = line.slice(0, sepIndex).trim();
      const content = line.slice(sepIndex + 1).trim();
      if (!LIFESTYLE_GUIDE_LABEL_MAP[key] || !content) return null;
      return buildBlock(key, content);
    })
    .filter((block): block is string => Boolean(block));

  return blocks.length > 0 ? blocks.join("\n\n") : raw;
}

function renderLifestyleGuidanceContent(raw: string): React.ReactNode {
  const formatted = formatLifestyleGuidanceText(raw);
  const blocks = formatted
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const [title, ...rest] = block.split("\n");
        const content = rest.join("\n").trim();
        if (!content) {
          return (
            <p key={`${title}-${index}`} className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {block}
            </p>
          );
        }
        return (
          <div key={`${title}-${index}`} className="space-y-1">
            <p className="text-base font-bold text-green-700">{title}</p>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{content}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── 아코디언 ──────────────────────────────────────────────────────────────────

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
        <div className="px-5 pb-5 pt-1 border-t border-gray-100/60 bg-white">
          <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{children}</div>
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
            <Accordion title="복약 안내">
              {formatMedicationGuidanceText(result.medication_guidance)}
            </Accordion>
          )}
          {result.lifestyle_guidance && (
            <Accordion title="생활 습관 가이드">
              {renderLifestyleGuidanceContent(result.lifestyle_guidance)}
            </Accordion>
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
        </div>
      )}

      <div className="mt-6 border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-2">의료 안전 고지</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          본 서비스의 알림 및 복약 정보는 참고용이며, 의료진의 처방 및 지시를 대체하지 않습니다.
          복약 관련 이상반응이나 건강 이상이 느껴질 경우 즉시 의료 전문가와 상담하시기 바랍니다.
          처방된 약의 용량, 복용 시간, 주의사항은 반드시 담당 의사 또는 약사의 지도에 따르십시오.
        </p>
      </div>
    </div>
  );
}
