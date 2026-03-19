import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Coffee, Dumbbell, Moon, Pill, Smartphone, Sparkles, Wine, type LucideIcon } from "lucide-react";
import { guideApi, type GuideJobResult, type GuideStatus, medicationApi, type MedicationInfo } from "@/lib/api";

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

interface GuideCardItem {
  id: string;
  title: string;
  state: string;
  action: string;
  fullDescription: string;
  tone: "green" | "blue" | "orange" | "red";
  kind: "medication" | "lifestyle";
}

interface GuideSummaryItem {
  id: string;
  title: string;
  state: string;
  action: string;
  tone: GuideCardItem["tone"];
}

type GuideCategoryKey =
  | "medication"
  | "exercise"
  | "sleep"
  | "screenTime"
  | "caffeine"
  | "alcohol"
  | "default";

function formatSafetySourceLabel(source: string | null | undefined): string {
  if (source === "DB") return "drugDB(psych_drugs)";
  if (source === "EASY_DRUG") return "e약은요";
  if (source === "LLM") return "LLM";
  return "미확인";
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

const GUIDE_TONE_STYLES = {
  green: {
    stateClass: "text-green-800",
    buttonClass: "text-green-700 hover:text-green-800",
    summaryStateClass: "text-green-50",
  },
  blue: {
    stateClass: "text-blue-800",
    buttonClass: "text-blue-700 hover:text-blue-800",
    summaryStateClass: "text-blue-50",
  },
  orange: {
    stateClass: "text-amber-800",
    buttonClass: "text-amber-700 hover:text-amber-800",
    summaryStateClass: "text-amber-50",
  },
  red: {
    stateClass: "text-red-700",
    buttonClass: "text-red-700 hover:text-red-800",
    summaryStateClass: "text-red-100",
  },
} as const;

const GUIDE_CATEGORY_STYLES: Record<
  GuideCategoryKey,
  {
    borderClass: string;
    iconWrapClass: string;
    iconClass: string;
    Icon: LucideIcon;
  }
> = {
  medication: {
    borderClass: "border-green-200",
    iconWrapClass: "bg-green-50",
    iconClass: "text-green-600",
    Icon: Pill,
  },
  exercise: {
    borderClass: "border-blue-200",
    iconWrapClass: "bg-blue-50",
    iconClass: "text-blue-600",
    Icon: Dumbbell,
  },
  sleep: {
    borderClass: "border-amber-200",
    iconWrapClass: "bg-amber-50",
    iconClass: "text-amber-600",
    Icon: Moon,
  },
  screenTime: {
    borderClass: "border-sky-200",
    iconWrapClass: "bg-sky-50",
    iconClass: "text-sky-600",
    Icon: Smartphone,
  },
  caffeine: {
    borderClass: "border-orange-200",
    iconWrapClass: "bg-orange-50",
    iconClass: "text-orange-600",
    Icon: Coffee,
  },
  alcohol: {
    borderClass: "border-rose-200",
    iconWrapClass: "bg-rose-50",
    iconClass: "text-rose-600",
    Icon: Wine,
  },
  default: {
    borderClass: "border-gray-200",
    iconWrapClass: "bg-gray-100",
    iconClass: "text-gray-500",
    Icon: Sparkles,
  },
};

const ACTION_HINT_PATTERN = /하세요|해 주세요|권장|상담|확인|예약|유지|줄이|피하|우선|시작|복용|관리|점검|받아/;
const RISK_PATTERN = /(주의|위험|부족|상담|알레르기|과다|중단|저하|부작용|심한|경고)/;
const ONE_LINE_CLAMP_STYLE = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 1,
  overflow: "hidden",
};
const TWO_LINE_CLAMP_STYLE = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 2,
  overflow: "hidden",
};

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function summarizeText(text: string, maxLength = 60) {
  const normalized = normalizeText(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function getGuideTone(text: string): GuideCardItem["tone"] {
  if (/수면|취침|잠|각성|졸림|피로/.test(text)) return "orange";
  if (RISK_PATTERN.test(text)) return "red";
  if (/복약|약|복용|mg|투약/.test(text)) return "green";
  return "blue";
}

function buildMedicationFullDescription(
  med: MedicationGuideItem,
  medInfoByName: Record<string, MedicationInfo | undefined>,
): string {
  const drugName = med.drug_name ?? "약물";
  const medInfo = drugName ? medInfoByName[drugName] : undefined;
  const doseText = med.dose != null ? `${med.dose}mg` : "용량 정보 없음";
  const frequency = med.frequency_per_day != null ? med.frequency_per_day : "-";
  const dosage = med.dosage_per_once != null ? med.dosage_per_once : "-";
  const intakeTimes = Array.isArray(med.intake_time) ? med.intake_time : [];
  const intakeLine = intakeTimes.length > 0 ? `복용 시간: ${intakeTimes.join(", ")}` : "";
  const sideEffectLine = med.side_effect ? `⚠️ 주의: ${med.side_effect} 현상이 있을 수 있습니다.` : "";
  const precautionsText = med.precautions ?? medInfo?.precautions ?? medInfo?.warnings;
  const precautionsLine = precautionsText
    ? `주의사항: ${precautionsText}`
    : "";
  const sideEffectsText = med.side_effects ?? medInfo?.side_effects;
  const sideEffectsFromApi = sideEffectsText
    ? `부작용: ${sideEffectsText}`
    : "";
  const hasApiInfo = Boolean(precautionsText || sideEffectsText);
  const sourceLine = `출처: ${formatSafetySourceLabel(med.safety_source ?? medInfo?.source)}`;
  const fallbackSafetyLine = !hasApiInfo
    ? "주의사항/부작용 정보가 없습니다. 복용 중 이상 반응이 있으면 의료진과 상담하세요."
    : "";

  return [
    `${drugName} (${doseText}) 안내입니다.`,
    `하루에 ${frequency}번, 한 번에 ${dosage}알씩 드시면 됩니다.`,
    intakeLine,
    sideEffectLine,
    precautionsLine,
    sideEffectsFromApi,
    fallbackSafetyLine,
    sourceLine,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildMedicationCards(
  raw: string,
  medInfoByName: Record<string, MedicationInfo | undefined>,
): GuideCardItem[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [{
        id: "medication-summary",
        title: "복약 안내",
        state: "복약 안내 확인",
        action: summarizeText(raw),
        fullDescription: raw,
        tone: getGuideTone(raw),
        kind: "medication",
      }];
    }

    return parsed
      .filter((item): item is MedicationGuideItem => typeof item === "object" && item !== null)
      .map((med, index) => {
        const drugName = med.drug_name ?? "약물";
        const medInfo = drugName ? medInfoByName[drugName] : undefined;
        const intakeTimes = Array.isArray(med.intake_time) ? med.intake_time : [];
        const precautionsText = med.precautions ?? medInfo?.precautions ?? medInfo?.warnings;
        const sideEffectsText = med.side_effects ?? medInfo?.side_effects;
        const cautionText = med.side_effect ?? precautionsText ?? sideEffectsText;
        const timeText = intakeTimes.length > 0 ? `${intakeTimes.join(", ")}에` : "정해진 시간에";
        const frequencyText = med.frequency_per_day != null ? `하루 ${med.frequency_per_day}회` : "복용 횟수를 확인해";
        const dosageText = med.dosage_per_once != null ? `1회 ${med.dosage_per_once}알씩` : "1회 복용량을 확인해";

        return {
          id: `medication-${drugName}-${index}`,
          title: drugName,
          state: cautionText ? `${drugName} 복약 시 주의 필요` : `${drugName} 복약 관리`,
          action: `${timeText} ${frequencyText} ${dosageText} 복용하세요.`,
          fullDescription: buildMedicationFullDescription(med, medInfoByName),
          tone: getGuideTone(`${drugName} ${cautionText ?? ""}`),
          kind: "medication",
        };
      });
  } catch {
    return [{
      id: "medication-summary",
      title: "복약 안내",
      state: "복약 안내 확인",
      action: summarizeText(raw),
      fullDescription: raw,
      tone: getGuideTone(raw),
      kind: "medication",
    }];
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

function getLifestyleState(title: string, content: string) {
  if (title === "수면" && /부족|각성|졸림|피로/.test(content)) return "수면 부족";
  if (title === "식사") return "식사 리듬 점검 필요";
  if (title === "운동") return "활동량 조절 필요";
  if (title === "스크린 타임 제한") return "스크린 사용 조절 필요";
  if (title === "카페인 제한") return "카페인 조절 필요";
  if (title === "흡연 제한") return "흡연 관리 필요";
  if (title === "음주 제한") return "음주 조절 필요";
  if (title === "건강 습관 지속") return "현재 루틴 유지 가능";
  return summarizeText(content, 26);
}

function extractActionText(content: string) {
  const sentences = splitSentences(content);
  const actionSentence = sentences.find((sentence) => ACTION_HINT_PATTERN.test(sentence))
    ?? sentences[1]
    ?? sentences[0]
    ?? content;
  return summarizeText(actionSentence, 64);
}

function buildLifestyleCards(raw: string): GuideCardItem[] {
  const formatted = formatLifestyleGuidanceText(raw);
  const blocks = formatted
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const [title, ...rest] = block.split("\n");
    const content = rest.join("\n").trim();
    const fullDescription = content || block;

    return {
      id: `lifestyle-${title}-${index}`,
      title,
      state: content ? getLifestyleState(title, content) : `${title} 확인 필요`,
      action: content ? extractActionText(content) : summarizeText(block),
      fullDescription,
      tone: getGuideTone(`${title} ${content}`),
      kind: "lifestyle",
    };
  });
}

function buildGuideSummaries(items: GuideCardItem[]): GuideSummaryItem[] {
  const priorityMap: Record<GuideCardItem["tone"], number> = {
    red: 0,
    orange: 1,
    blue: 2,
    green: 2,
  };

  return [...items]
    .sort((a, b) => {
      const priorityDiff = priorityMap[a.tone] - priorityMap[b.tone];
      if (priorityDiff !== 0) return priorityDiff;
      return 0;
    })
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      title: item.title,
      state: item.state,
      action: item.action,
      tone: item.tone,
    }));
}

