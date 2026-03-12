import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

const GOOD_TIPS = [
  "처방전 전체가 화면 안에 들어오도록 촬영",
  "밝은 곳에서 선명하게 촬영",
  "글씨가 흐리지 않게 초점 맞춤",
];

const BAD_TIPS = [
  "일부가 잘리거나 접힌 상태",
  "조명 반사로 글씨가 보이지 않는 경우",
  "흔들리거나 초점이 맞지 않는 경우",
];

export default function OcrScan() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleNext() {
    if (!file || !preview) return;
    navigate("/onboarding/scan-result", { state: { file, preview } });
  }

  return (
    <div className="min-h-screen gradient-warm-bg relative overflow-hidden p-6 md:p-10">
      <div className="absolute top-[-6%] right-[-4%] w-64 h-64 bg-green-200/25 rounded-full blur-3xl" />
      <div className="absolute bottom-[-8%] left-[-6%] w-72 h-72 bg-amber-100/20 rounded-full blur-3xl" />
      <div className="max-w-2xl mx-auto relative z-10 animate-page-enter">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-green-700">처방전 스캔</h1>
          <p className="text-sm text-gray-400 mt-1">
            처방전 사진을 업로드하면 AI가 복약 정보를 자동으로 추출합니다.
          </p>
        </div>

        {/* 촬영 가이드 */}
        <div className="card-warm p-5 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-4">촬영 가이드</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 좋은 예시 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                <p className="text-xs font-semibold text-green-600">좋은 예시</p>
              </div>
              <ul className="space-y-1.5">
                {GOOD_TIPS.map((t) => (
                  <li key={t} className="text-xs text-gray-500 flex items-start gap-1.5">
                    <span className="text-green-400 mt-0.5">·</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {/* 나쁜 예시 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <p className="text-xs font-semibold text-red-500">나쁜 예시</p>
              </div>
              <ul className="space-y-1.5">
                {BAD_TIPS.map((t) => (
                  <li key={t} className="text-xs text-gray-500 flex items-start gap-1.5">
                    <span className="text-red-300 mt-0.5">·</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 업로드 영역 */}
        <div
          className={`border-2 border-dashed rounded-xl bg-white transition-all duration-200 ${
            dragging ? "border-green-400 bg-green-50" : "border-gray-200"
          }`}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
        >
          {preview ? (
            <div className="p-4">
              <img
                src={preview}
                alt="처방전 미리보기"
                className="w-full max-h-64 object-contain rounded-lg mx-auto"
              />
              <p className="text-center text-xs text-gray-400 mt-2">{file?.name}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <button
                onClick={() => inputRef.current?.click()}
                className="px-8 py-3 gradient-primary text-white text-sm rounded-xl font-bold hover:shadow-lg transition-all duration-200 mb-3"
              >
                파일 업로드
              </button>
              <p className="text-sm text-green-600">파일을 드래그 하거나 클릭하여 선택하세요</p>
              <p className="text-xs text-gray-400 mt-4">
                PNG, JPG, JPEG 형식 지원 · 처방전 전체가 잘 보이도록 촬영해주세요.
              </p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {/* 파일 선택 후 버튼 */}
        {file && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => { setFile(null); setPreview(null); }}
              className="flex-1 py-3 border border-gray-200 text-sm text-gray-500 rounded-lg hover:bg-gray-50 transition-all duration-200"
            >
              다시 선택
            </button>
            <button
              onClick={handleNext}
              className="flex-1 py-3 gradient-primary text-white text-sm rounded-xl font-bold hover:shadow-lg transition-all duration-200"
            >
              다음
            </button>
          </div>
        )}

        <button
          onClick={() => navigate("/")}
          className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-all duration-200"
        >
          나중에 하기
        </button>
      </div>
    </div>
  );
}
