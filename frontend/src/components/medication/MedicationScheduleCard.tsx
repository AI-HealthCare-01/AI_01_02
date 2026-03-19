import { useEffect, useState } from "react";
import { Check, Square } from "lucide-react";
import { OcrMedication, ScheduleItem } from "@/lib/api";

const INTAKE_TIME_LABEL: Record<string, string> = {
  morning: "아침",
  lunch: "점심",
  dinner: "저녁",
  bedtime: "취침 전",
  PRN: "필요 시",
};

const DEFAULT_TIME_LABEL_BY_SLOT = ["아침", "점심", "저녁", "취침 전"];

const DAILY_CONFIRM_STORAGE_PREFIX = "daily_med_confirmed";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function toDisplayIntakeLabels(raw: OcrMedication["intake_time"], frequencyPerDay: number | null): string[] {
  if (Array.isArray(raw)) {
    const labels = raw
      .map((value) => INTAKE_TIME_LABEL[String(value)] ?? String(value))
      .filter(Boolean);
    if (labels.length > 0) return labels;
  }

  if (typeof raw === "string" && raw.trim()) {
    const split = raw.includes(",")
      ? raw.split(",").map((value) => value.trim())
      : [raw.trim()];
    const labels = split
      .map((value) => INTAKE_TIME_LABEL[value] ?? value)
      .filter(Boolean);
    if (labels.length > 0) return labels;
  }

  const count = frequencyPerDay && frequencyPerDay > 0 ? Math.min(frequencyPerDay, DEFAULT_TIME_LABEL_BY_SLOT.length) : 1;
  return DEFAULT_TIME_LABEL_BY_SLOT.slice(0, count);
}

type Props = {
  title?: string;
  loading: boolean;
  ocrMeds: OcrMedication[];
  scheduleItems: ScheduleItem[];
  storageDateKey: string;
  onUpdateScheduleStatus: (itemId: string, status: "PENDING" | "DONE") => void;
  onProgressChange?: (progress: number, totalCount: number) => void;
};

export default function MedicationScheduleCard({
  title = "복약 일정",
  loading,
  ocrMeds,
  scheduleItems,
  storageDateKey,
  onUpdateScheduleStatus,
  onProgressChange,
}: Props) {
  const [manualConfirmedMap, setManualConfirmedMap] = useState<Record<string, boolean>>({});
  const dailyConfirmStorageKey = `${DAILY_CONFIRM_STORAGE_PREFIX}:${storageDateKey}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(dailyConfirmStorageKey);
      if (!raw) {
        setManualConfirmedMap({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setManualConfirmedMap(parsed ?? {});
    } catch {
      setManualConfirmedMap({});
    }
  }, [dailyConfirmStorageKey]);

  function toggleManualConfirm(key: string) {
    setManualConfirmedMap((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(dailyConfirmStorageKey, JSON.stringify(next));
      return next;
    });
  }

  const medicationItems = scheduleItems
    .filter((i) => i.category === "MEDICATION")
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const medicationRows = (() => {
    let scheduleCursor = 0;

    return ocrMeds.flatMap((med, medIndex) => {
      const intakeLabels = toDisplayIntakeLabels(med.intake_time, med.frequency_per_day);
      const rowCount = Math.max(1, intakeLabels.length);

      return Array.from({ length: rowCount }, (_, rowIndex) => {
        const scheduleItem = medicationItems[scheduleCursor] ?? null;
        if (scheduleItem) {
          scheduleCursor += 1;
        }

        return {
          med,
          key: `${med.drug_name}-${medIndex}-${rowIndex}`,
          intakeLabel: intakeLabels[rowIndex] ?? intakeLabels[intakeLabels.length - 1] ?? "-",
          scheduleItem,
          manualKey: `${med.drug_name}-${storageDateKey}-${rowIndex}`,
        };
      });
    });
  })();

  const completedMedicationCount = medicationRows.reduce((acc, row) => {
    if (row.scheduleItem) return acc + (row.scheduleItem.status === "DONE" ? 1 : 0);
    return acc + (manualConfirmedMap[row.manualKey] ? 1 : 0);
  }, 0);

  const progress = medicationRows.length > 0
    ? Math.round((completedMedicationCount / medicationRows.length) * 100)
    : 0;

  useEffect(() => {
    onProgressChange?.(progress, medicationRows.length);
  }, [onProgressChange, progress, medicationRows.length]);

  return (
    <div className="card-warm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-green-600">복약율 {progress}%</span>
          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full gradient-primary rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-400 py-6">불러오는 중...</p>
      ) : medicationRows.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-6">OCR로 추출된 복약 정보가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[92px_1fr_90px_110px_128px] gap-2 px-3 py-2 text-xs font-semibold text-gray-500">
            <span>복용시간</span>
            <span>약품명</span>
            <span>용량</span>
            <span>1회투약량</span>
            <span className="text-right">복약 여부</span>
          </div>
          {medicationRows.map(({ med, key, intakeLabel, scheduleItem, manualKey }) => {
            const isManualConfirmed = !!manualConfirmedMap[manualKey];
            const displayIntakeLabel = scheduleItem ? formatTime(scheduleItem.scheduled_at) : intakeLabel;
            const doseLabel = med.dose !== null && med.dose !== undefined ? `${med.dose}mg` : "-";
            const dosagePerOnce = med.dosage_per_once !== null && med.dosage_per_once !== undefined
              ? `${med.dosage_per_once}`
              : "-";

            return (
              <div key={key} className="grid grid-cols-[92px_1fr_90px_110px_128px] gap-2 items-center px-3 py-3 rounded-xl bg-white/80 shadow-sm">
                <span className="text-sm text-gray-600">{displayIntakeLabel}</span>
                <span className="text-sm font-semibold text-gray-800 truncate">{med.drug_name || "-"}</span>
                <span className="text-sm text-gray-700">{doseLabel}</span>
                <span className="text-sm text-gray-700">{dosagePerOnce}</span>
                <div className="flex items-center justify-end gap-1.5">
                  {scheduleItem ? (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateScheduleStatus(
                          scheduleItem.item_id,
                          scheduleItem.status === "DONE" ? "PENDING" : "DONE",
                        )
                      }
                      className={`inline-flex items-center justify-center p-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
                        scheduleItem.status === "DONE"
                          ? "text-gray-500"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                      aria-label={scheduleItem.status === "DONE" ? "복약 완료" : "복약 예정"}
                    >
                      <span className="relative flex h-5.5 w-5.5 items-center justify-center">
                        <Square className="h-5.5 w-5.5" strokeWidth={2.4} />
                        {scheduleItem.status === "DONE" && (
                          <Check className="absolute h-5 w-5 text-red-500" strokeWidth={3.6} />
                        )}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleManualConfirm(manualKey)}
                      className={`inline-flex items-center justify-center p-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
                        isManualConfirmed
                          ? "text-gray-500"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                      aria-label={isManualConfirmed ? "복약 완료" : "복약 예정"}
                    >
                      <span className="relative flex h-5.5 w-5.5 items-center justify-center">
                        <Square className="h-5.5 w-5.5" strokeWidth={2.4} />
                        {isManualConfirmed && (
                          <Check className="absolute h-5 w-5 text-red-500" strokeWidth={3.6} />
                        )}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