function getGuideCategory(item: GuideCardItem): GuideCategoryKey {
  if (item.kind === "medication") return "medication";
  if (item.title === "운동") return "exercise";
  if (item.title === "수면") return "sleep";
  if (item.title === "스크린 타임 제한") return "screenTime";
  if (item.title === "카페인 제한") return "caffeine";
  if (item.title === "음주 제한") return "alcohol";
  return "default";
}

function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="px-1 text-sm font-bold text-gray-700">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function GuideCard({ item }: { item: GuideCardItem }) {
  const [expanded, setExpanded] = useState(false);
  const toneStyles = GUIDE_TONE_STYLES[item.tone];
  const categoryStyles = GUIDE_CATEGORY_STYLES[getGuideCategory(item)];
  const Icon = categoryStyles.Icon;
  const isLifestyle = item.kind === "lifestyle";

  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 ${categoryStyles.borderClass}`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${categoryStyles.iconWrapClass}`}>
          <Icon className={`h-5 w-5 ${categoryStyles.iconClass}`} />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-base font-bold text-gray-800">{item.title}</p>
          </div>

          <div>
            <p className={`text-sm font-bold ${toneStyles.stateClass}`} style={ONE_LINE_CLAMP_STYLE}>
              {item.state}
            </p>
          </div>

          {isLifestyle ? (
            <p className="text-sm leading-relaxed text-gray-700">
              {item.action}
            </p>
          ) : (
            <div>
              <p className="text-sm leading-relaxed text-gray-700" style={TWO_LINE_CLAMP_STYLE}>
                {item.action}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={`min-h-11 text-sm font-semibold transition-colors ${toneStyles.buttonClass}`}
          >
            {expanded ? "접기" : "더보기"}
          </button>

          {expanded && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 animate-fade-in">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                {item.fullDescription}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GuideSummaryBox({ items }: { items: GuideSummaryItem[] }) {
  return (
    <div className="gradient-primary rounded-2xl px-6 py-5 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-base font-bold text-white">오늘의 핵심 가이드</p>
          <p className="text-sm text-green-100">지금 가장 먼저 확인하면 좋은 항목입니다.</p>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {items.map((item) => {
          const toneStyles = GUIDE_TONE_STYLES[item.tone];

          return (
            <li
              key={item.id}
              className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-green-100">
                {item.title}
              </p>
              <p className={`mt-1 text-sm font-bold ${toneStyles.summaryStateClass}`}>
                {item.state}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/90" style={TWO_LINE_CLAMP_STYLE}>
                {item.action}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function AiGuide() {
  const [status, setStatus] = useState<GuideStatus | "IDLE">("IDLE");
  const [result, setResult] = useState<GuideJobResult | null>(null);
  const [error, setError] = useState("");
  const [medInfoByName, setMedInfoByName] = useState<Record<string, MedicationInfo | undefined>>({});
  const [pollElapsed, setPollElapsed] = useState(0);
  const cancelledRef = useRef(false);

  async function loadGuide() {
    const jobId = localStorage.getItem("guide_job_id");
    if (!jobId) {
      setStatus("IDLE");
      return;
    }
    setError("");
    try {
      const guideStatus = await guideApi.getJobStatus(jobId);
      if (guideStatus.status === "SUCCEEDED") {
        const guideResult = await guideApi.getJobResult(jobId);
        setResult(guideResult);
        setStatus("SUCCEEDED");
      } else if (guideStatus.status === "FAILED") {
        setStatus("FAILED");
        setError(guideStatus.error_message ?? "가이드 생성에 실패했습니다.");
      } else {
        setStatus(guideStatus.status);
        pollStatus(jobId);
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
        const guideStatus = await guideApi.getJobStatus(jobId);
        if (guideStatus.status === "SUCCEEDED") {
          const guideResult = await guideApi.getJobResult(jobId);
          if (cancelledRef.current) return;
          setResult(guideResult);
          setStatus("SUCCEEDED");
          return;
        }
        if (guideStatus.status === "FAILED") {
          setStatus("FAILED");
          setError(guideStatus.error_message ?? "가이드 생성에 실패했습니다.");
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
    const names = Array.from(new Set(meds.map((med) => med.drug_name).filter((name): name is string => !!name)));
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

  const medicationCards = useMemo(
    () => result?.medication_guidance ? buildMedicationCards(result.medication_guidance, medInfoByName) : [],
    [result?.medication_guidance, medInfoByName],
  );

  const lifestyleCards = useMemo(
    () => result?.lifestyle_guidance ? buildLifestyleCards(result.lifestyle_guidance) : [],
    [result?.lifestyle_guidance],
  );

  const guideSummaries = useMemo(
    () => buildGuideSummaries([...medicationCards, ...lifestyleCards]),
    [medicationCards, lifestyleCards],
  );

  const updatedAt = result?.updated_at
    ? new Date(result.updated_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-full max-w-3xl mx-auto p-4 md:p-8 stagger-children">
      <div className="mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">AI 가이드</h1>
          <p className="mt-0.5 text-sm font-medium text-gray-400">복약 및 생활습관 맞춤 가이드</p>
        </div>
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
            className="mt-4 rounded-xl gradient-primary px-5 py-2 text-sm font-bold text-white transition-all duration-200 hover:shadow-lg"
          >
            다시 시도
          </button>
        </div>
      )}

      {status === "SUCCEEDED" && result && (
        <div className="space-y-5">
          <div className="gradient-primary flex items-center gap-4 rounded-2xl px-6 py-5 text-white shadow-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold">AI 가이드 생성완료</p>
              <p className="mt-0.5 text-sm text-green-100">
                처방전이나 일상 기록 정보를 수정하시면, 그에 맞춰 AI 가이드와 알림 설정이 자동으로 변경됩니다.
              </p>
              {updatedAt && (
                <p className="mt-0.5 text-sm text-green-100">최종 업데이트: {updatedAt}</p>
              )}
            </div>
          </div>

          {guideSummaries.length > 0 && (
            <GuideSummaryBox items={guideSummaries} />
          )}

          {result.adherence_rate_percent != null && (
            <div className="card-warm flex items-center justify-between p-5">
              <div>
                <p className="text-sm font-bold text-gray-700">일정 이행률</p>
                <p className="mt-0.5 text-xs text-gray-400">최근 분석 기간 기준</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">{result.adherence_rate_percent}%</p>
              </div>
            </div>
          )}

          {medicationCards.length > 0 && (
            <GuideSection title="복약 안내">
              {medicationCards.map((item) => (
                <GuideCard key={item.id} item={item} />
              ))}
            </GuideSection>
          )}

          {lifestyleCards.length > 0 && (
            <GuideSection title="생활 습관 가이드">
              {lifestyleCards.map((item) => (
                <GuideCard key={item.id} item={item} />
              ))}
            </GuideSection>
          )}

          {result.source_references?.length > 0 && (
            <div className="card-warm p-4">
              <p className="mb-2 text-xs font-bold uppercase text-gray-400">참고 자료</p>
              <ul className="space-y-1">
                {result.source_references.map((ref, index) => (
                  <li key={index} className="text-xs text-gray-500">
                    {ref.title} — <span className="text-gray-400">{ref.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-gray-200 p-5">
        <p className="mb-2 text-sm font-semibold text-gray-700">의료 안전 고지</p>
        <p className="text-xs leading-relaxed text-gray-500">
          본 서비스의 알림 및 복약 정보는 참고용이며, 의료진의 처방 및 지시를 대체하지 않습니다.
          복약 관련 이상반응이나 건강 이상이 느껴질 경우 즉시 의료 전문가와 상담하시기 바랍니다.
          처방된 약의 용량, 복용 시간, 주의사항은 반드시 담당 의사 또는 약사의 지도에 따르십시오.
        </p>
      </div>
    </div>
  );
}
