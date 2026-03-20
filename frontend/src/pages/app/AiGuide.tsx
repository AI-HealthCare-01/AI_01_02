import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Coffee,
  Cigarette,
  Dumbbell,
  type LucideIcon,
  Moon,
  Pill,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import { guideApi, GuideJobResult, GuideStatus, medicationApi, MedicationInfo } from "@/lib/api";

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

interface LifestyleGuideSection {
  id: string;
  key: string;
  title: string;
  content: string;
}

interface GuideVisualStyle {
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  borderClass: string;
}

interface GuideStatusMeta {
  label: string;
  className: string;
}

const MEDICATION_GUIDE_ID = "medication_guidance";

function formatSafetySourceLabel(source: string | null | undefined): string {
  if (source === "DB") return "drugDB(psych_drugs)";
  if (source === "EASY_DRUG") return "e약은요";
  if (source === "LLM") return "LLM";
  return "미확인";
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

const STATUS_CLASS_MAP = {
  danger: "text-[#D32F2F]",
  warning: "text-[#F57C00]",
  normal: "text-green-700",
} as const;

function buildStatusMeta(tone: keyof typeof STATUS_CLASS_MAP): GuideStatusMeta {
  const labelMap = {
    danger: "위험",
    warning: "주의",
    normal: "정상",
  } as const;
  return {
    label: labelMap[tone],
    className: STATUS_CLASS_MAP[tone],
  };
}

function getGuideVisualStyle(key: string): GuideVisualStyle {
  const styleMap: Record<string, GuideVisualStyle> = {
    medication_guidance: {
      icon: Pill,
      iconBgClass: "bg-[#E8F5E9]",
      iconColorClass: "text-[#2E7D32]",
      borderClass: "border-[#C8E6C9]",
    },
    nutrition_guide: {
      icon: UtensilsCrossed,
      iconBgClass: "bg-[#FFF8E1]",
      iconColorClass: "text-[#F57C00]",
      borderClass: "border-[#FFE0B2]",
    },
    exercise_guide: {
      icon: Dumbbell,
      iconBgClass: "bg-[#E3F2FD]",
      iconColorClass: "text-[#1976D2]",
      borderClass: "border-[#BBDEFB]",
    },
    concentration_strategy: {
      icon: Smartphone,
      iconBgClass: "bg-[#EDE7F6]",
      iconColorClass: "text-[#5E35B1]",
      borderClass: "border-[#D1C4E9]",
    },
    sleep_guide: {
      icon: Moon,
      iconBgClass: "bg-[#FFF3E0]",
      iconColorClass: "text-[#EF6C00]",
      borderClass: "border-[#FFCC80]",
    },
    caffeine_guide: {
      icon: Coffee,
      iconBgClass: "bg-[#FBE9E7]",
      iconColorClass: "text-[#8D6E63]",
      borderClass: "border-[#FFCCBC]",
    },
    smoking_guide: {
      icon: Cigarette,
      iconBgClass: "bg-[#FCE4EC]",
      iconColorClass: "text-[#C2185B]",
      borderClass: "border-[#F8BBD0]",
    },
    drinking_guide: {
      icon: Wine,
      iconBgClass: "bg-[#FFF8E1]",
      iconColorClass: "text-[#FB8C00]",
      borderClass: "border-[#FFE082]",
    },
    general_health_guide: {
      icon: Sparkles,
      iconBgClass: "bg-[#E8F5E9]",
      iconColorClass: "text-[#2E7D32]",
      borderClass: "border-[#C8E6C9]",
    },
  };

  return styleMap[key] ?? styleMap.general_health_guide;
}

function readRiskCodes(result: GuideJobResult | null): Record<string, string> {
  const raw = result?.structured_data?.risk_codes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, String(value)]),
  );
}

