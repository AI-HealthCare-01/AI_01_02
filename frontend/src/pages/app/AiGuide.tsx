import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Apple,
  CheckCircle2,
  ChevronRight,
  Cigarette,
  Clock3,
  Coffee,
  Dumbbell,
  HeartPulse,
  MoonStar,
  Pill,
  Smartphone,
  Sparkles,
  Wine,
  X,
} from "lucide-react";
import {
  guideApi,
  GuideJobResult,
  GuideSourceReference,
  GuideStatus,
  medicationApi,
  MedicationInfo,
} from "@/lib/api";

interface MedicationGuideItem {
  drug_name?: string;
  dose?: number | null;
  dosage_per_once?: number | null;
  frequency_per_day?: number | null;
  intake_time?: string[];
  side_effect?: string | null;
  precautions?: string | null;
  side_effects?: string | null;
  safety_source?: string | null;
}

interface GuideTone {
  icon: LucideIcon;
  tint: string;
  border: string;
  accent: string;
  title: string;
}

interface GuideActionItem {
  id: string;
  section: "medication" | "lifestyle";
  label: string;
  title: string;
  summary: string;
  detailLines: string[];
  tone: GuideTone;
}

const GUIDE_CONFIRM_STORAGE_PREFIX = "ai_guide_confirmed";

const DEFAULT_SAFETY_NOTICE =
  "본 서비스의 알림 및 복약 정보는 참고용이며, 의료진의 처방 및 지시를 대체하지 않습니다. 복약 관련 이상반응이나 건강 이상이 느껴질 경우 즉시 의료 전문가와 상담하시기 바랍니다. 처방된 약의 용량, 복용 시간, 주의사항은 반드시 담당 의사 또는 약사의 지도에 따르십시오.";

const MEDICATION_GUIDE_TONE: GuideTone = {
  icon: Pill,
  tint: "#eef8f1",
  border: "#d7e9dd",
  accent: "#3f7856",
  title: "#2f5e44",
};

const DEFAULT_LIFESTYLE_GUIDE_TONE: GuideTone = {
  icon: HeartPulse,
  tint: "#eef4fa",
  border: "#d8e7f4",
  accent: "#4a7ea6",
  title: "#365f7d",
};

const LIFESTYLE_GUIDE_TONE_MAP: Record<string, GuideTone> = {
  식사: {
    icon: Apple,
    tint: "#eef8f1",
    border: "#d7e9dd",
    accent: "#4f9168",
    title: "#336248",
  },
  운동: {
    icon: Dumbbell,
    tint: "#eef4fa",
    border: "#d8e7f4",
    accent: "#4a7ea6",
    title: "#365f7d",
  },
  "스크린 타임 제한": {
    icon: Smartphone,
    tint: "#f4f0fa",
    border: "#e8ddf4",
    accent: "#6366a0",
    title: "#52558a",
  },
  수면: {
    icon: MoonStar,
    tint: "#fef7ee",
    border: "#fce2bf",
    accent: "#d97a2e",
    title: "#9a541b",
  },
  "카페인 제한": {
    icon: Coffee,
    tint: "#fff4eb",
    border: "#f2dfd2",
    accent: "#b97442",
    title: "#8f5f38",
  },
  "흡연 제한": {
    icon: Cigarette,
    tint: "#fef3f0",
    border: "#fde4de",
    accent: "#c44a3d",
    title: "#944238",
  },
  "음주 제한": {
    icon: Wine,
    tint: "#fff7e8",
    border: "#f3dfb5",
    accent: "#c9851f",
    title: "#8f6318",
  },
  "건강 습관 지속": {
    icon: HeartPulse,
    tint: "#eef8f1",
    border: "#d7e9dd",
    accent: "#4f9168",
    title: "#336248",
  },
};

const LIFESTYLE_GUIDE_LABEL_MAP: Record<string, string> = {
  nutrition_guide: "식사",
  exercise_guide: "운동",
  concentration_strategy: "스크린 타임 제한",
  sleep_guide: "수면",
  caffeine_guide: "카페인 제한",
  smoking_guide: "흡연 제한",
  drinking_guide: "음주 제한",
  general_health_guide: "건강 습관 지속",
};

function getGuideConfirmStorageKey(dateKey: string, jobId: string): string {
  return `${GUIDE_CONFIRM_STORAGE_PREFIX}:${dateKey}:${jobId}`;
}

function getLocalDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLifestyleGuideTone(title: string): GuideTone {
  return LIFESTYLE_GUIDE_TONE_MAP[title] ?? DEFAULT_LIFESTYLE_GUIDE_TONE;
}

function buildGuideBadgeStyle(tone: GuideTone): CSSProperties {
  return {
    backgroundColor: tone.tint,
    borderColor: tone.border,
    color: tone.accent,
  };
}

function formatSafetySourceLabel(source: string | null | undefined): string {
  if (source === "DB") return "drugDB(psych_drugs)";
  if (source === "EASY_DRUG") return "e약은요";
  if (source === "LLM") return "LLM";
  return "미확인";
}

function extractFirstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const firstLine = trimmed.split("\n")[0].trim();
  const candidates = [".", "!", "?", "。"]
    .map((mark) => firstLine.indexOf(mark))
    .filter((index) => index >= 0);

  if (candidates.length === 0) return firstLine;

  const firstStop = Math.min(...candidates);
  return firstLine.slice(0, firstStop + 1).trim();
}

function buildMedicationGuidanceLines(
  med: MedicationGuideItem,
  medInfoByName: Record<string, MedicationInfo | undefined>,
): string[] {
  const drugName = med.drug_name ?? "약물";
  const medInfo = drugName ? medInfoByName[drugName] : undefined;
  const doseText = med.dose != null ? `${med.dose}mg` : "용량 정보 없음";
  const frequency = med.frequency_per_day != null ? med.frequency_per_day : "-";
  const dosage = med.dosage_per_once != null ? med.dosage_per_once : "-";
  const intakeTimes = Array.isArray(med.intake_time) ? med.intake_time : [];
  const intakeLine = intakeTimes.length > 0 ? `복용 시간: ${intakeTimes.join(", ")}` : "";
  const sideEffectLine = med.side_effect ? `⚠️ 주의: ${med.side_effect} 현상이 있을 수 있습니다.` : "";
  const precautionsText = med.precautions ?? medInfo?.precautions ?? medInfo?.warnings;
  const precautionsLine = precautionsText ? `주의사항: ${precautionsText}` : "";
  const sideEffectsText = med.side_effects ?? medInfo?.side_effects;
  const sideEffectsFromApi = sideEffectsText ? `부작용: ${sideEffectsText}` : "";
  const hasApiInfo = Boolean(precautionsText || sideEffectsText);
  const sourceLine = `출처: ${formatSafetySourceLabel(med.safety_source ?? medInfo?.source)}`;
  const fallbackSafetyLine = !hasApiInfo
    ? "주의사항/부작용 정보가 없습니다. 복용 중 이상 반응이 있으면 의료진과 상담하세요."
    : "";

  return [
    `${drugName} (${doseText})`,
    `하루에 ${frequency}번, 한 번에 ${dosage}알씩 드시면 됩니다.`,
    intakeLine,
    sideEffectLine,
    precautionsLine,
    sideEffectsFromApi,
    fallbackSafetyLine,
    sourceLine,
  ].filter(Boolean);
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
  } catch (err) {
    console.warn("Lifestyle guidance JSON parse failed, using line-based fallback:", err);
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

function buildMedicationActionItems(
  raw: string,
  medInfoByName: Record<string, MedicationInfo | undefined>,
): GuideActionItem[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is MedicationGuideItem => typeof item === "object" && item !== null)
      .map((med, index) => {
        const lines = buildMedicationGuidanceLines(med, medInfoByName);
        const [title, ...detailLines] = lines;
        const summarySource = detailLines.find((line) => !line.startsWith("출처:")) ?? title;
        return {
          id: `medication:${med.drug_name ?? title}:${index}`,
          section: "medication",
          label: med.drug_name ?? "복약 안내",
          title,
          summary: extractFirstSentence(summarySource),
          detailLines,
          tone: MEDICATION_GUIDE_TONE,
        };
      });
  } catch (err) {
    console.warn("Failed to parse medication guidance JSON:", err);
    return [];
  }
}

