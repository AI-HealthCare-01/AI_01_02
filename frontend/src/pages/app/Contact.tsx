import { useState } from "react";
import { CheckCircle2, ChevronRight, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

const INQUIRY_TYPES = [
  "서비스 이용 문의",
  "복약 알림 문의",
  "AI 가이드 문의",
  "오류 제보",
  "기타",
] as const;

export default function Contact() {
  const [type, setType] = useState<(typeof INQUIRY_TYPES)[number]>("서비스 이용 문의");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  function handleSubmit() {
    toast.info("문의 기능은 현재 준비 중입니다. 입력하신 내용은 아직 전송되지 않습니다.");
  }

  return (
    <div className="min-h-full max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">문의하기</h1>
        <p className="mt-1 text-sm leading-6 text-gray-400">
          서비스 이용 중 불편한 점이나 오류가 있다면 아래 내용을 작성해주세요.
          <br />
          확인 후 가능한 빠르게 답변드리겠습니다.
        </p>
      </div>

      <section className="card-warm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <MessageSquareText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-800">문의 작성</h2>
              <p className="mt-0.5 text-xs text-gray-400">유형을 선택하고 문의 내용을 남겨주세요.</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <p className="mb-3 text-sm font-semibold text-gray-700">문의 유형</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {INQUIRY_TYPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setType(item)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                    type === item
                      ? "border-transparent gradient-primary text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{item}</span>
                    <ChevronRight className={`w-4 h-4 ${type === item ? "text-green-50" : "text-gray-300"}`} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">제목</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="문의 제목을 입력해주세요"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition-colors focus:border-green-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">내용</label>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="불편했던 점이나 오류 상황을 자세히 적어주세요"
                className="min-h-[220px] w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 outline-none transition-colors focus:border-green-400"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-green-100 bg-green-50/70 px-4 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <div className="text-sm leading-6 text-gray-600">
                <p>현재 문의 기능은 순차적으로 답변될 예정입니다.</p>
                <p>긴급한 오류는 추후 고객지원 채널과 연동 예정입니다.</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all duration-200 hover:shadow-lg gradient-primary"
          >
            문의 보내기
          </button>
        </div>
      </section>
    </div>
  );
}