function getLifestyleGuideStatusMeta(guideKey: string, riskCodes: Record<string, string>): GuideStatusMeta {
  const hasRisk = (code: string | undefined) => Boolean(code) && code !== "NONE";

  switch (guideKey) {
    case "nutrition_guide":
      return riskCodes.nutrition_risk_code === "UNDERWEIGHT_HIGH_RISK"
        ? buildStatusMeta("danger")
        : hasRisk(riskCodes.nutrition_risk_code)
          ? buildStatusMeta("warning")
          : buildStatusMeta("normal");
    case "sleep_guide":
      return riskCodes.sleep_risk_code === "SLEEP_HIGH_RISK"
        ? buildStatusMeta("danger")
        : hasRisk(riskCodes.sleep_risk_code)
          ? buildStatusMeta("warning")
          : buildStatusMeta("normal");
    case "caffeine_guide":
    case "smoking_guide":
      return hasRisk(riskCodes[guideKey === "caffeine_guide" ? "caffeine_risk_code" : "smoking_risk_code"])
        ? buildStatusMeta("danger")
        : buildStatusMeta("normal");
    case "drinking_guide":
      return riskCodes.alcohol_risk_code === "ALCOHOL_HIGH_RISK"
        ? buildStatusMeta("danger")
        : riskCodes.alcohol_risk_code === "ALCOHOL_REGULAR"
          ? buildStatusMeta("warning")
          : buildStatusMeta("normal");
    case "exercise_guide":
    case "concentration_strategy":
      return hasRisk(riskCodes[guideKey === "exercise_guide" ? "lifestyle_risk_code" : "digital_risk_code"])
        ? buildStatusMeta("warning")
        : buildStatusMeta("normal");
    case "general_health_guide":
      return buildStatusMeta("normal");
    default:
      return buildStatusMeta("warning");
  }
}

function getMedicationStatusMeta(riskLevel: string): GuideStatusMeta {
  if (riskLevel === "HIGH") return buildStatusMeta("danger");
  if (riskLevel === "MEDIUM") return buildStatusMeta("warning");
  return buildStatusMeta("normal");
}

function parseLifestyleGuidanceSections(raw: string): LifestyleGuideSection[] {
  const buildSection = (key: string, content: string): LifestyleGuideSection | null => {
    const trimmed = content.trim();
    if (!trimmed) return null;
    return {
      id: key,
      key,
      title: LIFESTYLE_GUIDE_LABEL_MAP[key] ?? key,
      content: trimmed,
    };
  };

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const sections = Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => buildSection(key, String(value)))
        .filter((section): section is LifestyleGuideSection => Boolean(section));
      if (sections.length > 0) return sections;
    }
  } catch {
    // fallback to line-based parser
  }

  const sections = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsedSections = sections
    .map((line) => {
      const sepIndex = line.indexOf(":");
      if (sepIndex <= 0) return null;
      const key = line.slice(0, sepIndex).trim();
      const content = line.slice(sepIndex + 1).trim();
      return buildSection(key, content);
    })
    .filter((section): section is LifestyleGuideSection => Boolean(section));

  if (parsedSections.length > 0) return parsedSections;

  const fallback = buildSection("lifestyle_guidance", raw);
  return fallback ? [fallback] : [];
}

function splitGuidePreview(content: string): { lead: string; detail: string } {
  const trimmed = content.trim();
  if (!trimmed) return { lead: "", detail: "" };

  const [lead, ...rest] = trimmed.split(/(?<=[.!?])\s+/u);
  return {
    lead: lead?.trim() || trimmed,
    detail: rest.join(" ").trim(),
  };
}

