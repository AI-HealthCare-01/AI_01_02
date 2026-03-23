import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router";
import { Loader2, Search, Bell, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { ocrApi, guideApi, OcrMedication, request } from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";

async function searchMedications(q: string): Promise<string[]> {
  if (!q.trim()) return [];
  try {
    const data = await request<{ items: { name: string }[] }>(
      `/medications/search?q=${encodeURIComponent(q)}&limit=8`,
    );
    return (data.items ?? []).map((i) => i.name);
  } catch (err) {
    console.warn("Medication search failed:", err);
    return [];
  }
}

// ── MedRow ────────────────────────────────────────────────────────────────────

function MedRow({
  med,
  index,
  editable,
  onChange,
}: {
  med: OcrMedication;
  index: number;
  editable: boolean;
  onChange: (index: number, field: keyof OcrMedication, value: string | number | null) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSug, setShowSug] = useState(false);
  const sugRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchIdRef = useRef(0);

  // cleanup debounce timer on unmount
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function handleDrugNameChange(v: string) {
    onChange(index, "drug_name", v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.length >= 1) {
      debounceRef.current = setTimeout(async () => {
        const id = ++searchIdRef.current;
        const results = await searchMedications(v);
        if (id !== searchIdRef.current) return; // stale
        setSuggestions(results);
        setShowSug(results.length > 0);
      }, 300);
    } else {
      setShowSug(false);
    }
  }

  const isFieldLow = (field: keyof OcrMedication) => {
    const val = med[field];
    return val === null || val === undefined || val === "";
  };

  const inputCls = (field: keyof OcrMedication, disabled: boolean) => {
    const low = isFieldLow(field);
    return `border rounded-xl px-3 py-2 text-sm w-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 ${disabled ? "bg-gray-50 text-gray-500 cursor-default" : low ? "border-red-500 bg-red-50 text-red-900" : "border-gray-200 bg-white"
      }`;
  };

  const renderLabel = (label: string, field: keyof OcrMedication) => {
    const low = isFieldLow(field);
    return (
      <label className="block text-xs text-gray-500 mb-1">
        {label} {low && <span className="text-red-500 font-semibold ml-1">⚠ 직접 입력해주세요</span>}
      </label>
    );
  };

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">약물 {index + 1}</span>
      </div>

      {/* 약품명 */}
      <div>
        {renderLabel("약품명", "drug_name")}
        <div className="relative">
          {editable && <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />}
          <input
            type="text"
            value={med.drug_name}
            onChange={(e) => editable && handleDrugNameChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            readOnly={!editable}
            className={`${inputCls("drug_name", !editable)} ${editable ? "pl-8" : ""}`}
            placeholder="약품명"
          />
          {showSug && editable && (
            <div ref={sugRef} className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
              {suggestions.map((s) => (
                <button key={s} type="button"
                  onMouseDown={() => { onChange(index, "drug_name", s); setShowSug(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 hover:text-green-700"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          {renderLabel("용량(mg)", "dose")}
          <input type="number" value={med.dose ?? ""} readOnly={!editable}
            onChange={(e) => onChange(index, "dose", e.target.value ? Number(e.target.value) : null)}
            className={inputCls("dose", !editable)} placeholder="mg" />
        </div>
        <div>
          {renderLabel("복용시간", "intake_time")}
          {editable ? (
            <select value={med.intake_time ?? ""} onChange={(e) => onChange(index, "intake_time", e.target.value || null)}
              className={inputCls("intake_time", false)}>
              <option value="">선택</option>
              <option value="morning">아침</option>
              <option value="lunch">점심</option>
              <option value="dinner">저녁</option>
              <option value="bedtime">취침전</option>
              <option value="PRN">필요시</option>
            </select>
          ) : (
            <input type="text" readOnly value={
              { morning: "아침", lunch: "점심", dinner: "저녁", bedtime: "취침전", PRN: "필요시" }[med.intake_time ?? ""] ?? med.intake_time ?? ""
            } className={inputCls("intake_time", true)} placeholder="-" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          {renderLabel("1회 투약량(정/캡슐)", "dosage_per_once")}
          <input type="number" value={med.dosage_per_once ?? ""} readOnly={!editable}
            onChange={(e) => onChange(index, "dosage_per_once", e.target.value ? Number(e.target.value) : null)}
            className={inputCls("dosage_per_once", !editable)} placeholder="갯수" />
        </div>
        <div>
          {renderLabel("1일 투여횟수(회)", "frequency_per_day")}
          <input type="number" value={med.frequency_per_day ?? ""} readOnly={!editable}
            onChange={(e) => onChange(index, "frequency_per_day", e.target.value ? Number(e.target.value) : null)}
            className={inputCls("frequency_per_day", !editable)} placeholder="회" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          {renderLabel("처방일수", "total_days")}
          <input type="number" value={med.total_days ?? ""} readOnly={!editable}
            onChange={(e) => onChange(index, "total_days", e.target.value ? Number(e.target.value) : null)}
            className={inputCls("total_days", !editable)} placeholder="일" />
        </div>
        <div>
          {renderLabel("조제일", "dispensed_date")}
          <input type="date" value={med.dispensed_date ?? ""} readOnly={!editable}
            onChange={(e) => onChange(index, "dispensed_date", e.target.value || null)}
            className={inputCls("dispensed_date", !editable)} />
        </div>
      </div>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

type Phase = "preview" | "analyzing" | "result" | "confirming" | "summary";

export default function OcrResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { file, preview: statePreview } = (location.state ?? {}) as { file?: File; preview?: string | null };

  const [phase, setPhase] = useState<Phase>("preview");
  const [preview] = useState<string | null>(statePreview ?? null);
  const [medications, setMedications] = useState<OcrMedication[]>([]);
  const [jobId, setJobId] = useState("");
  const [editable, setEditable] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
  const cancelledRef = useRef(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [analyzeElapsed, setAnalyzeElapsed] = useState(0);

  // 이미 분석된 결과가 있으면 바로 result 단계로
  useEffect(() => {
    const savedJobId = localStorage.getItem("ocr_job_id");
    if (!file && !savedJobId) {
      navigate("/onboarding/scan");
      return;
    }
    if (!file && savedJobId) {
      setJobId(savedJobId);
      setLoadingResult(true);
      ocrApi.getJobResult(savedJobId)
        .then((res) => {
          const meds = res.structured_data?.extracted_medications ?? res.structured_data?.medications ?? [];
          setMedications(meds);
          setPhase("result");
        })
        .catch((err) => toast.error(toUserMessage(err)))
        .finally(() => setLoadingResult(false));
    }
    return () => { cancelledRef.current = true; };
  }, []); // eslint-disable-line

  async function handleAnalyze() {
    if (!file) return;
    setPhase("analyzing");
    setAnalyzeElapsed(0);
    try {
      const { id: documentId } = await ocrApi.uploadDocument(file);
      const { job_id } = await ocrApi.createJob(documentId);
      setJobId(job_id);

      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        setAnalyzeElapsed((i + 1) * 2);
        if (cancelledRef.current) return;
        const status = await ocrApi.getJobStatus(job_id);
        if (status.status === "SUCCEEDED" || status.status === "COMPLETED") {
          localStorage.setItem("ocr_job_id", job_id);
          const res = await ocrApi.getJobResult(job_id);
          const meds = res.structured_data?.extracted_medications ?? res.structured_data?.medications ?? [];
          setMedications(meds);
          setPhase("result");
          return;
        }
        if (status.status === "FAILED") {
          throw new Error(status.error_message ?? "분석에 실패했습니다.");
        }
      }
      throw new Error("분석 시간이 초과되었습니다.");
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
      setPhase("preview");
    }
  }

  function updateField(index: number, field: keyof OcrMedication, value: string | number | null) {
    setMedications((prev) => prev.map((m, i) => {
      if (i !== index) return m;
      return { ...m, [field]: value };
    }));
  }

  async function handleConfirm() {
    setPhase("confirming");
    try {
      await ocrApi.confirmResult(jobId, true, medications);
      const guide = await guideApi.createJob(jobId);
      localStorage.setItem("guide_job_id", guide.job_id);
      setPhase("summary");
      setShowReminderModal(true);
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
      setPhase("result");
    }
  }

  const analyzeBtnLabel =
    phase === "analyzing" ? "분석중" : phase === "result" || phase === "confirming" ? "분석 완료" : "분석 시작";

  if (loadingResult) {
    return (
      <div className="min-h-screen gradient-warm-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-warm-bg p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-green-700">
            {phase === "summary" ? "처방전 분석 완료" : "처방전 분석"}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {phase === "summary"
              ? "복약 정보가 저장되었습니다. AI 가이드를 통해 상세 분석을 확인하세요."
              : "업로드한 처방전을 분석하고 약 정보를 확인하세요."}
          </p>
        </div>

        {/* 이미지 미리보기 */}
        {phase !== "summary" && <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
          <p className="text-xs font-semibold text-gray-500 px-4 pt-4 mb-2">처방전 스캔</p>
          {preview ? (
            <img src={preview} alt="처방전" className="w-full object-contain" />
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400">
              <FileText className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-sm font-medium">{file?.name ?? "PDF 문서"}</p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 p-4">
            <button
              onClick={() => navigate("/onboarding/scan")}
              disabled={phase === "analyzing" || phase === "confirming"}
              className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-500 rounded-lg hover:bg-gray-50 transition-all duration-200 disabled:opacity-40"
            >
              다시 업로드
            </button>
            <button
              onClick={phase === "preview" ? handleAnalyze : undefined}
              disabled={phase === "analyzing" || phase === "result" || phase === "confirming"}
              className={`flex-1 py-2.5 text-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 ${phase === "result" || phase === "confirming"
                ? "gradient-primary text-white cursor-default"
                : phase === "analyzing"
                  ? "gradient-primary text-white opacity-80 cursor-not-allowed"
                  : "gradient-primary text-white hover:shadow-lg"
                }`}
            >
              {phase === "analyzing" && <Loader2 className="w-4 h-4 animate-spin" />}
              {phase === "analyzing" ? `분석중 (${analyzeElapsed}초)` : analyzeBtnLabel}
            </button>
          </div>
        </div>}

        {/* REQ-060: 복약 요약 화면 */}
        {phase === "summary" && (
          <div className="card-warm p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-green-700">복약 요약</p>
              <p className="text-xs text-gray-400 mt-1">확인된 복약 정보입니다. AI 가이드에서 상세 분석을 확인하세요.</p>
            </div>

            <div className="space-y-3">
              {medications.map((med, i) => (
                <div key={i} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{med.drug_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[
                        med.dose ? `${med.dose}mg` : null,
                        med.dosage_per_once ? `1회 ${med.dosage_per_once}정` : null,
                        med.frequency_per_day ? `1일 ${med.frequency_per_day}회` : null,
                        med.total_days ? `${med.total_days}일분` : null,
                      ].filter(Boolean).join(" · ") || "용량 정보 없음"}
                    </p>
                  </div>
                  {med.dispensed_date && (
                    <span className="text-xs text-gray-400 ml-3 shrink-0">
                      조제일 {med.dispensed_date}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => navigate("/")}
                className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-500 rounded-lg hover:bg-gray-50 transition-all duration-200"
              >
                홈으로
              </button>
              <button
                onClick={() => navigate("/ai-guide")}
                className="flex-1 py-2.5 gradient-primary text-white text-sm rounded-xl font-bold transition-all duration-200"
              >
                AI 가이드 보기
              </button>
            </div>
          </div>
        )}

        {/* 스캔된 약 정보 */}
        {(phase === "result" || phase === "confirming") && (
          <div className="card-warm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700">스캔된 약 정보</p>
            </div>

            {medications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">추출된 약물 정보가 없습니다.</p>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {medications.map((med, i) => (
                  <MedRow key={i} med={med} index={i} editable={editable} onChange={updateField} />
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 mt-5">
              <button
                onClick={() => setEditable((v) => !v)}
                disabled={phase === "confirming"}
                className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-500 rounded-lg hover:bg-gray-50 transition-all duration-200 disabled:opacity-40"
              >
                {editable ? "수정 완료" : "약 정보 수정하기"}
              </button>
              <button
                onClick={handleConfirm}
                disabled={phase === "confirming" || medications.length === 0}
                className="flex-1 py-2.5 gradient-primary text-white text-sm rounded-xl font-bold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {phase === "confirming" && <Loader2 className="w-4 h-4 animate-spin" />}
                확인 및 저장
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 복약 알림 설정 제안 모달 */}
      {showReminderModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-green-50 p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-green-600 animate-bounce" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">복약 알림을 설정할까요?</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                처방받은 약을 잊지 않고 제때 복용할 수 있도록<br />
                맞춤형 복약 알림을 설정해 드릴까요?
              </p>
            </div>
            <div className="p-4 flex flex-col gap-2">
              <button
                onClick={() => navigate("/medications", { state: { setupReminders: true } })}
                className="w-full py-3.5 gradient-primary text-white text-sm rounded-xl font-bold hover:shadow-lg transition-all active:scale-95"
              >
                지금 설정하기
              </button>
              <button
                onClick={() => setShowReminderModal(false)}
                className="w-full py-3.5 text-sm text-gray-400 font-medium hover:text-gray-600 transition-colors flex items-center justify-center gap-1"
              >
                <X className="w-4 h-4" /> 나중에 하기
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
