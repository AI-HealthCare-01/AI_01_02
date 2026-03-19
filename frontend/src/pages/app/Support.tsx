import { useMemo, type ReactNode } from "react";
import {
  ClipboardList,
  Copy,
  Info,
  MessageSquareMore,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

function buildInquiryTemplate() {
  const now = new Date().toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return [
    "[서비스 문의 템플릿]",
    `발생 시각: ${now}`,
    `현재 화면: ${window.location.pathname}`,
    `브라우저: ${window.navigator.userAgent}`,
    "",
    "문의 유형:",
    "재현 순서:",
    "기대한 동작:",
    "실제 동작:",
    "추가 메모:",
  ].join("\n");
}

export default function Support() {
  const inquiryTemplate = useMemo(() => buildInquiryTemplate(), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inquiryTemplate);
      toast.success("문의용 템플릿을 복사했습니다.");
    } catch {
      toast.error("복사에 실패했습니다. 다시 시도해주세요.");
    }
  }

  return (
    <div className="min-h-full p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">문의하기</h1>
        <p className="text-sm text-gray-400">서비스 사용 중 불편사항이나 오류 내용을 정리할 수 있는 안내 페이지입니다.</p>
      </div>

      <section className="card-warm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <MessageSquareMore className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">문의 접수 안내</h2>
            <p className="text-sm text-gray-400">현재 앱 내 직접 접수 기능은 준비 중이며, 아래 내용을 정리해 전달하면 확인이 빨라집니다.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <GuideCard
            icon={<Info className="w-4 h-4" />}
            title="무엇이 문제였는지"
            description="어느 화면에서 어떤 버튼을 눌렀는지, 어떤 문제가 보였는지 순서대로 적어주세요."
          />
          <GuideCard
            icon={<ClipboardList className="w-4 h-4" />}
            title="재현 여부"
            description="같은 동작을 다시 했을 때 동일하게 발생하는지 같이 적어주면 원인 파악에 도움이 됩니다."
          />
          <GuideCard
            icon={<ShieldAlert className="w-4 h-4" />}
            title="건강 관련 긴급 상황"
            description="응급 상황이나 자해 위험이 있으면 앱 문의보다 즉시 119 또는 지역 정신건강 상담기관에 연락하세요."
          />
        </div>
      </section>

      <section className="card-warm p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-800">문의 템플릿</h2>
            <p className="text-sm text-gray-400 mt-1">현재 화면과 기기 정보가 포함된 기본 템플릿입니다.</p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 transition-all duration-200 hover:bg-green-100"
          >
            <Copy className="w-4 h-4" />
            복사
          </button>
        </div>

        <textarea
          value={inquiryTemplate}
          readOnly
          className="w-full h-64 resize-none rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm text-gray-700 focus:outline-none"
        />
      </section>
    </div>
  );
}

function GuideCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-4">
      <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm font-bold text-gray-800 mb-1">{title}</p>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
