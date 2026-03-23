import { useEffect, useState } from "react";
import { Check, Clock3, Pill } from "lucide-react";
import { OcrMedication, Reminder, ScheduleItem } from "@/lib/api";

const INTAKE_TIME_LABEL: Record<string, string> = {
  morning: "아침",
  lunch: "점심",
  dinner: "저녁",
  bedtime: "취침 전",
  PRN: "필요 시",
};

const DEFAULT_TIME_LABEL_BY_SLOT = ["아침", "점심", "저녁", "취침 전"];

const DAILY_CONFIRM_STORAGE_PREFIX = "daily_med_confirmed";

function formatTime(raw: string) {
  if (/^\d{2}:\d{2}$/.test(raw)) {
    const [hour, minute] = raw.split(":").map(Number);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date.toLocaleTimeString("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isDateWithinMedicationPeriod(
  targetDate: string,
  opts: {
    startDate?: string | null;
    endDate?: string | null;
    dispensedDate?: string | null;
    totalDays?: number | null;
  },
) {
  const effectiveStartDate = opts.startDate ?? opts.dispensedDate ?? null;
  const inferredEndDate = (
    opts.endDate
    ?? (opts.dispensedDate && opts.totalDays && opts.totalDays > 0 ? addDays(opts.dispensedDate, opts.totalDays - 1) : null)
  );

  if (effectiveStartDate && targetDate < effectiveStartDate) return false;
  if (inferredEndDate && targetDate > inferredEndDate) return false;
  return true;
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
  reminders?: Reminder[];
  scheduleItems: ScheduleItem[];
  storageDateKey: string;
  onUpdateScheduleStatus: (itemId: string, status: "PENDING" | "DONE" | "SKIPPED") => void;
  onProgressChange?: (progress: number, totalCount: number) => void;
};

export default function MedicationScheduleCard({
  title = "복약 일정",
  loading,
  ocrMeds,
  reminders = [],
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
  const filteredReminders = reminders.filter((reminder) =>
    isDateWithinMedicationPeriod(storageDateKey, {
      startDate: reminder.start_date,
      endDate: reminder.end_date,
      dispensedDate: reminder.dispensed_date,
      totalDays: reminder.total_days,
    }));
  const filteredOcrMeds = ocrMeds.filter((med) =>
    isDateWithinMedicationPeriod(storageDateKey, {
      dispensedDate: med.dispensed_date,
      totalDays: med.total_days,
    }));

  const medicationRows = (() => {
    const usedItemIds = new Set<string>();

    function findScheduleItems(drugName: string, count: number) {
      const matched: (typeof medicationItems[number] | null)[] = [];
      for (const item of medicationItems) {
        if (matched.length >= count) break;
        if (!usedItemIds.has(item.item_id) && item.title === drugName) {
          matched.push(item);
          usedItemIds.add(item.item_id);
        }
      }
      while (matched.length < count) matched.push(null);
      return matched;
    }

    if (filteredOcrMeds.length === 0) {
      return filteredReminders.flatMap((reminder, reminderIndex) => {
        const rowCount = Math.max(1, reminder.schedule_times.length);
        const matched = findScheduleItems(reminder.medication_name, rowCount);

        return Array.from({ length: rowCount }, (_, rowIndex) => {
          const reminderDose = reminder.dose?.trim() ?? "";
          const doseLabel = reminderDose && !reminderDose.includes("캡/정") ? reminderDose : "-";
          const dosagePerOnce = reminderDose && reminderDose.includes("캡/정") ? reminderDose : "-";

          return {
            key: `${reminder.medication_name}-${reminderIndex}-${rowIndex}`,
            intakeLabel: reminder.schedule_times[rowIndex] ?? "-",
            scheduleItem: matched[rowIndex],
            manualKey: `${reminder.medication_name}-${storageDateKey}-${rowIndex}`,
            drugName: reminder.medication_name || "-",
            doseLabel,
            dosagePerOnce,
          };
        });
      });
    }

    return filteredOcrMeds.flatMap((med, medIndex) => {
      const intakeLabels = toDisplayIntakeLabels(med.intake_time, med.frequency_per_day);
      const rowCount = Math.max(1, intakeLabels.length);
      const matched = findScheduleItems(med.drug_name, rowCount);

      return Array.from({ length: rowCount }, (_, rowIndex) => ({
        key: `${med.drug_name}-${medIndex}-${rowIndex}`,
        intakeLabel: intakeLabels[rowIndex] ?? intakeLabels[intakeLabels.length - 1] ?? "-",
        scheduleItem: matched[rowIndex],
        manualKey: `${med.drug_name}-${storageDateKey}-${rowIndex}`,
        drugName: med.drug_name || "-",
        doseLabel: med.dose !== null && med.dose !== undefined ? `${med.dose}mg` : "-",
        dosagePerOnce:
          med.dosage_per_once !== null && med.dosage_per_once !== undefined ? `${med.dosage_per_once}` : "-",
      }));
    });
  })();

  const completedMedicationCount = medicationRows.reduce((acc, row) => {
    if (row.scheduleItem) return acc + (row.scheduleItem.status === "DONE" ? 1 : 0);
    return acc + (manualConfirmedMap[row.manualKey] ? 1 : 0);
  }, 0);
  const skippedMedicationCount = medicationRows.reduce((acc, row) => {
    if (!row.scheduleItem) return acc;
    return acc + (row.scheduleItem.status === "SKIPPED" ? 1 : 0);
  }, 0);
  const pendingMedicationCount = medicationRows.reduce((acc, row) => {
    if (row.scheduleItem) return acc + (row.scheduleItem.status === "PENDING" ? 1 : 0);
    return acc + (manualConfirmedMap[row.manualKey] ? 0 : 1);
  }, 0);

  const progress = medicationRows.length > 0
    ? Math.round((completedMedicationCount / medicationRows.length) * 100)
    : 0;

  useEffect(() => {
    onProgressChange?.(progress, medicationRows.length);
  }, [onProgressChange, progress, medicationRows.length]);

  return (
    <div className="card-warm p-5">
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-green-50 px-2.5 py-1 font-semibold text-green-700">
            완료 {completedMedicationCount}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-600">
            미응답 {pendingMedicationCount}
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
            건너뜀 {skippedMedicationCount}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-400 py-6">불러오는 중...</p>
      ) : medicationRows.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-6">OCR로 추출된 복약 정보가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {medicationRows.map(({ key, intakeLabel, scheduleItem, manualKey, drugName, doseLabel, dosagePerOnce }) => {
            const isManualConfirmed = !!manualConfirmedMap[manualKey];
            const displayIntakeLabel = scheduleItem ? formatTime(scheduleItem.scheduled_at) : intakeLabel;
            const isDone = scheduleItem ? scheduleItem.status === "DONE" : isManualConfirmed;
            const isSkipped = scheduleItem?.status === "SKIPPED";

            return (
              <article
                key={key}
                className="rounded-[22px] border border-gray-200/80 bg-white px-3.5 py-3 shadow-[0_8px_20px_rgba(42,38,34,0.04)] md:px-4 md:py-3.5"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
                  <div className="flex min-w-0 gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-green-100 bg-green-50 text-green-600">
                      <Pill className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold leading-5 text-gray-800">{drugName}</p>
                      <div className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-gray-500">
                        <Clock3 className="h-4 w-4 text-gray-400" />
                        <span>{displayIntakeLabel}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="inline-flex rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                          용량 {doseLabel}
                        </span>
                        <span className="inline-flex rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                          1회 투약량 {dosagePerOnce}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-[72px] shrink-0 flex-col items-end justify-between gap-2">
                    {scheduleItem && !isDone ? (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateScheduleStatus(
                            scheduleItem.item_id,
                            scheduleItem.status === "SKIPPED" ? "PENDING" : "SKIPPED",
                          )
                        }
                        aria-pressed={isSkipped}
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          isSkipped
                            ? "border-amber-200 bg-amber-100 text-amber-700"
                            : "border-amber-200 bg-white text-amber-600 hover:bg-amber-50"
                        }`}
                      >
                        건너뜀
                      </button>
                    ) : (
                      <span className="inline-flex h-[28px]" aria-hidden="true" />
                    )}

                    <div className="flex items-center justify-end">
                      {scheduleItem ? (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateScheduleStatus(
                              scheduleItem.item_id,
                              scheduleItem.status === "DONE" ? "PENDING" : "DONE",
                            )
                          }
                          className="inline-flex items-center justify-center rounded-md p-0.5 transition-all duration-150"
                          aria-label={scheduleItem.status === "DONE" ? "복약 완료" : "복약 예정"}
                        >
                          <CheckBox checked={isDone} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleManualConfirm(manualKey)}
                          className="inline-flex items-center justify-center rounded-md p-0.5 transition-all duration-150"
                          aria-label={isManualConfirmed ? "복약 완료" : "복약 예정"}
                        >
                          <CheckBox checked={isManualConfirmed} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 items-center justify-center rounded-[4px] border transition-all duration-150 ${
        checked
          ? "border-green-600 bg-green-500 text-white shadow-sm"
          : "border-gray-500 bg-white text-transparent"
      }`}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3.2} />
    </span>
  );
}
