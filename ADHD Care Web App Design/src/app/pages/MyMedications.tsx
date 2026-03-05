import { useState, useEffect } from "react";
import { Clock, AlertCircle, ChevronRight, Plus, Pill, Loader2, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router";
import { reminderApi, Reminder, DdayReminder } from "../../lib/api";
import MedicalSafetyNotice from "../components/MedicalSafetyNotice";

interface MedicationItem {
  id: string;
  name: string;
  dose: string | null;
  scheduleTimes: string[];
  startDate: string | null;
  endDate: string | null;
  enabled: boolean;
  remainingDays: number | null;
  depletionDate: string | null;
}

function buildMedications(reminders: Reminder[], ddays: DdayReminder[]): MedicationItem[] {
  const ddayMap = new Map(ddays.map((d) => [d.medication_name, d]));
  return reminders.map((r) => {
    const dday = ddayMap.get(r.medication_name);
    return {
      id: r.id,
      name: r.medication_name,
      dose: r.dose,
      scheduleTimes: r.schedule_times,
      startDate: r.start_date,
      endDate: r.end_date,
      enabled: r.enabled,
      remainingDays: dday?.remaining_days ?? null,
      depletionDate: dday?.estimated_depletion_date ?? null,
    };
  });
}

interface AddForm {
  medication_name: string;
  dose: string;
  schedule_times: string;
}

export default function MyMedications() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ medication_name: "", dose: "", schedule_times: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([reminderApi.list(), reminderApi.getDday(30)])
      .then(([remRes, ddayRes]) => {
        setMedications(buildMedications(remRes.items, ddayRes.items));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "약 정보를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async () => {
    if (!addForm.medication_name.trim()) { setAddError("약품명을 입력해주세요."); return; }
    if (!addForm.schedule_times.trim()) { setAddError("복용 시간을 입력해주세요."); return; }
    setAddLoading(true);
    setAddError("");
    try {
      const times = addForm.schedule_times.split(",").map((t) => t.trim()).filter(Boolean);
      await reminderApi.create({
        medication_name: addForm.medication_name.trim(),
        dose: addForm.dose.trim() || undefined,
        schedule_times: times,
      });
      setShowAddModal(false);
      setAddForm({ medication_name: "", dose: "", schedule_times: "" });
      loadData();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "추가에 실패했습니다.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await reminderApi.delete(id);
      if (selectedId === id) setSelectedId(null);
      loadData();
    } catch {
    } finally {
      setDeletingId(null);
    }
  };

  const selectedMed = medications.find((m) => m.id === selectedId);
  const isLowStock = (med: MedicationItem) =>
    med.remainingDays != null && med.remainingDays <= 7;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#6B8E23] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1 text-[#2D3436]">내 약 정보</h1>
        <p className="text-[#6c6f72]">현재 복용 중인 약물을 관리하고 기록하세요</p>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-400 p-4 rounded-2xl mb-5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* D-Day Warning */}
      {medications.some(isLowStock) && (
        <div className="bg-red-50 border-2 border-red-400 p-5 rounded-2xl mb-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-red-700 mb-1">약 소진 D-Day 경고</p>
              {medications.filter(isLowStock).map((med) => (
                <p key={med.id} className="text-sm text-red-600">
                  <span className="font-bold">
                    {med.name}
                    {med.dose ? ` ${med.dose}` : ""}
                  </span>
                  이(가) <span className="font-bold">D-{med.remainingDays}</span>일 후 소진됩니다.
                  처방전을 미리 준비하세요.
                </p>
              ))}
            </div>
            <button
              onClick={() => navigate("/ocr-scan")}
              className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors shrink-0"
            >
              처방전 업로드
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Medications List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#2D3436]">현재 복용 약물</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-[#6B8E23] text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-[#556b1c] transition-colors"
            >
              <Plus className="w-4 h-4" />
              약 추가
            </button>
          </div>

          {medications.length === 0 && !error && (
            <div className="bg-white border-2 border-dashed border-[#6B8E23] p-12 rounded-2xl text-center">
              <Pill className="w-12 h-12 text-[#6B8E23] opacity-40 mx-auto mb-3" />
              <p className="text-[#6c6f72]">등록된 약물이 없습니다.</p>
              <button
                onClick={() => navigate("/ocr-scan")}
                className="mt-4 text-[#6B8E23] text-sm font-medium hover:underline"
              >
                처방전 스캔으로 약물 추가하기
              </button>
            </div>
          )}

          {medications.map((med) => {
            const lowStock = isLowStock(med);
            const isSelected = selectedId === med.id;
            return (
              <button
                key={med.id}
                onClick={() => setSelectedId(isSelected ? null : med.id)}
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? "bg-[#6B8E23] text-white border-[#6B8E23]"
                    : lowStock
                    ? "bg-red-50 border-red-300 hover:border-red-400"
                    : "bg-white border-gray-100 hover:border-[#6B8E23]"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-white/20" : lowStock ? "bg-red-100" : "bg-[#f5f3eb]"
                      }`}
                    >
                      <Pill
                        className={`w-5 h-5 ${
                          isSelected ? "text-white" : lowStock ? "text-red-500" : "text-[#6B8E23]"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">{med.name}</h3>
                      <p
                        className={
                          isSelected
                            ? "text-[#FFFCF5] opacity-80 text-sm"
                            : lowStock
                            ? "text-red-500 text-sm"
                            : "text-[#6c6f72] text-sm"
                        }
                      >
                        {med.dose ?? "용량 미상"}
                        {med.scheduleTimes.length > 0 && ` · ${med.scheduleTimes[0]}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {lowStock && !isSelected && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                        D-{med.remainingDays}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(med.id); }}
                      disabled={deletingId === med.id}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                        isSelected
                          ? "bg-white/20 hover:bg-white/30 text-white"
                          : "bg-[#f5f3eb] hover:bg-red-100 text-[#6c6f72] hover:text-red-500"
                      }`}
                    >
                      {deletingId === med.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                    <ChevronRight
                      className={`w-5 h-5 transition-transform ${
                        isSelected ? "text-white rotate-90" : lowStock ? "text-red-400" : "text-[#6c6f72]"
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  {[
                    {
                      value: med.remainingDays != null ? `D-${med.remainingDays}` : "-",
                      label: "소진까지",
                    },
                    {
                      value:
                        med.scheduleTimes.length > 0
                          ? `하루 ${med.scheduleTimes.length}회`
                          : "-",
                      label: "복용 횟수",
                    },
                  ].map(({ value, label }) => (
                    <div key={label}>
                      <div
                        className={`text-xl font-bold ${
                          label === "소진까지" && lowStock && !isSelected ? "text-red-500" : ""
                        }`}
                      >
                        {value}
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${
                          isSelected ? "text-[#FFFCF5] opacity-70" : "text-[#6c6f72]"
                        }`}
                      >
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail Panel */}
        <div className="space-y-4">
          {selectedMed ? (
            <>
              <div className="bg-white border-2 border-[#6B8E23] p-5 rounded-2xl">
                <h2 className="text-xl font-bold mb-4 text-[#2D3436]">
                  {selectedMed.name} 상세 정보
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      icon: <Clock className="w-5 h-5 text-[#6B8E23]" />,
                      label: "복용 시간",
                      value:
                        selectedMed.scheduleTimes.length > 0
                          ? selectedMed.scheduleTimes.join(", ")
                          : "미설정",
                    },
                    {
                      icon: <Pill className="w-5 h-5 text-[#6B8E23]" />,
                      label: "용량",
                      value: selectedMed.dose ?? "미상",
                    },
                    ...(selectedMed.startDate
                      ? [
                          {
                            icon: <Clock className="w-5 h-5 text-[#6B8E23]" />,
                            label: "복용 시작일",
                            value: selectedMed.startDate,
                          },
                        ]
                      : []),
                    ...(selectedMed.depletionDate
                      ? [
                          {
                            icon: <AlertCircle className="w-5 h-5 text-[#6B8E23]" />,
                            label: "예상 소진일",
                            value: selectedMed.depletionDate,
                          },
                        ]
                      : []),
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3 p-3 bg-[#f5f3eb] rounded-xl">
                      {icon}
                      <div>
                        <p className="text-xs text-[#6c6f72] mb-0.5">{label}</p>
                        <p className="text-sm font-medium text-[#2D3436]">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* D-Day Warning for selected med */}
              {isLowStock(selectedMed) && (
                <div className="bg-red-50 border-2 border-red-400 p-5 rounded-2xl">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                    <h3 className="font-bold text-red-700">
                      소진 임박 — D-{selectedMed.remainingDays}
                    </h3>
                  </div>
                  <p className="text-sm text-red-600 mb-4">
                    <span className="font-bold">{selectedMed.remainingDays}일분</span>이 남았습니다.
                    지금 바로 처방전을 준비하거나 병원 예약을 잡으세요.
                  </p>
                  <button
                    onClick={() => navigate("/ocr-scan")}
                    className="w-full bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    처방전 업로드
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border-2 border-dashed border-[#6B8E23] p-12 rounded-2xl text-center h-full flex flex-col items-center justify-center">
              <Pill className="w-12 h-12 text-[#6B8E23] opacity-40 mx-auto mb-3" />
              <p className="text-[#6c6f72]">약물을 선택하여 상세 정보를 확인하세요</p>
            </div>
          )}
        </div>
      </div>
      <MedicalSafetyNotice />

      {/* 약 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#2D3436]">약 추가</h3>
              <button onClick={() => { setShowAddModal(false); setAddError(""); }}
                className="w-8 h-8 rounded-lg bg-[#f5f3eb] flex items-center justify-center text-[#6c6f72] hover:bg-gray-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#2D3436] mb-1.5">약품명 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={addForm.medication_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, medication_name: e.target.value }))}
                  placeholder="예: 콘서타 18mg"
                  className="w-full border-2 border-[#8A9A5B] rounded-xl px-4 py-2.5 text-sm text-[#2D3436] focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2D3436] mb-1.5">용량</label>
                <input
                  type="text"
                  value={addForm.dose}
                  onChange={(e) => setAddForm((f) => ({ ...f, dose: e.target.value }))}
                  placeholder="예: 18mg"
                  className="w-full border-2 border-[#8A9A5B] rounded-xl px-4 py-2.5 text-sm text-[#2D3436] focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2D3436] mb-1.5">복용 시간 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={addForm.schedule_times}
                  onChange={(e) => setAddForm((f) => ({ ...f, schedule_times: e.target.value }))}
                  placeholder="예: 08:00, 12:00 (쉼표로 구분)"
                  className="w-full border-2 border-[#8A9A5B] rounded-xl px-4 py-2.5 text-sm text-[#2D3436] focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                />
              </div>
              {addError && <p className="text-sm text-red-500">{addError}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowAddModal(false); setAddError(""); }}
                  className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-[#6c6f72] text-sm font-medium hover:bg-gray-50 transition-colors">
                  취소
                </button>
                <button onClick={handleAdd} disabled={addLoading}
                  className="flex-1 py-3 rounded-xl bg-[#6B8E23] text-white text-sm font-medium hover:bg-[#556b1c] transition-colors disabled:opacity-60">
                  {addLoading ? "추가 중..." : "추가"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
