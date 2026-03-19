import { useEffect, useState } from "react";
import { Clock3, Pill } from "lucide-react";
import { type OcrMedication, type ScheduleItem } from "@/lib/api";

const INTAKE_TIME_LABEL: Record<string, string> = {
  morning: "아침",
  lunch: "점심",
  dinner: "저녁",
  bedtime: "취침 전",
  PRN: "필요 시",
};

const DAILY_CONFIRM_STORAGE_PREFIX = "daily_med_confirmed";

const STATUS_META = {
  PENDING: {
    label: "예정",
    badgeClass: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    buttonClass: "bg-amber-100 text-amber-800 border-amber-200 shadow-sm",
  },
  DONE: {
    label: "완료",
    badgeClass: "bg-green-50 text-green-700 ring-1 ring-green-200",
    buttonClass: "bg-green-100 text-green-800 border-green-200 shadow-sm",
  },
  SKIPPED: {
    label: "미복용",
    badgeClass: "bg-red-50 text-red-700 ring-1 ring-red-200",
    buttonClass: "bg-red-100 text-red-800 border-red-200 shadow-sm",
  },
} as const;

type ScheduleStatus = keyof typeof STATUS_META;

type Props = {
  title?: string;
  loading: boolean;
  medications: OcrMedication[];
  scheduleItems: ScheduleItem[];
  storageDateKey: string;
  onUpdateScheduleStatus: (itemId: string, status: ScheduleStatus) => void;
  onProgressChange?: (progress: number, totalCount: number) => void;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function MedicationScheduleCard({
  title = "복약 일정",
  loading,
  medications,
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

  const completedMedicationCount = medications.reduce((acc, med) => {
    const scheduleItem = medicationItems.find(
      (item) => {
        const medicationName = item.medication_name ?? item.title;
        if (medicationName.toLowerCase() !== med.drug_name.toLowerCase()) return false;
        if (!med.intake_time) return true;
        return formatTime(item.scheduled_at) === med.intake_time;
      },
    );
    if (scheduleItem) return acc + (scheduleItem.status === "DONE" ? 1 : 0);
    const manualKey = `${med.drug_name}-${med.intake_time ?? ""}`;
    return acc + (manualConfirmedMap[manualKey] ? 1 : 0);
  }, 0);

  const progress = medications.length > 0
    ? Math.round((completedMedicationCount / medications.length) * 100)
    : 0;

  useEffect(() => {
    onProgressChange?.(progress, medications.length);
  }, [onProgressChange, progress, medications.length]);

  return (
    <div className="card-warm p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-green-700">복약율 {progress}%</span>
          <div className="h-2.5 w-28 overflow-hidden rounded-full bg-green-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 via-green-600 to-green-700 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">불러오는 중...</p>
      ) : medications.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">해당 날짜에 유효한 복약 정보가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {medications.map((med, idx) => {
            const scheduleItem = medicationItems.find(
              (item) => {
                const medicationName = item.medication_name ?? item.title;
                if (medicationName.toLowerCase() !== med.drug_name.toLowerCase()) return false;
                if (!med.intake_time) return true;
                return formatTime(item.scheduled_at) === med.intake_time;
              },
            );
            const manualKey = `${med.drug_name}-${med.intake_time ?? ""}`;
            const isManualConfirmed = !!manualConfirmedMap[manualKey];
            const currentStatus: ScheduleStatus = scheduleItem
              ? scheduleItem.status
              : isManualConfirmed ? "DONE" : "PENDING";
            const intakeLabel = med.intake_time
              ? (INTAKE_TIME_LABEL[med.intake_time] ?? med.intake_time)
              : (scheduleItem ? formatTime(scheduleItem.scheduled_at) : "-");
            const doseLabel = med.dose !== null && med.dose !== undefined ? `${med.dose}mg` : "-";
            const dosagePerOnce = med.dosage_per_once !== null && med.dosage_per_once !== undefined
              ? `${med.dosage_per_once}정`
              : "-";

            return (
              <div
                key={`${med.drug_name}-${idx}`}
                className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                        <Pill className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-gray-800">{med.drug_name || "-"}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
                          <Clock3 className="h-3.5 w-3.5 shrink-0" />
                          <span className="whitespace-nowrap">{intakeLabel}</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <InfoChip label="용량" value={doseLabel} />
                      <InfoChip label="1회 투약량" value={dosagePerOnce} />
                    </div>
                  </div>

                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_META[currentStatus].badgeClass}`}>
                    {STATUS_META[currentStatus].label}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {scheduleItem ? (
                    (Object.keys(STATUS_META) as ScheduleStatus[]).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => onUpdateScheduleStatus(scheduleItem.item_id, status)}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-150 ${
                          currentStatus === status
                            ? STATUS_META[status].buttonClass
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {STATUS_META[status].label}
                      </button>
                    ))
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (isManualConfirmed) toggleManualConfirm(manualKey);
                        }}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-150 ${
                          !isManualConfirmed
                            ? STATUS_META.PENDING.buttonClass
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        예정
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isManualConfirmed) toggleManualConfirm(manualKey);
                        }}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-150 ${
                          isManualConfirmed
                            ? STATUS_META.DONE.buttonClass
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        완료
                      </button>
                    </>
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

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
      <span className="whitespace-nowrap text-gray-400">{label}</span>
      <span className="whitespace-nowrap font-semibold text-gray-700">{value}</span>
    </span>
  );
}
