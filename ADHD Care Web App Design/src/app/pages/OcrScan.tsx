import { useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  Loader,
  AlertCircle,
  Check,
  Edit2,
  Bell,
  Brain,
  Image,
  X,
  Info,
  Camera,
} from "lucide-react";
import { useNavigate } from "react-router";
import { ocrApi, guideApi, OcrMedication } from "../../lib/api";
import MedicalSafetyNotice from "../components/MedicalSafetyNotice";

type State = "upload" | "preview" | "processing" | "lowConfidenceError" | "review" | "done";

interface ExtractedField {
  fieldKey: string;
  label: string;
  value: string;
  confidence: number;
  editing: boolean;
}

function medicationToFields(med: OcrMedication): ExtractedField[] {
  const conf = Math.round((med.confidence ?? 0.8) * 100);
  const raw: { fieldKey: string; label: string; value: string }[] = [
    { fieldKey: "drug_name", label: "약품명", value: med.drug_name },
    { fieldKey: "dose", label: "용량", value: med.dose != null ? String(med.dose) : "" },
    {
      fieldKey: "frequency_per_day",
      label: "복용 횟수",
      value: med.frequency_per_day != null ? `하루 ${med.frequency_per_day}회` : "",
    },
    {
      fieldKey: "dosage_per_once",
      label: "1회 복용량",
      value: med.dosage_per_once != null ? `${med.dosage_per_once}정` : "",
    },
    {
      fieldKey: "total_days",
      label: "처방 일수",
      value: med.total_days != null ? `${med.total_days}일` : "",
    },
    { fieldKey: "dispensed_date", label: "조제일", value: med.dispensed_date ?? "" },
  ];
  return raw
    .filter((f) => f.value !== "")
    .map((f) => ({ ...f, confidence: conf, editing: false }));
}

function fieldsToMedication(fields: ExtractedField[]): OcrMedication {
  const find = (key: string) => fields.find((f) => f.fieldKey === key)?.value ?? "";
  return {
    drug_name: find("drug_name"),
    dose: parseFloat(find("dose")) || null,
    frequency_per_day: parseInt(find("frequency_per_day")) || null,
    dosage_per_once: parseInt(find("dosage_per_once")) || null,
    dispensed_date: find("dispensed_date") || null,
    total_days: parseInt(find("total_days")) || null,
    confidence: null,
  };
}

const FALLBACK_FIELDS: ExtractedField[] = [
  { fieldKey: "drug_name", label: "약품명", value: "", confidence: 0, editing: false },
  { fieldKey: "dose", label: "용량", value: "", confidence: 0, editing: false },
];