function buildLifestyleActionItems(raw: string): GuideActionItem[] {
  const formatted = formatLifestyleGuidanceText(raw);
  const blocks = formatted
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const [title, ...rest] = block.split("\n");
    const content = rest.join("\n").trim();
    return {
      id: `lifestyle:${title}:${index}`,
      section: "lifestyle",
      label: title || "생활 습관 가이드",
      title: title || "생활 습관 가이드",
      summary: extractFirstSentence(content || block),
      detailLines: (content || block)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      tone: getLifestyleGuideTone(title),
    };
  });
}

function renderMedicationDetailLine(line: string, index: number): ReactNode {
  if (line.startsWith("⚠️ 주의:")) {
    return (
      <div key={`${line}-${index}`} className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3">
        <p className="text-sm leading-6 whitespace-pre-wrap text-red-600 font-semibold">{line}</p>
      </div>
    );
  }

  if (line.startsWith("부작용:")) {
    return (
      <div key={`${line}-${index}`} className="rounded-2xl border border-red-100 bg-red-50/70 px-4 py-3">
        <p className="text-sm leading-6 whitespace-pre-wrap text-red-600 font-semibold">{line}</p>
      </div>
    );
  }

  if (line.startsWith("주의사항:") || line.includes("주의사항/부작용 정보가 없습니다.")) {
    return (
      <div key={`${line}-${index}`} className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3">
        <p className="text-sm leading-6 whitespace-pre-wrap text-amber-800 font-semibold">{line}</p>
      </div>
    );
  }

  if (line.startsWith("출처:")) {
    return (
      <div key={`${line}-${index}`} className="rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3">
        <p className="text-xs leading-6 whitespace-pre-wrap text-gray-500 font-semibold">{line}</p>
      </div>
    );
  }

  return (
    <p key={`${line}-${index}`} className="text-sm leading-7 whitespace-pre-wrap text-gray-700">
      {line}
    </p>
  );
}

function renderGuideDetailContent(item: GuideActionItem): ReactNode {
  if (item.section === "medication") {
    return <div className="space-y-3">{item.detailLines.map((line, index) => renderMedicationDetailLine(line, index))}</div>;
  }

  return (
    <div className="space-y-3">
      {item.detailLines.map((line, index) => (
        <p key={`${line}-${index}`} className="text-sm leading-7 whitespace-pre-wrap text-gray-700">
          {line}
        </p>
      ))}
    </div>
  );
}

function getSummaryCopy(totalCount: number, remainingCount: number): { headline: string; description: string } {
  if (totalCount === 0) {
    return {
      headline: "오늘 확인할 가이드가 아직 없어요.",
      description: "새로운 AI 가이드가 생성되면 이곳에서 바로 확인할 수 있어요.",
    };
  }

  if (remainingCount === 0) {
    return {
      headline: "오늘 가이드를 전부 확인했어요!",
      description: "필요할 때 더보기로 전체 원문을 다시 확인해 보세요.",
    };
  }

  return {
    headline: `오늘 신경 써야 할 가이드가 ${remainingCount}개 있어요!`,
    description: `남은 가이드 ${remainingCount}개를 천천히 확인해 보세요.`,
  };
}

function GuideModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/45 p-4 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-3xl overflow-hidden rounded-[30px] bg-white shadow-[0_30px_80px_rgba(42,38,34,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">AI 가이드</p>
            <h2 className="mt-2 text-xl font-bold text-gray-800 md:text-2xl">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-92px)] overflow-y-auto px-5 py-5 md:px-6 md:py-6">{children}</div>
      </div>
    </div>
  );
}

function GuideDetailModal({
  item,
  onClose,
}: {
  item: GuideActionItem;
  onClose: () => void;
}) {
  const Icon = item.tone.icon;

  return (
    <GuideModalShell
      title={item.title}
      subtitle={item.section === "medication" ? "복약 안내 상세" : "생활 습관 가이드 상세"}
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold" style={buildGuideBadgeStyle(item.tone)}>
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
        </div>
        <div className="rounded-[26px] border border-gray-200 bg-gray-50/70 p-5">
          <p className="text-xl font-bold leading-snug text-gray-800">{item.summary}</p>
          <div className="mt-5">{renderGuideDetailContent(item)}</div>
        </div>
      </div>
    </GuideModalShell>
  );
}