function readCheckedGuideIds(storageKey: string): string[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseMedicationGuidanceLineGroups(
  raw: string,
  medInfoByName: Record<string, MedicationInfo | undefined>,
): string[][] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const items = parsed
      .filter((item): item is MedicationGuideItem => typeof item === "object" && item !== null)
      .map((med) => buildMedicationGuidanceLines(med, medInfoByName))
      .filter((lines) => lines.length > 0);

    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

function buildMedicationGuideSummary(
  raw: string,
  medInfoByName: Record<string, MedicationInfo | undefined>,
): string {
  const items = parseMedicationGuidanceLineGroups(raw, medInfoByName);
  if (!items || items.length === 0) {
    return splitGuidePreview(raw).lead;
  }

  const [title, description] = items[0];
  return [title, description].filter(Boolean).join(" ");
}

function renderMedicationGuidanceContent(
  raw: string,
  medInfoByName: Record<string, MedicationInfo | undefined>,
): React.ReactNode {
  const items = parseMedicationGuidanceLineGroups(raw, medInfoByName);
  if (!items) {
    return <p>{raw}</p>;
  }

  return (
    <div className="space-y-5">
      {items.map((lines, index) => {
        const [title, ...rest] = lines;
        return (
          <div key={`${title}-${index}`} className="space-y-2">
            <p className="text-sm font-extrabold text-green-900/85">{title}</p>
            {rest.map((line) => (
              <p key={line} className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {line}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function LifestyleGuideCard({
  guide,
  checked,
  expanded,
  updatedAt,
  style,
  status,
  onToggleChecked,
  onToggleExpanded,
}: {
  guide: LifestyleGuideSection;
  checked: boolean;
  expanded: boolean;
  updatedAt: string | null;
  style: GuideVisualStyle;
  status: GuideStatusMeta;
  onToggleChecked: () => void;
  onToggleExpanded: () => void;
}) {
  const { lead } = splitGuidePreview(guide.content);
  const Icon = style.icon;

  return (
    <div className={`card-warm border bg-white p-5 transition-all duration-200 ${style.borderClass} ${checked ? "ring-2 ring-green-200" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.iconBgClass}`}>
              <Icon className={`h-6 w-6 ${style.iconColorClass}`} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-bold text-gray-700">{guide.title}</span>
                <span className={`text-xs font-bold ${status.className}`}>{status.label}</span>
                {checked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    확인함
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-800 leading-relaxed whitespace-pre-wrap">{lead}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onToggleChecked}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all duration-200 ${
            checked
              ? "bg-green-600 text-white shadow-sm hover:bg-green-700"
              : "bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {checked ? "확인 완료" : "확인했어요"}
        </button>
      </div>

      <div className="mt-4 flex items-center">
        <button
          onClick={onToggleExpanded}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-green-300 hover:text-green-700"
        >
          더보기
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">상세 설명</p>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-gray-600">{guide.content}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
            <span>항목: {guide.title}</span>
            {updatedAt && <span>업데이트: {updatedAt}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function MedicationGuideCard({
  summary,
  checked,
  expanded,
  updatedAt,
  status,
  children,
  onToggleChecked,
  onToggleExpanded,
}: {
  summary: string;
  checked: boolean;
  expanded: boolean;
  updatedAt: string | null;
  status: GuideStatusMeta;
  children: React.ReactNode;
  onToggleChecked: () => void;
  onToggleExpanded: () => void;
}) {
  const style = getGuideVisualStyle("medication_guidance");
  const Icon = style.icon;
  const { lead } = splitGuidePreview(summary);

  return (
    <div className={`card-warm border bg-white p-5 transition-all duration-200 ${style.borderClass} ${checked ? "ring-2 ring-green-200" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.iconBgClass}`}>
              <Icon className={`h-6 w-6 ${style.iconColorClass}`} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-bold text-gray-700">복약</span>
                <span className={`text-xs font-bold ${status.className}`}>{status.label}</span>
                {checked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    확인함
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-800 leading-relaxed whitespace-pre-wrap">{lead}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onToggleChecked}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all duration-200 ${
            checked
              ? "bg-green-600 text-white shadow-sm hover:bg-green-700"
              : "bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {checked ? "확인 완료" : "확인했어요"}
        </button>
      </div>

      <div className="mt-4 flex items-center">
        <button
          onClick={onToggleExpanded}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-green-300 hover:text-green-700"
        >
          더보기
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{children}</div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
            <span>항목: 복약</span>
            {updatedAt && <span>업데이트: {updatedAt}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AiGuide() {
  const [status, setStatus] = useState<GuideStatus | "IDLE">("IDLE");
  const [result, setResult] = useState<GuideJobResult | null>(null);
  const [error, setError] = useState("");
  const [medInfoByName, setMedInfoByName] = useState<Record<string, MedicationInfo | undefined>>({});
  const [pollElapsed, setPollElapsed] = useState(0);
  const [checkedGuideIds, setCheckedGuideIds] = useState<string[]>([]);
  const [expandedGuideIds, setExpandedGuideIds] = useState<string[]>([]);
  const cancelledRef = useRef(false);

  async function loadGuide() {
    setError("");
    try {
      let s;
      try {
        s = await guideApi.getLatestJobStatus();
        localStorage.setItem("guide_job_id", s.job_id);
      } catch {
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
      await new Promise((r) => setTimeout(r, 3000));
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
    return () => { cancelledRef.current = true; };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!result?.medication_guidance) return;
    let meds: MedicationGuideItem[] = [];
    try {
      const parsed = JSON.parse(result.medication_guidance) as unknown;
      if (Array.isArray(parsed)) meds = parsed as MedicationGuideItem[];
    } catch {
      return;
    }
    const names = Array.from(new Set(meds.map((m) => m.drug_name).filter((n): n is string => !!n)));
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
    });
  }, [result?.medication_guidance]); // eslint-disable-line

  const medicationGuidanceContent = useMemo(
    () => result?.medication_guidance ? renderMedicationGuidanceContent(result.medication_guidance, medInfoByName) : null,
    [result?.medication_guidance, medInfoByName],
  );
  const medicationGuideSummary = useMemo(
    () => result?.medication_guidance ? buildMedicationGuideSummary(result.medication_guidance, medInfoByName) : "",
    [result?.medication_guidance, medInfoByName],
  );

  const lifestyleGuides = useMemo(
    () => result?.lifestyle_guidance ? parseLifestyleGuidanceSections(result.lifestyle_guidance) : [],
    [result?.lifestyle_guidance],
  );

  const actionGuideIds = useMemo(
    () => [
      ...(result?.medication_guidance ? [MEDICATION_GUIDE_ID] : []),
      ...lifestyleGuides.map((guide) => guide.id),
    ],
    [result?.medication_guidance, lifestyleGuides],
  );
  const checkedStorageKey = result ? `guide_checked:${result.job_id}` : null;

  useEffect(() => {
    setExpandedGuideIds([]);
    if (!checkedStorageKey) {
      setCheckedGuideIds([]);
      return;
    }
    const validIds = new Set(actionGuideIds);
    setCheckedGuideIds(readCheckedGuideIds(checkedStorageKey).filter((id) => validIds.has(id)));
  }, [actionGuideIds, checkedStorageKey]);

  useEffect(() => {
    if (!checkedStorageKey) return;
    localStorage.setItem(checkedStorageKey, JSON.stringify(checkedGuideIds));
  }, [checkedGuideIds, checkedStorageKey]);

  const checkedGuideSet = useMemo(() => new Set(checkedGuideIds), [checkedGuideIds]);
  const expandedGuideSet = useMemo(() => new Set(expandedGuideIds), [expandedGuideIds]);
  const totalGuideCount = actionGuideIds.length;
  const checkedGuideCount = actionGuideIds.filter((id) => checkedGuideSet.has(id)).length;
  const remainingGuideCount = Math.max(totalGuideCount - checkedGuideCount, 0);
  const riskCodes = useMemo(() => readRiskCodes(result), [result]);
  const medicationStatus = useMemo(() => getMedicationStatusMeta(result?.risk_level ?? "LOW"), [result?.risk_level]);

  const updatedAt = result?.updated_at
    ? new Date(result.updated_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const summaryHeadline = totalGuideCount === 0
    ? "오늘 확인할 가이드를 준비하고 있어요."
    : checkedGuideCount === 0
      ? `오늘 신경 써야 할 가이드가 ${totalGuideCount}개 있어요!`
      : checkedGuideCount === totalGuideCount
        ? `오늘의 가이드 ${totalGuideCount}개를 모두 확인했어요!`
        : `오늘의 가이드 ${totalGuideCount}개 중 ${checkedGuideCount}개를 확인했어요!`;

  const summaryDescription = totalGuideCount === 0
    ? "처방전과 생활 기록이 반영되면 행동 가이드가 이곳에 정리됩니다."
    : remainingGuideCount > 0
      ? `남은 가이드 ${remainingGuideCount}개를 천천히 확인해 보세요.`
      : "오늘 필요한 가이드를 모두 확인했습니다. 처방이나 기록이 바뀌면 자동으로 다시 갱신됩니다.";

  function toggleGuideChecked(id: string) {
    setCheckedGuideIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  }

  function toggleGuideExpanded(id: string) {
    setExpandedGuideIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  }

  return (
    <div className="min-h-full p-4 md:p-8 max-w-3xl mx-auto stagger-children">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">AI 가이드</h1>
          <p className="text-sm text-gray-400 mt-0.5 font-medium">복약 및 생활습관 맞춤 가이드</p>
        </div>
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
          <div className="flex-1">
            <p className="font-bold">AI 가이드 생성중</p>
            <p className="text-sm text-green-100 mt-0.5">
              {pollElapsed > 0 ? `${pollElapsed}초 경과 — 잠시만 기다려주세요...` : "잠시만 기다려주세요..."}
            </p>
          </div>
          <button
            onClick={() => { cancelledRef.current = true; setStatus("IDLE"); setPollElapsed(0); }}
            className="text-sm text-green-100 hover:text-white underline"
          >
            취소
          </button>
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
          <div className="gradient-primary rounded-2xl px-6 py-5 text-white shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-green-100">오늘의 액션 가이드</p>
                <p className="mt-1 text-2xl font-bold leading-snug">{summaryHeadline}</p>
                <p className="mt-2 text-sm text-green-100">{summaryDescription}</p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/12 px-4 py-3">
                <p className="text-xs font-semibold text-green-100">전체 가이드</p>
                <p className="mt-1 text-2xl font-bold">{totalGuideCount}</p>
              </div>
              <div className="rounded-2xl bg-white/12 px-4 py-3">
                <p className="text-xs font-semibold text-green-100">확인함</p>
                <p className="mt-1 text-2xl font-bold">{checkedGuideCount}</p>
              </div>
              <div className="rounded-2xl bg-white/12 px-4 py-3">
                <p className="text-xs font-semibold text-green-100">남음</p>
                <p className="mt-1 text-2xl font-bold">{remainingGuideCount}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-green-100">
              {updatedAt && <span>최종 업데이트: {updatedAt}</span>}
              {result.adherence_rate_percent != null && (
                <span>일정 이행률: {result.adherence_rate_percent}%</span>
              )}
            </div>
          </div>

          {medicationGuidanceContent && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-bold text-gray-700">오늘의 복약 안내</p>
              </div>
              <MedicationGuideCard
                summary={medicationGuideSummary}
                checked={checkedGuideSet.has(MEDICATION_GUIDE_ID)}
                expanded={expandedGuideSet.has(MEDICATION_GUIDE_ID)}
                updatedAt={updatedAt}
                status={medicationStatus}
                onToggleChecked={() => toggleGuideChecked(MEDICATION_GUIDE_ID)}
                onToggleExpanded={() => toggleGuideExpanded(MEDICATION_GUIDE_ID)}
              >
                {medicationGuidanceContent}
              </MedicationGuideCard>
            </div>
          )}

          {lifestyleGuides.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <p className="text-sm font-bold text-gray-700">오늘 바로 확인할 가이드</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {checkedGuideCount}
                  <Circle className="h-4 w-4 text-gray-300" />
                  {remainingGuideCount}
                </div>
              </div>

              {lifestyleGuides.map((guide) => (
                <LifestyleGuideCard
                  key={guide.id}
                  guide={guide}
                  checked={checkedGuideSet.has(guide.id)}
                  expanded={expandedGuideSet.has(guide.id)}
                  updatedAt={updatedAt}
                  style={getGuideVisualStyle(guide.key)}
                  status={getLifestyleGuideStatusMeta(guide.key, riskCodes)}
                  onToggleChecked={() => toggleGuideChecked(guide.id)}
                  onToggleExpanded={() => toggleGuideExpanded(guide.id)}
                />
              ))}
            </div>
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
