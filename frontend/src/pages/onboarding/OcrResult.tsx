import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Loader2, AlertTriangle, Search } from "lucide-react";
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
  } catch {
    return [];
  }
}

function isLowConfidence(val: number | null | undefined) {
  return val !== null && val !== undefined && val < 0.85;
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

  async function handleDrugNameChange(v: string) {
    onChange(index, "drug_name", v);
    if (v.length >= 1) {
      const results = await searchMedications(v);
      setSuggestions(results);
      setShowSug(results.length > 0);
    } else {
      setShowSug(false);
    }
  }

  const nameLow = isLowConfidence(med.confidence);
  const inputCls = (low: boolean, disabled: boolean) =>
    `border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500 ${
      disabled ? "bg-gray-50 text-gray-500 cursor-default" : low ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white"
    }`;

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">약물 {index + 1}</span>
        {med.confidence !== null && med.confidence !== undefined && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isLowConfidence(med.confidence) ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
          }`}>
            신뢰도 {Math.round(med.confidence * 100)}%
          </span>
        )}
      </div>

      {/* 약품명 */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          약품명 {nameLow && <span className="text-amber-600">⚠ 확인 필요</span>}
        </label>
        <div className="relative">
          {editable && <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />}
          <input
            type="text"
            value={med.drug_name}
            onChange={(e) => editable && handleDrugNameChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            readOnly={!editable}
            className={`${inputCls(nameLow, !editable)} ${editable ? "pl-8" : ""}`}
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

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">용량 (mg)</label>
          <input type="number" value={med.dose ?? ""} readOnly={!editable}
            onChange={(e) => onChange(index, "dose", e.target.value ? Number(e.target.value) : null)}
            className={inputCls(false, !editable)} placeholder="mg" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">1회 복용량</label>
          <input type="number" value={med.dosage_per_once ?? ""} readOnly={!editable}
            onChange={(e) => onChange(index, "dosage_per_once", e.target.value ? Number(e.target.value) : null)}
            className={inputCls(false, !editable)} placeholder="정" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">1일 횟수</label>
          <input type="number" value={med.frequency_per_day ?? ""} readOnly={!editable}
            onChange={(e) => onChange(index, "frequency_per_day", e.target.value ? Number(e.target.value) : null)}
            className={inputCls(false, !editable)} placeholder="회" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">처방일수</label>
          <input type="number" value={med.total_days ?? ""} readOnly={!editable}
            onChange={(e) => onChange(index, "total_days", e.target.value ? Number(e.target.value) : null)}
            className={inputCls(false, !editable)} placeholder="일" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">조제일</label>
          <input type="date" value={med.dispensed_date ?? ""} readOnly={!editable}
            onChange={(e) => onChange(index, "dispensed_date", e.target.value || null)}
            className={inputCls(false, !editable)} />
        </div>
      </div>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

type Phase = "preview" | "analyzing" | "result" | "confirming";

export default function OcrResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { file, preview: statePreview } = (location.state ?? {}) as { file?: File; preview?: string };

  const [phase, setPhase] = useState<Phase>("preview");
  const [preview] = useState<string | null>(statePreview ?? null);
  const [medications, setMedications] = useState<OcrMedication[]>([]);
  const [jobId, setJobId] = useState("");
  const [editable, setEditable] = useState(false);
  const [hasLowConfidence, setHasLowConfidence] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);

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
          setHasLowConfidence(meds.some((m) => isLowConfidence(m.confidence)));
          setPhase("result");
        })
        .catch((err) => toast.error(toUserMessage(err)))
        .finally(() => setLoadingResult(false));
    }
  }, []); // eslint-disable-line

  async function handleAnalyze() {
    if (!file) return;
    setPhase("analyzing");
    try {
      const { id: documentId } = await ocrApi.uploadDocument(file);
      const { job_id } = await ocrApi.createJob(documentId);
      setJobId(job_id);

      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = await ocrApi.getJobStatus(job_id);
        if (status.status === "SUCCEEDED") {
          localStorage.setItem("ocr_job_id", job_id);
          const res = await ocrApi.getJobResult(job_id);
          const meds = res.structured_data?.extracted_medications ?? res.structured_data?.medications ?? [];
          setMedications(meds);
          setHasLowConfidence(meds.some((m) => isLowConfidence(m.confidence)));
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
    setMedications((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }

  async function handleConfirm() {
    setPhase("confirming");
    try {
      await ocrApi.confirmResult(jobId, true, medications);
      const guide = await guideApi.createJob(jobId);
      localStorage.setItem("guide_job_id", guide.job_id);
      navigate("/ai-guide");
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
      setPhase("result");
    }
  }

  const analyzeBtnLabel =
    phase === "analyzing" ? "분석중" : phase === "result" || phase === "confirming" ? "분석 완료" : "분석 시작";

  if (loadingResult) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-green-700">처방전 분석</h1>
          <p className="text-sm text-gray-400 mt-1">업로드한 처방전을 분석하고 약 정보를 확인하세요.</p>
        </div>

        {/* 이미지 미리보기 */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <p className="text-xs font-semibold text-gray-500 px-4 pt-4 mb-2">처방전 스캔</p>
          {preview ? (
            <img src={preview} alt="처방전" className="w-full object-contain" />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
              이미지 없음
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 p-4">
            <button
              onClick={() => navigate("/onboarding/scan")}
              disabled={phase === "analyzing" || phase === "confirming"}
              className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-500 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              다시 업로드
            </button>
            <button
              onClick={phase === "preview" ? handleAnalyze : undefined}
              disabled={phase === "analyzing" || phase === "result" || phase === "confirming"}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
                phase === "result" || phase === "confirming"
                  ? "bg-green-700 text-white cursor-default"
                  : phase === "analyzing"
                  ? "bg-green-600 text-white opacity-80 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {phase === "analyzing" && <Loader2 className="w-4 h-4 animate-spin" />}
              {analyzeBtnLabel}
            </button>
          </div>
        </div>

        {/* 스캔된 약 정보 */}
        {(phase === "result" || phase === "confirming") && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700">스캔된 약 정보</p>
              {hasLowConfidence && (
                <div className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-xs">신뢰도 낮은 항목 있음</span>
                </div>
              )}
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

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditable((v) => !v)}
                disabled={phase === "confirming"}
                className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-500 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                {editable ? "수정 완료" : "약 정보 수정하기"}
              </button>
              <button
                onClick={handleConfirm}
                disabled={phase === "confirming" || medications.length === 0}
                className="flex-1 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {phase === "confirming" && <Loader2 className="w-4 h-4 animate-spin" />}
                확인 및 저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
