import { useMemo, useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  Loader,
  Camera,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router";

type Stage = "upload" | "processing" | "review" | "done";

type MedicationDraft = {
  id: number;
  drugName: string;
  dose: string;
  frequencyPerDay: string;
  dosagePerOnce: string;
  intakeTime: string;
  totalDays: string;
  confidence: number;
};

const CONFIDENCE_THRESHOLD = 0.8;

export default function OcrScan() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [progress, setProgress] = useState(0);
  const [medications, setMedications] = useState<MedicationDraft[]>([]);

  const hasLowConfidence = useMemo(
    () => medications.some((item) => item.confidence < CONFIDENCE_THRESHOLD),
    [medications],
  );

  const resetUpload = () => {
    setStage("upload");
    setFile(null);
    setPreview(null);
    setIsPdf(false);
    setProgress(0);
    setMedications([]);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setStage("upload");
    const isPdfType = selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf");
    setIsPdf(isPdfType);

    if (isPdfType) {
      setPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleProcess = () => {
    if (!file) return;

    setStage("processing");
    setProgress(0);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 8;
        if (next >= 100) {
          clearInterval(timer);
          setProgress(100);
          setMedications([
            {
              id: 1,
              drugName: "메틸페니데이트 서방정",
              dose: "18mg",
              frequencyPerDay: "1",
              dosagePerOnce: "1",
              intakeTime: "아침 식후",
              totalDays: "30",
              confidence: 0.94,
            },
            {
              id: 2,
              drugName: "아토목세틴",
              dose: "40mg",
              frequencyPerDay: "1",
              dosagePerOnce: "1",
              intakeTime: "저녁 식후",
              totalDays: "30",
              confidence: 0.68,
            },
          ]);
          setStage("review");
          return 100;
        }
        return next;
      });
    }, 180);
  };

  const updateMedication = (id: number, patch: Partial<MedicationDraft>) => {
    setMedications((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleConfirm = () => {
    setStage("done");
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-[#2D3436]">OCR 기반 의료정보 인식</h1>
        <p className="text-[#6c6f72]">처방전/약봉투를 업로드하면 OCR 결과를 확인/수정 후 확정 저장할 수 있습니다</p>
      </div>

      {stage === "upload" && (
        <div className="space-y-6">
          <div className="bg-[#20B2AA] text-white p-6 rounded-2xl">
            <h2 className="font-bold text-xl mb-3">촬영 전 가이드</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-[#1a8f89] rounded-lg p-4">
                <p className="font-semibold mb-2">좋은 촬영 예</p>
                <ul className="space-y-1 text-[#FFFCF5] opacity-95">
                  <li>문서 전체가 프레임 안에 들어오기</li>
                  <li>빛 반사 없이 글자가 선명하기</li>
                  <li>수평 맞추기, 그림자 최소화</li>
                </ul>
              </div>
              <div className="bg-[#1a8f89] rounded-lg p-4">
                <p className="font-semibold mb-2">재촬영 필요 예</p>
                <ul className="space-y-1 text-[#FFFCF5] opacity-95">
                  <li>흔들림으로 텍스트가 번짐</li>
                  <li>강한 반사광/역광</li>
                  <li>문서 일부 잘림</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-dashed border-[#20B2AA] rounded-2xl p-10">
            <div className="text-center">
              <div className="flex justify-center gap-4 mb-6">
                <div className="w-16 h-16 bg-[#20B2AA] rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <div className="w-16 h-16 bg-[#FFD166] rounded-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-[#2D3436]" />
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-2 text-[#2D3436]">의료문서 업로드</h2>
              <p className="text-[#6c6f72] mb-6">처방전/약봉투 파일을 선택하세요</p>

              <label className="inline-block">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="bg-[#20B2AA] text-white px-8 py-4 rounded-lg font-medium cursor-pointer hover:bg-[#1a8f89] transition-colors inline-block">
                  파일 선택
                </span>
              </label>

              <div className="mt-6 text-sm text-[#6c6f72]">
                <p>지원 형식: JPG, PNG, PDF</p>
                <p>최대 크기: 10MB</p>
              </div>
            </div>
          </div>

          {file && (
            <div className="bg-white border-2 border-[#20B2AA] rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-bold text-[#2D3436]">선택 파일: {file.name}</p>
                  <p className="text-sm text-[#6c6f72]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  onClick={handleProcess}
                  className="bg-[#20B2AA] text-white px-5 py-3 rounded-lg font-medium hover:bg-[#1a8f89] transition-colors"
                >
                  OCR 분석 시작
                </button>
              </div>

              <div className="mt-4 bg-[#FFFCF5] rounded-lg p-4 border border-[#f0eee8]">
                {isPdf ? (
                  <div className="text-[#2D3436] flex items-center gap-3">
                    <FileText className="w-8 h-8 text-[#20B2AA]" />
                    <div>
                      <p className="font-medium">PDF 미리보기</p>
                      <p className="text-sm text-[#6c6f72]">PDF는 텍스트 추출 대상으로 업로드됩니다</p>
                    </div>
                  </div>
                ) : (
                  preview && (
                    <img src={preview} alt="Preview" className="max-h-72 rounded-lg object-contain mx-auto" />
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {stage === "processing" && (
        <div className="bg-[#20B2AA] text-white p-8 rounded-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Loader className="w-6 h-6 animate-spin" />
            <div>
              <h3 className="font-bold text-lg">OCR 처리 중...</h3>
              <p className="text-[#FFFCF5] opacity-90 text-sm">텍스트 추출, 구조화, 신뢰도 평가를 진행합니다</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>진행률</span>
              <span>{progress}%</span>
            </div>
            <div className="h-3 bg-[#1a8f89] rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="mt-6 space-y-2 text-sm">
            <div className={progress >= 25 ? "text-white" : "text-[#FFFCF5] opacity-60"}>✓ 문서 검증 완료</div>
            <div className={progress >= 50 ? "text-white" : "text-[#FFFCF5] opacity-60"}>✓ OCR 원문 추출</div>
            <div className={progress >= 75 ? "text-white" : "text-[#FFFCF5] opacity-60"}>✓ 구조화 파싱 및 약물 매핑</div>
            <div className={progress >= 95 ? "text-white" : "text-[#FFFCF5] opacity-60"}>✓ 필드별 신뢰도 임계값 평가</div>
          </div>
        </div>
      )}

      {stage === "review" && (
        <div className="space-y-6">
          <div className="bg-white border-2 border-[#20B2AA] rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold text-[#2D3436]">OCR 결과 확인/수정</h2>
                <p className="text-sm text-[#6c6f72] mt-1">신뢰도 {Math.round(CONFIDENCE_THRESHOLD * 100)}% 미만 필드는 수정 후 확정하세요</p>
              </div>
              {hasLowConfidence ? (
                <div className="bg-[#ffe9e8] text-[#a73a36] px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  저신뢰 필드 존재
                </div>
              ) : (
                <div className="bg-[#dcf7f5] text-[#156f6a] px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  자동 확정 가능
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {medications.map((item) => {
              const isLow = item.confidence < CONFIDENCE_THRESHOLD;
              return (
                <div key={item.id} className={`bg-white border-2 rounded-2xl p-5 ${isLow ? "border-[#FF8A80]" : "border-[#20B2AA]"}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-[#2D3436]">약물 #{item.id}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        isLow ? "bg-[#ffe9e8] text-[#a73a36]" : "bg-[#dcf7f5] text-[#156f6a]"
                      }`}
                    >
                      신뢰도 {(item.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-[#6c6f72] mb-1 block">약품명</label>
                      <input
                        value={item.drugName}
                        onChange={(e) => updateMedication(item.id, { drugName: e.target.value })}
                        className="w-full border-2 border-[#20B2AA] rounded-lg px-3 py-2 bg-[#FFFCF5] text-[#2D3436]"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[#6c6f72] mb-1 block">용량</label>
                      <input
                        value={item.dose}
                        onChange={(e) => updateMedication(item.id, { dose: e.target.value })}
                        className="w-full border-2 border-[#20B2AA] rounded-lg px-3 py-2 bg-[#FFFCF5] text-[#2D3436]"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[#6c6f72] mb-1 block">1일 복용 횟수</label>
                      <input
                        value={item.frequencyPerDay}
                        onChange={(e) => updateMedication(item.id, { frequencyPerDay: e.target.value })}
                        className="w-full border-2 border-[#20B2AA] rounded-lg px-3 py-2 bg-[#FFFCF5] text-[#2D3436]"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[#6c6f72] mb-1 block">1회 복용 개수</label>
                      <input
                        value={item.dosagePerOnce}
                        onChange={(e) => updateMedication(item.id, { dosagePerOnce: e.target.value })}
                        className="w-full border-2 border-[#20B2AA] rounded-lg px-3 py-2 bg-[#FFFCF5] text-[#2D3436]"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[#6c6f72] mb-1 block">복용 시점</label>
                      <input
                        value={item.intakeTime}
                        onChange={(e) => updateMedication(item.id, { intakeTime: e.target.value })}
                        className="w-full border-2 border-[#20B2AA] rounded-lg px-3 py-2 bg-[#FFFCF5] text-[#2D3436]"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[#6c6f72] mb-1 block">총 처방일</label>
                      <input
                        value={item.totalDays}
                        onChange={(e) => updateMedication(item.id, { totalDays: e.target.value })}
                        className="w-full border-2 border-[#20B2AA] rounded-lg px-3 py-2 bg-[#FFFCF5] text-[#2D3436]"
                      />
                    </div>
                  </div>

                  {isLow && (
                    <p className="text-xs text-[#a73a36] mt-3">
                      저신뢰 항목입니다. 원문과 대조 후 수정하거나 재촬영을 권장합니다.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 flex-wrap">
            <button
              onClick={resetUpload}
              className="flex-1 min-w-44 border-2 border-[#20B2AA] text-[#20B2AA] py-4 rounded-lg font-medium hover:bg-[#f5f3eb] transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              재촬영/재업로드
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 min-w-44 bg-[#20B2AA] text-white py-4 rounded-lg font-medium hover:bg-[#1a8f89] transition-colors"
            >
              확인 후 저장
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="space-y-6">
          <div className="bg-[#20B2AA] text-white p-8 rounded-2xl text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">OCR 결과 저장 완료</h2>
            <p className="text-[#FFFCF5] opacity-90">복약 요약과 알림 제안을 확인하고 다음 단계를 진행하세요</p>
          </div>

          <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4 text-[#2D3436]">복약 시작 요약</h3>
            <p className="text-[#6c6f72] leading-relaxed">
              메틸페니데이트(아침)와 아토목세틴(저녁) 복약 스케줄이 등록되었습니다. 약 소진 7일 전 D-day 알림을 설정하면
              재처방 누락을 줄일 수 있습니다.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/notifications")}
              className="bg-[#FFD166] text-[#2D3436] py-4 rounded-lg font-medium hover:bg-[#ffc84d] transition-colors"
            >
              알림 설정으로 이동
            </button>
            <button
              onClick={() => navigate("/ai-coach")}
              className="bg-[#20B2AA] text-white py-4 rounded-lg font-medium hover:bg-[#1a8f89] transition-colors"
            >
              맞춤 가이드 확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
