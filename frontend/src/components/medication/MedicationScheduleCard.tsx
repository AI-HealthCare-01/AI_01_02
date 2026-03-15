import { useEffect, useState } from "react";
import { OcrMedication, ScheduleItem } from "@/lib/api";

const INTAKE_TIME_LABEL: Record<string, string> = {
  morning: "아침",
  lunch: "점심",
  dinner: "저녁",
  bedtime: "취침 전",
  PRN: "필요 시",
};

const DAILY_CONFIRM_STORAGE_PREFIX = "daily_med_confirmed";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
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

  const completedMedicationCount = ocrMeds.reduce((acc, med) => {
    const scheduleItem = medicationItems.find(
      (si) => si.title.toLowerCase().includes(med.drug_name.toLowerCase()),
    );
    if (scheduleItem) return acc + (scheduleItem.status === "DONE" ? 1 : 0);
    const manualKey = `${med.drug_name}-${med.intake_time ?? ""}`;
    return acc + (manualConfirmedMap[manualKey] ? 1 : 0);
  }, 0);

  const progress = ocrMeds.length > 0
    ? Math.round((completedMedicationCount / ocrMeds.length) * 100)
    : 0;

  useEffect(() => {
    onProgressChange?.(progress, ocrMeds.length);
  }, [onProgressChange, progress, ocrMeds.length]);

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
      ) : ocrMeds.length === 0 ? (
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
          {ocrMeds.map((med, idx) => {
            const scheduleItem = medicationItems.find(
              (si) => si.title.toLowerCase().includes(med.drug_name.toLowerCase()),
            );
            const manualKey = `${med.drug_name}-${med.intake_time ?? ""}`;
            const isManualConfirmed = !!manualConfirmedMap[manualKey];
            const intakeLabel = med.intake_time
              ? (INTAKE_TIME_LABEL[med.intake_time] ?? med.intake_time)
              : (scheduleItem ? formatTime(scheduleItem.scheduled_at) : "-");
            const doseLabel = med.dose !== null && med.dose !== undefined ? `${med.dose}mg` : "-";
            const dosagePerOnce = med.dosage_per_once !== null && med.dosage_per_once !== undefined
              ? `${med.dosage_per_once}`
              : "-";

            return (
              <div key={`${med.drug_name}-${idx}`} className="grid grid-cols-[92px_1fr_90px_110px_128px] gap-2 items-center px-3 py-3 rounded-xl bg-white/80 shadow-sm">
                <span className="text-sm text-gray-600">{intakeLabel}</span>
                <span className="text-sm font-semibold text-gray-800 truncate">{med.drug_name || "-"}</span>
                <span className="text-sm text-gray-700">{doseLabel}</span>
                <span className="text-sm text-gray-700">{dosagePerOnce}</span>
                <div className="flex items-center justify-end gap-1.5">
                  {scheduleItem ? (
                    <button
                      onClick={() =>
                        onUpdateScheduleStatus(
                          scheduleItem.item_id,
                          scheduleItem.status === "DONE" ? "PENDING" : "DONE",
                        )
                      }
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
                        scheduleItem.status === "DONE"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {scheduleItem.status === "DONE" ? "완료" : "예정"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleManualConfirm(manualKey)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
                        isManualConfirmed
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {isManualConfirmed ? "완료" : "예정"}
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
