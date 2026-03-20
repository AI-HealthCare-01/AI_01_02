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

type MedicationStatus = "PENDING" | "DONE" | "SKIPPED";

type MedicationRow = {
  key: string;
  intakeLabel: string;
  scheduleItem: ScheduleItem | null;
  manualKey: string;
  drugName: string;
  doseLabel: string;
  dosagePerOnce: string;
};

const STATUS_META: Record<
  MedicationStatus,
  {
    label: string;
    badgeClassName: string;
    actionClassName: string;
  }
> = {
  DONE: {
    label: "완료",
    badgeClassName: "border-green-200 bg-green-50 text-green-700",
    actionClassName: "border-green-200 bg-green-50 text-green-700",
  },
  PENDING: {
    label: "미응답",
    badgeClassName: "border-gray-200 bg-white text-gray-500",
    actionClassName: "border-gray-200 bg-white text-gray-500",
  },
  SKIPPED: {
    label: "건너뜀",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    actionClassName: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
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

function formatDosagePerOnce(value: string): string {
  if (!value || value === "-") return "-";
  return /\d$/.test(value) ? `${value}정` : value;
}

function getRowStatus(scheduleItem: ScheduleItem | null, manualChecked: boolean): MedicationStatus {
  if (scheduleItem) return scheduleItem.status;
  return manualChecked ? "DONE" : "PENDING";
}

type Props = {
  title?: string;
  loading: boolean;
  ocrMeds: OcrMedication[];
  reminders?: Reminder[];
  scheduleItems: ScheduleItem[];
  storageDateKey: string;
  onUpdateScheduleStatus: (itemId: string, status: MedicationStatus) => void;
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
    .filter((item) => item.category === "MEDICATION")
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

  const medicationRows: MedicationRow[] = (() => {
    let scheduleCursor = 0;

    if (filteredOcrMeds.length === 0) {
      return filteredReminders.flatMap((reminder, reminderIndex) => {
        const rowCount = Math.max(1, reminder.schedule_times.length);

        return Array.from({ length: rowCount }, (_, rowIndex) => {
          const scheduleItem = medicationItems[scheduleCursor] ?? null;
          if (scheduleItem) {
            scheduleCursor += 1;
          }

          const reminderDose = reminder.dose?.trim() ?? "";
          const doseLabel = reminderDose && !reminderDose.includes("캡/정") ? reminderDose : "-";
          const dosagePerOnce = reminderDose && reminderDose.includes("캡/정") ? reminderDose : "-";

          return {
            key: `${reminder.medication_name}-${reminderIndex}-${rowIndex}`,
            intakeLabel: reminder.schedule_times[rowIndex] ?? "-",
            scheduleItem,
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

      return Array.from({ length: rowCount }, (_, rowIndex) => {
        const scheduleItem = medicationItems[scheduleCursor] ?? null;
        if (scheduleItem) {
          scheduleCursor += 1;
        }

        return {
          key: `${med.drug_name}-${medIndex}-${rowIndex}`,
          intakeLabel: intakeLabels[rowIndex] ?? intakeLabels[intakeLabels.length - 1] ?? "-",
          scheduleItem,
          manualKey: `${med.drug_name}-${storageDateKey}-${rowIndex}`,
          drugName: med.drug_name || "-",
          doseLabel: med.dose !== null && med.dose !== undefined ? `${med.dose}mg` : "-",
          dosagePerOnce:
            med.dosage_per_once !== null && med.dosage_per_once !== undefined ? `${med.dosage_per_once}` : "-",
        };
      });
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
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-800">{title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 font-semibold text-green-700">
              완료 {completedMedicationCount}
            </span>
            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-600">
              미응답 {pendingMedicationCount}
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
              건너뜀 {skippedMedicationCount}
            </span>
          </div>
        </div>

        <div className="min-w-[180px]">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>복약률</span>
            <span className="text-sm font-bold text-green-600">{progress}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full gradient-primary transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">불러오는 중...</p>
      ) : medicationRows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">OCR로 추출된 복약 정보가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {medicationRows.map(({ key, intakeLabel, scheduleItem, manualKey, drugName, doseLabel, dosagePerOnce }) => {
            const isManualConfirmed = !!manualConfirmedMap[manualKey];
            const displayIntakeLabel = scheduleItem ? formatTime(scheduleItem.scheduled_at) : intakeLabel;
            const status = getRowStatus(scheduleItem, isManualConfirmed);
            const statusMeta = STATUS_META[status];

            return (
              <div key={key} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-50">
                    <Pill className="h-5 w-5 text-green-600" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-800">{drugName}</p>
                        <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>{displayIntakeLabel}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                            용량 {doseLabel}
                          </span>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            1회 {formatDosagePerOnce(dosagePerOnce)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-3 md:items-end">
                        {scheduleItem ? (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateScheduleStatus(
                                scheduleItem.item_id,
                                scheduleItem.status === "SKIPPED" ? "PENDING" : "SKIPPED",
                              )
                            }
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                              scheduleItem.status === "SKIPPED"
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border-gray-200 bg-white text-gray-500 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                            }`}
                          >
                            {scheduleItem.status === "SKIPPED" ? "건너뜀 해제" : "건너뜀"}
                          </button>
                        ) : (
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusMeta.badgeClassName}`}>
                            {statusMeta.label}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (scheduleItem) {
                              onUpdateScheduleStatus(
                                scheduleItem.item_id,
                                scheduleItem.status === "DONE" ? "PENDING" : "DONE",
                              );
                              return;
                            }
                            toggleManualConfirm(manualKey);
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-green-300 hover:text-green-700"
                          aria-label={status === "DONE" ? "복약 완료" : "복약 예정"}
                        >
                          <CheckBox checked={status === "DONE"} />
                          <span>{status === "DONE" ? "체크됨" : "체크하기"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
      className={`flex h-5 w-5 items-center justify-center rounded-[6px] border transition-all duration-150 ${
        checked
          ? "border-green-600 bg-green-500 text-white shadow-sm"
          : "border-gray-400 bg-white text-transparent"
      }`}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3.2} />
    </span>
  );
}