function GuideOverviewModal({
  items,
  updatedAt,
  references,
  safetyNotice,
  onClose,
}: {
  items: GuideActionItem[];
  updatedAt: string | null;
  references: GuideSourceReference[];
  safetyNotice: string;
  onClose: () => void;
}) {
  return (
    <GuideModalShell
      title="전체 가이드 더보기"
      subtitle={updatedAt ? `최종 업데이트: ${updatedAt}` : "전체 원문과 참고 자료를 한 번에 확인할 수 있어요."}
      onClose={onClose}
    >
      <div className="space-y-5">
        {items.map((item) => {
          const Icon = item.tone.icon;
          return (
            <section key={item.id} className="rounded-[26px] border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
                    style={buildGuideBadgeStyle(item.tone)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  <p className="mt-3 text-lg font-bold text-gray-800">{item.title}</p>
                </div>
              </div>
              <div className="mt-4">{renderGuideDetailContent(item)}</div>
            </section>
          );
        })}

        {references.length > 0 ? (
          <section className="rounded-[26px] border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-gray-700">참고 자료</p>
            <ul className="mt-3 space-y-2">
              {references.map((reference, index) => (
                <li key={`${reference.title}-${index}`} className="text-sm leading-6 text-gray-500">
                  {reference.title} — <span className="text-gray-400">{reference.source}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-[26px] border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-gray-700">의료 안전 고지</p>
          <p className="mt-3 text-sm leading-7 text-gray-500 whitespace-pre-wrap">{safetyNotice}</p>
        </section>
      </div>
    </GuideModalShell>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[22px] bg-white/14 px-4 py-4 backdrop-blur-sm">
      <p className="text-xs font-semibold text-green-50/90">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function GuideActionCard({
  item,
  confirmed,
  onToggleConfirmed,
  onOpenDetail,
}: {
  item: GuideActionItem;
  confirmed: boolean;
  onToggleConfirmed: (id: string) => void;
  onOpenDetail: (id: string) => void;
}) {
  const Icon = item.tone.icon;

  return (
    <article className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_14px_34px_rgba(42,38,34,0.06)] md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div
          className="inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
          style={buildGuideBadgeStyle(item.tone)}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </div>
        <button
          type="button"
          onClick={() => onToggleConfirmed(item.id)}
          aria-pressed={confirmed}
          className={
            confirmed
              ? "inline-flex items-center gap-2 rounded-full border border-green-100 bg-green-50 px-3.5 py-2 text-sm font-semibold text-green-700 transition-colors"
              : "inline-flex items-center gap-2 rounded-full border border-[#e9e0d6] bg-[#f7f3ee] px-3.5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-[#dccfc1] hover:text-gray-800"
          }
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>확인했어요</span>
        </button>
      </div>

      <div className="mt-6">
        <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xl font-bold leading-snug text-gray-800 md:text-[1.55rem]">
          {item.summary}
        </p>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <button
          type="button"
          onClick={() => onOpenDetail(item.id)}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3.5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
        >
          <span>더보기</span>
          <ChevronRight className="h-4 w-4" />
        </button>
        <p className="sr-only">카드 전면에는 원문 첫 문장을 그대로 보여줍니다.</p>
      </div>
    </article>
  );
}

export default function AiGuide() {
  const [status, setStatus] = useState<GuideStatus | "IDLE">("IDLE");
  const [result, setResult] = useState<GuideJobResult | null>(null);
  const [error, setError] = useState("");
  const [medInfoByName, setMedInfoByName] = useState<Record<string, MedicationInfo | undefined>>({});
  const [pollElapsed, setPollElapsed] = useState(0);
  const [confirmedGuideIds, setConfirmedGuideIds] = useState<string[]>([]);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const cancelledRef = useRef(false);
  const todayKey = useMemo(() => getLocalDateKey(), []);

  async function loadGuide() {
    setError("");
    try {
      let s;
      try {
        s = await guideApi.getLatestJobStatus();
        localStorage.setItem("guide_job_id", s.job_id);
      } catch (err) {
        console.warn("getLatestJobStatus failed, falling back to cached job ID:", err);
        const fallbackJobId = localStorage.getItem("guide_job_id");
        if (!fallbackJobId) {
          setStatus("IDLE");
          return;
        }
        s = await guideApi.getJobStatus(fallbackJobId);
      }

      if (s.status === "SUCCEEDED") {
        const r = await guideApi.getJobResult(s.job_id);
        setResult(r);
        setStatus("SUCCEEDED");
      } else if (s.status === "FAILED") {
        setStatus("FAILED");
        setError(s.error_message ?? "가이드 생성에 실패했습니다.");
      } else {
        setStatus(s.status);
        pollStatus(s.job_id);
      }
    } catch {
      setStatus("FAILED");
      setError("가이드를 불러오지 못했습니다.");
    }
  }

  async function pollStatus(jobId: string) {
    setPollElapsed(0);
    for (let i = 0; i < 90; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      setPollElapsed((i + 1) * 3);
      if (cancelledRef.current) return;
      try {
        const s = await guideApi.getJobStatus(jobId);
        if (s.status === "SUCCEEDED") {
          const r = await guideApi.getJobResult(jobId);
          if (cancelledRef.current) return;
          localStorage.setItem("guide_job_id", jobId);
          setResult(r);
          setStatus("SUCCEEDED");
          return;
        }
        if (s.status === "FAILED") {
          setStatus("FAILED");
          setError(s.error_message ?? "가이드 생성에 실패했습니다.");
          return;
        }
      } catch (err) {
        console.warn("Guide polling error:", err);
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
    return () => {
      cancelledRef.current = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!result?.medication_guidance) return;
    let meds: MedicationGuideItem[] = [];
    try {
      const parsed = JSON.parse(result.medication_guidance) as unknown;
      if (Array.isArray(parsed)) meds = parsed as MedicationGuideItem[];
    } catch (err) {
      console.warn("Failed to parse medication_guidance for info lookup:", err);
      return;
    }
    const names = Array.from(new Set(meds.map((med) => med.drug_name).filter((name): name is string => Boolean(name))));
    const missing = names.filter((name) => !medInfoByName[name]);
    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (name) => {
        try {
          const info = await medicationApi.getInfo(name);
          return [name, info] as const;
        } catch (err) {
          console.warn(`Failed to load medication info for '${name}':`, err);
          return [name, undefined] as const;
        }
      }),
    ).then((entries) => {
      setMedInfoByName((prev) => {
        const next = { ...prev };
        for (const [name, info] of entries) {
          next[name] = info;
        }
        return next;
      });
    }).catch((err) => {
      console.warn("Unexpected error updating medication info:", err);
    });
  }, [result?.medication_guidance]); // eslint-disable-line react-hooks/exhaustive-deps

  const guideItems = useMemo(() => {
    const items: GuideActionItem[] = [];
    if (result?.medication_guidance) {
      items.push(...buildMedicationActionItems(result.medication_guidance, medInfoByName));
    }
    if (result?.lifestyle_guidance) {
      items.push(...buildLifestyleActionItems(result.lifestyle_guidance));
    }
    return items;
  }, [medInfoByName, result?.lifestyle_guidance, result?.medication_guidance]);

  const confirmStorageKey = useMemo(
    () => (result?.job_id ? getGuideConfirmStorageKey(todayKey, result.job_id) : null),
    [result?.job_id, todayKey],
  );

  useEffect(() => {
    if (!confirmStorageKey) {
      setConfirmedGuideIds([]);
      return;
    }

    const validIds = new Set(guideItems.map((item) => item.id));

    try {
      const raw = localStorage.getItem(confirmStorageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const next = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string" && validIds.has(value))
        : [];

      setConfirmedGuideIds(next);
      localStorage.setItem(confirmStorageKey, JSON.stringify(next));
    } catch (err) {
      console.warn("Failed to parse confirmed guide IDs from localStorage:", err);
      setConfirmedGuideIds([]);
      localStorage.setItem(confirmStorageKey, JSON.stringify([]));
    }
  }, [confirmStorageKey, guideItems]);

  const selectedGuide = useMemo(
    () => guideItems.find((item) => item.id === selectedGuideId) ?? null,
    [guideItems, selectedGuideId],
  );

  const updatedAt = result?.updated_at
    ? new Date(result.updated_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const totalGuideCount = guideItems.length;
  const confirmedGuideCount = confirmedGuideIds.length;
  const remainingGuideCount = Math.max(totalGuideCount - confirmedGuideCount, 0);
  const summaryCopy = getSummaryCopy(totalGuideCount, remainingGuideCount);
  const safetyNotice = result?.safety_notice?.trim() || DEFAULT_SAFETY_NOTICE;
  const isOverviewDisabled = status !== "SUCCEEDED" || totalGuideCount === 0;

  function handleToggleConfirmed(id: string) {
    if (!confirmStorageKey) return;

    setConfirmedGuideIds((prev) => {
      const next = prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id];
      localStorage.setItem(confirmStorageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <>
      <div className="min-h-full max-w-4xl mx-auto p-4 md:p-8 stagger-children">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">AI 가이드</h1>
          <p className="mt-0.5 text-sm font-medium text-gray-400">복약 및 생활습관 맞춤 가이드</p>
        </div>

        {status === "IDLE" && (
          <div className="card-warm p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <Sparkles className="h-6 w-6 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-500">아직 생성된 가이드가 없습니다.</p>
            <p className="mt-1 text-sm text-gray-400">처방전 스캔 후 AI 가이드가 생성됩니다.</p>
          </div>
        )}

        {(status === "QUEUED" || status === "PROCESSING") && (
          <div className="gradient-primary flex items-center gap-4 rounded-2xl px-6 py-5 text-white shadow-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="font-bold">AI 가이드 생성중</p>
              <p className="mt-0.5 text-sm text-green-100">
                {pollElapsed > 0 ? `${pollElapsed}초 경과 — 잠시만 기다려주세요...` : "잠시만 기다려주세요..."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                cancelledRef.current = true;
                setStatus("IDLE");
                setPollElapsed(0);
              }}
              className="text-sm text-green-100 underline hover:text-white"
            >
              취소
            </button>
          </div>
        )}

        {status === "FAILED" && (
          <div className="card-warm p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <p className="font-semibold text-gray-600">{error}</p>
            <button
              type="button"
              onClick={loadGuide}
              className="mt-4 rounded-xl px-5 py-2 text-sm font-bold text-white transition-all duration-200 hover:shadow-lg gradient-primary"
            >
              다시 시도
            </button>
          </div>
        )}

        {status === "SUCCEEDED" && result && (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[32px] px-6 py-6 text-white shadow-[0_24px_60px_rgba(63,120,86,0.25)] md:px-7 md:py-7" style={{ background: "linear-gradient(135deg, #4f9168 0%, #3f7856 48%, #315f47 100%)" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-50/90">오늘의 액션 가이드</p>
                  <h2 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">{summaryCopy.headline}</h2>
                  <p className="mt-2 text-sm leading-6 text-green-50/90 md:text-base">{summaryCopy.description}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/12 backdrop-blur-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <StatBox label="전체 가이드" value={totalGuideCount} />
                <StatBox label="확인함" value={confirmedGuideCount} />
                <StatBox label="남음" value={remainingGuideCount} />
              </div>

              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                {updatedAt ? <p className="text-sm text-green-50/90">최종 업데이트: {updatedAt}</p> : <span />}
                <button
                  type="button"
                  onClick={() => setShowOverviewModal(true)}
                  disabled={isOverviewDisabled}
                  className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>전체 가이드 보기</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">오늘 바로 확인할 가이드</h2>
                  <p className="mt-1 text-sm text-gray-400">대표 문장을 먼저 보고, 필요할 때만 더보기로 전체 원문을 확인하세요.</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 font-semibold text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>확인 완료 {confirmedGuideCount}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
                    <Clock3 className="h-4 w-4" />
                    <span>남은 {remainingGuideCount}</span>
                  </div>
                </div>
              </div>

              {guideItems.length > 0 ? (
                <div className="space-y-4">
                  {guideItems.map((item) => (
                    <GuideActionCard
                      key={item.id}
                      item={item}
                      confirmed={confirmedGuideIds.includes(item.id)}
                      onToggleConfirmed={handleToggleConfirmed}
                      onOpenDetail={setSelectedGuideId}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-[28px] border border-gray-200 bg-white p-8 text-center shadow-sm">
                  <p className="font-semibold text-gray-600">표시할 가이드가 아직 없습니다.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {selectedGuide ? (
        <GuideDetailModal
          item={selectedGuide}
          onClose={() => setSelectedGuideId(null)}
        />
      ) : null}

      {showOverviewModal && result ? (
        <GuideOverviewModal
          items={guideItems}
          updatedAt={updatedAt}
          references={result.source_references ?? []}
          safetyNotice={safetyNotice}
          onClose={() => setShowOverviewModal(false)}
        />
      ) : null}
    </>
  );
}