export default function OcrScan() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [fields, setFields] = useState<ExtractedField[]>(FALLBACK_FIELDS);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processError, setProcessError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    if (selected.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
    setState("preview");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      if (dropped.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(dropped);
      } else {
        setPreview(null);
      }
      setState("preview");
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setState("processing");
    setProgress(0);
    setProgressLabel("이미지 업로드 중...");
    setProcessError("");

    try {
      // Step 1: Upload document
      const uploadResult = await ocrApi.uploadDocument(file);
      setProgress(30);
      setProgressLabel("이미지 전처리 중...");

      // Step 2: Create OCR job
      const jobResult = await ocrApi.createJob(uploadResult.id);
      const newJobId = jobResult.job_id;
      setJobId(newJobId);
      setProgress(50);
      setProgressLabel("텍스트 추출 중");

      // Step 3: Poll for completion
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = await ocrApi.getJobStatus(newJobId);
        attempts++;
        setProgress(50 + Math.min(Math.round((attempts / maxAttempts) * 40), 40));
        setProgressLabel(attempts % 2 === 0 ? "텍스트 추출 중" : "약 정보 식별 및 정제 중...");

        if (status.status === "COMPLETED") break;
        if (status.status === "FAILED") {
          throw new Error(status.error_message ?? "OCR 처리에 실패했습니다.");
        }
      }

      if (attempts >= maxAttempts) throw new Error("처리 시간이 초과되었습니다.");

      // Step 4: Get result
      setProgress(90);
      setProgressLabel("약 정보 식별 및 정제 중...");
      const result = await ocrApi.getJobResult(newJobId);
      setProgress(100);
      setProgressLabel("분석 완료");

      const meds = result.structured_data.medications ?? [];
      const mappedFields = meds.length > 0 ? medicationToFields(meds[0]) : FALLBACK_FIELDS;
      setFields(mappedFields);

      await new Promise((r) => setTimeout(r, 400));

      const avgConf =
        mappedFields.reduce((s, f) => s + f.confidence, 0) / (mappedFields.length || 1);
      if (result.structured_data.needs_user_review || avgConf < 70) {
        setState("lowConfidenceError");
      } else {
        setState("review");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.";
      setProcessError(msg);
      setState("upload");
    }
  };

  const handleEditField = (index: number, newValue: string) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, value: newValue } : f)));
  };

  const toggleEdit = (index: number) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, editing: !f.editing } : f)));
  };

  const handleConfirmReview = async () => {
    setConfirming(true);
    try {
      if (jobId) {
        const corrected = fieldsToMedication(fields);
        await ocrApi.confirmResult(jobId, true, [corrected]);

        // Create guide job and store job_id for AiGuide page
        try {
          const guideJob = await guideApi.createJob(jobId);
          localStorage.setItem("guide_job_id", guideJob.job_id);
        } catch {
          // Guide creation failure doesn't block the flow
        }
      }
      setState("done");
    } catch {
      setState("done");
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setProgress(0);
    setProgressLabel("");
    setFields(FALLBACK_FIELDS);
    setJobId(null);
    setProcessError("");
    setState("upload");
  };

  const lowConfidenceCount = fields.filter((f) => f.confidence < 80).length;

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1 text-[#2D3436]">처방전 스캔</h1>
        <p className="text-[#6c6f72]">처방전이나 약봉투를 업로드하여 약 정보를 자동 등록하세요</p>
      </div>

      {/* Upload State */}
      {state === "upload" && (
        <div className="space-y-5">
          {processError && (
            <div className="bg-red-50 border-2 border-red-400 p-4 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{processError}</p>
            </div>
          )}

          {/* Capture Guidance */}
          <div className="bg-white border-2 border-[#6B8E23] p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-[#6B8E23]" />
              <h3 className="font-bold text-[#2D3436]">촬영 가이드</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-bold text-green-700">좋은 예시</span>
                </div>
                <ul className="text-xs text-green-600 space-y-1">
                  <li>• 처방전 전체가 화면 안에 들어오게</li>
                  <li>• 밝은 조명 아래서 촬영</li>
                  <li>• 흔들림 없이 수평으로 촬영</li>
                  <li>• 텍스트가 선명하게 보이도록</li>
                </ul>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-bold text-red-600">나쁜 예시</span>
                </div>
                <ul className="text-xs text-red-500 space-y-1">
                  <li>• 구겨지거나 접힌 처방전</li>
                  <li>• 어두운 환경에서의 촬영</li>
                  <li>• 사진이 흔들린 경우</li>
                  <li>• 일부분만 촬영된 경우</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Upload Drop Zone */}
          <label className="block" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="bg-white border-2 border-dashed border-[#6B8E23] rounded-2xl p-12 text-center cursor-pointer hover:bg-[#f5f3eb] transition-colors">
              <div className="w-16 h-16 bg-[#6B8E23] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold mb-1 text-[#2D3436]">파일 업로드</h2>
              <p className="text-[#6c6f72] mb-4">파일을 드래그하거나 클릭하여 선택하세요</p>
              <span className="bg-[#6B8E23] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#556b1c] transition-colors inline-block">
                파일 선택
              </span>
              <div className="mt-4 flex items-center justify-center gap-3 text-sm text-[#6c6f72]">
                <Image className="w-4 h-4" />
                <span>JPG · PNG · PDF 지원 · 최대 10MB</span>
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Preview State */}
      {state === "preview" && (
        <div className="space-y-4">
          <div className="bg-white border-2 border-[#6B8E23] rounded-2xl overflow-hidden">
            {preview ? (
              <img src={preview} alt="Preview" className="w-full max-h-80 object-contain bg-[#f5f3eb]" />
            ) : (
              <div className="p-8 text-center bg-[#f5f3eb]">
                <FileText className="w-12 h-12 text-[#6B8E23] mx-auto mb-2" />
                <p className="font-bold text-[#2D3436]">{file?.name}</p>
                <p className="text-sm text-[#6c6f72]">PDF 파일은 미리보기를 지원하지 않습니다</p>
              </div>
            )}
            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#6B8E23]" />
                <span className="text-sm text-[#2D3436] font-medium truncate max-w-xs">{file?.name}</span>
              </div>
              <span className="text-xs text-[#6c6f72]">
                {file ? `${(file.size / 1024).toFixed(0)} KB` : ""}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 border-2 border-[#6B8E23] text-[#6B8E23] py-3.5 rounded-xl font-medium hover:bg-[#f5f3eb] transition-colors"
            >
              다시 선택
            </button>
            <button
              onClick={handleProcess}
              className="flex-1 bg-[#6B8E23] text-white py-3.5 rounded-xl font-medium hover:bg-[#556b1c] transition-colors"
            >
              분석 시작
            </button>
          </div>
        </div>
      )}

      {/* Processing State */}
      {state === "processing" && (
        <div className="bg-[#6B8E23] text-white p-8 rounded-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Loader className="w-6 h-6 animate-spin shrink-0" />
            <div>
              <h3 className="font-bold text-lg">처방전 분석 중...</h3>
              <p className="text-sm text-[#FFFCF5] opacity-80">{progressLabel}</p>
            </div>
          </div>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span>진행률</span>
              <span>{progress}%</span>
            </div>
            <div className="h-3 bg-[#556b1c] rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {[
              { threshold: 30, label: "✓ 이미지 업로드 완료" },
              { threshold: 50, label: "✓ 이미지 전처리 완료" },
              { threshold: 70, label: "✓ 텍스트 추출 중" },
              { threshold: 90, label: "✓ 약 정보 식별 및 정제" },
            ].map(({ threshold, label }) => (
              <div
                key={label}
                className={`transition-colors ${progress >= threshold ? "text-white" : "text-[#FFFCF5] opacity-40"}`}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Confidence Error State */}
      {state === "lowConfidenceError" && (
        <div className="space-y-4">
          <div className="bg-red-50 border-2 border-red-400 p-6 rounded-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-700 mb-1">인식 신뢰도가 낮습니다</h3>
                <p className="text-sm text-red-600 leading-relaxed">
                  처방전 이미지의 품질이 좋지 않거나 글씨가 흐릿하여 정확한 정보 추출이 어렵습니다.
                  아래 버튼 중 하나를 선택해 주세요.
                </p>
              </div>
            </div>
          </div>

          {preview && (
            <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden">
              <img src={preview} alt="Preview" className="w-full max-h-60 object-contain bg-[#f5f3eb]" />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-2 bg-white border-2 border-[#6B8E23] text-[#6B8E23] py-3.5 rounded-xl font-medium hover:bg-[#f5f3eb] transition-colors"
            >
              <Camera className="w-5 h-5" />
              다시 촬영하기
            </button>
            <button
              onClick={() => setState("review")}
              className="flex items-center justify-center gap-2 bg-[#6B8E23] text-white py-3.5 rounded-xl font-medium hover:bg-[#556b1c] transition-colors"
            >
              <Edit2 className="w-5 h-5" />
              수정하기
            </button>
          </div>
        </div>
      )}

      {/* Review State */}
      {state === "review" && (
        <div className="space-y-4">
          {/* Confidence Header */}
          <div
            className={`p-4 rounded-2xl border-2 flex items-start gap-3 ${
              lowConfidenceCount > 0
                ? "bg-amber-50 border-amber-300"
                : "bg-green-50 border-green-300"
            }`}
          >
            {lowConfidenceCount > 0 ? (
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p
                className={`text-sm font-bold ${
                  lowConfidenceCount > 0 ? "text-amber-700" : "text-green-700"
                }`}
              >
                {lowConfidenceCount > 0
                  ? `${lowConfidenceCount}개 항목의 신뢰도가 낮습니다 (< 80%)`
                  : "모든 항목의 신뢰도가 높습니다"}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  lowConfidenceCount > 0 ? "text-amber-600" : "text-green-600"
                }`}
              >
                {lowConfidenceCount > 0
                  ? "빨간색으로 표시된 항목을 확인하고 수정해 주세요."
                  : "추출된 정보를 검토하고 확인을 눌러주세요."}
              </p>
            </div>
          </div>

          {/* Extracted Fields */}
          <div className="bg-white border-2 border-[#6B8E23] p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-[#6B8E23]" />
              <h3 className="font-bold text-[#2D3436]">추출된 약 정보</h3>
            </div>
            <div className="space-y-3">
              {fields.map((field, i) => {
                const isLow = field.confidence < 80;
                return (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border-2 ${
                      isLow ? "border-red-300 bg-red-50" : "border-gray-100 bg-[#FFFCF5]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#6c6f72]">{field.label}</span>
                        {isLow && (
                          <span className="text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">
                            낮은 신뢰도
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold ${isLow ? "text-red-500" : "text-[#6B8E23]"}`}
                        >
                          {field.confidence}%
                        </span>
                        <button
                          onClick={() => toggleEdit(i)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                            field.editing
                              ? "bg-[#6B8E23] text-white"
                              : "bg-gray-100 text-[#6c6f72] hover:bg-[#6B8E23] hover:text-white"
                          }`}
                        >
                          {field.editing ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Edit2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {field.editing ? (
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => handleEditField(i, e.target.value)}
                        className="w-full border border-[#6B8E23] rounded-lg px-3 py-1.5 text-sm text-[#2D3436] bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                        autoFocus
                      />
                    ) : (
                      <p className="text-sm font-bold text-[#2D3436]">{field.value}</p>
                    )}
                    <div className="mt-1.5 h-1 bg-gray-200 rounded-full">
                      <div
                        className={`h-full rounded-full ${isLow ? "bg-red-400" : "bg-[#6B8E23]"}`}
                        style={{ width: `${field.confidence}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 border-2 border-[#6B8E23] text-[#6B8E23] py-3.5 rounded-xl font-medium hover:bg-[#f5f3eb] transition-colors"
            >
              다시 업로드
            </button>
            <button
              onClick={handleConfirmReview}
              disabled={confirming}
              className="flex-1 bg-[#6B8E23] text-white py-3.5 rounded-xl font-medium hover:bg-[#556b1c] transition-colors disabled:opacity-60"
            >
              {confirming ? "저장 중..." : "확인 및 저장"}
            </button>
          </div>
        </div>
      )}

      {/* Done State */}
      {state === "done" && (
        <div className="space-y-4">
          <div className="bg-[#6B8E23] text-white p-8 rounded-2xl text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">분석 완료!</h2>
            <p className="text-[#FFFCF5] opacity-90">처방전에서 약 정보를 성공적으로 추출하고 저장했습니다</p>
          </div>

          {/* Summary */}
          <div className="bg-white border-2 border-[#6B8E23] p-5 rounded-2xl">
            <h3 className="font-bold text-[#2D3436] mb-3">저장된 약 정보 요약</h3>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                  <span className="text-[#6c6f72]">{f.label}</span>
                  <span className="font-medium text-[#2D3436]">{f.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/notifications")}
              className="flex items-center justify-center gap-2 bg-white border-2 border-[#6B8E23] text-[#6B8E23] py-3.5 rounded-xl font-medium hover:bg-[#f5f3eb] transition-colors"
            >
              <Bell className="w-5 h-5" />
              알림 설정
            </button>
            <button
              onClick={() => navigate("/ai-guide")}
              className="flex items-center justify-center gap-2 bg-[#6B8E23] text-white py-3.5 rounded-xl font-medium hover:bg-[#556b1c] transition-colors"
            >
              <Brain className="w-5 h-5" />
              AI 가이드 보기
            </button>
          </div>

          <button
            onClick={() => navigate("/")}
            className="w-full border-2 border-dashed border-gray-300 text-[#6c6f72] py-3 rounded-xl text-sm hover:border-[#6B8E23] hover:text-[#6B8E23] transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      )}

      {/* Medical Safety Notice */}
      {state !== "processing" && (
        <div className="mt-6">
          <MedicalSafetyNotice />
        </div>
      )}
    </div>
  );
}
