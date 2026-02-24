import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, Bot, MessageCircle, Send, User, FileText } from "lucide-react";

type ChatRole = "USER" | "ASSISTANT";
type ChatIntent = "smalltalk" | "medical" | "crisis";
type ChatStatus = "ACTIVE" | "CLOSED";

type ChatReference = {
  title: string;
  source: string;
  link: string;
};

type ChatMessage = {
  id: number;
  role: ChatRole;
  content: string;
  createdAt: string;
  intent?: ChatIntent;
  needsClarification?: boolean;
  references?: ChatReference[];
  blockedByGuardrail?: boolean;
};

type ChatSession = {
  id: number;
  title: string;
  status: ChatStatus;
  lastActivityAt: string;
};

const GUARDRAIL_PATTERN = /(자살|자해|죽고\s?싶|오남용|범죄|마약)/i;

const initialSessions: ChatSession[] = [
  { id: 1, title: "복약 시간 질문", status: "ACTIVE", lastActivityAt: "방금 전" },
  { id: 2, title: "카페인 섭취 상담", status: "CLOSED", lastActivityAt: "어제 21:12" },
];

const initialMessages: Record<number, ChatMessage[]> = {
  1: [
    {
      id: 1,
      role: "ASSISTANT",
      content: "안녕하세요. 의료 정보를 기반으로 복약/생활 질문에 답변해드릴게요.",
      createdAt: "09:20",
      intent: "medical",
      references: [
        {
          title: "ADHD Medication Guide",
          source: "NIH",
          link: "https://www.nih.gov",
        },
      ],
    },
  ],
  2: [
    {
      id: 2,
      role: "ASSISTANT",
      content: "세션이 자동 종료되었습니다. 새 질문은 새 세션에서 시작해주세요.",
      createdAt: "어제 21:12",
      intent: "smalltalk",
    },
  ],
};

function classifyIntent(message: string): ChatIntent {
  if (GUARDRAIL_PATTERN.test(message)) return "crisis";
  if (/(약|복용|부작용|식후|식전|카페인|수면|ADHD)/i.test(message)) return "medical";
  return "smalltalk";
}

export default function Chatbot() {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<number>(1);
  const [messagesBySession, setMessagesBySession] =
    useState<Record<number, ChatMessage[]>>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const messages = messagesBySession[activeSessionId] ?? [];

  const canSend = !!activeSession && activeSession.status === "ACTIVE" && input.trim() && !isStreaming;

  const sessionBadgeClass = useMemo(() => {
    if (!activeSession) return "bg-[#f5f3eb] text-[#6c6f72]";
    return activeSession.status === "ACTIVE"
      ? "bg-[#20B2AA] text-white"
      : "bg-[#f5f3eb] text-[#6c6f72]";
  }, [activeSession]);

  const upsertSessionActivity = (sessionId: number) => {
    setSessions((prev) =>
      prev.map((session) => (session.id === sessionId ? { ...session, lastActivityAt: "방금 전" } : session)),
    );
  };

  const appendMessage = (sessionId: number, message: ChatMessage) => {
    setMessagesBySession((prev) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] ?? []), message],
    }));
  };

  const updateLastAssistantMessage = (sessionId: number, content: string) => {
    setMessagesBySession((prev) => {
      const next = [...(prev[sessionId] ?? [])];
      const lastIndex = next.length - 1;
      if (lastIndex < 0) return prev;
      next[lastIndex] = { ...next[lastIndex], content };
      return { ...prev, [sessionId]: next };
    });
  };

  const simulateStreamingAnswer = (sessionId: number, answer: string) => {
    setIsStreaming(true);
    let cursor = 0;
    const buffer = answer.split("");

    const timer = setInterval(() => {
      cursor += 2;
      updateLastAssistantMessage(sessionId, buffer.slice(0, cursor).join(""));
      if (cursor >= buffer.length) {
        clearInterval(timer);
        setIsStreaming(false);
      }
    }, 35);
  };

  const handleSend = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend || !activeSession) return;

    const content = input.trim();
    const intent = classifyIntent(content);
    const timestamp = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    const userMessage: ChatMessage = {
      id: Date.now(),
      role: "USER",
      content,
      createdAt: timestamp,
      intent,
    };
    appendMessage(activeSession.id, userMessage);
    setInput("");
    upsertSessionActivity(activeSession.id);

    if (intent === "crisis") {
      appendMessage(activeSession.id, {
        id: Date.now() + 1,
        role: "ASSISTANT",
        content:
          "위기 신호가 감지되어 일반 답변을 중단합니다. 즉시 1393(자살예방상담전화) 또는 112/119로 도움을 요청하세요.",
        createdAt: timestamp,
        intent,
        blockedByGuardrail: true,
      });
      return;
    }

    const needsClarification = content.length < 8 || /(이거|그거|저거)/.test(content);
    const assistantSeed: ChatMessage = {
      id: Date.now() + 2,
      role: "ASSISTANT",
      content: "",
      createdAt: timestamp,
      intent,
      needsClarification,
      references: needsClarification
        ? []
        : [
            {
              title: "Korean ADHD Clinical Guideline",
              source: "대한소아청소년정신의학회",
              link: "https://www.kacap.or.kr",
            },
            {
              title: "Medication Timing Guidance",
              source: "NIMH",
              link: "https://www.nimh.nih.gov",
            },
          ],
    };
    appendMessage(activeSession.id, assistantSeed);

    const answer = needsClarification
      ? "질문 범위가 넓어 정확한 답변이 어렵습니다. 약 이름, 복용 시간, 현재 증상을 함께 알려주시면 구체적으로 안내할게요."
      : "복용 시간은 가능한 매일 동일하게 유지하는 것이 좋습니다. 카페인은 약 복용 직후보다 2시간 이상 간격을 두는 것을 권장합니다.";
    simulateStreamingAnswer(activeSession.id, answer);
  };

  const handleNewSession = () => {
    const nextId = Math.max(...sessions.map((session) => session.id)) + 1;
    const nextSession: ChatSession = {
      id: nextId,
      title: "새 채팅",
      status: "ACTIVE",
      lastActivityAt: "방금 전",
    };
    setSessions((prev) => [nextSession, ...prev]);
    setMessagesBySession((prev) => ({
      ...prev,
      [nextId]: [
        {
          id: Date.now(),
          role: "ASSISTANT",
          content: "새 세션이 시작되었습니다. 질문을 입력해주세요.",
          createdAt: "방금 전",
          intent: "smalltalk",
        },
      ],
    }));
    setActiveSessionId(nextId);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2 text-[#2D3436]">실시간 챗봇</h1>
          <p className="text-[#6c6f72]">RAG 기반 의료 정보에 한정해 스트리밍 답변을 제공합니다</p>
        </div>
        <button
          onClick={handleNewSession}
          className="bg-[#20B2AA] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#1a8f89] transition-colors"
        >
          새 세션
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border-2 border-[#20B2AA] rounded-2xl p-4 h-[640px] overflow-auto">
          <h2 className="font-bold text-[#2D3436] mb-3">세션 목록</h2>
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                  session.id === activeSessionId
                    ? "border-[#20B2AA] bg-[#f5fffe]"
                    : "border-[#f0eee8] hover:border-[#20B2AA]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-[#2D3436] truncate">{session.title}</div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      session.status === "ACTIVE" ? "bg-[#20B2AA] text-white" : "bg-[#f5f3eb] text-[#6c6f72]"
                    }`}
                  >
                    {session.status}
                  </span>
                </div>
                <p className="text-xs text-[#6c6f72] mt-1">{session.lastActivityAt}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border-2 border-[#20B2AA] rounded-2xl p-4 h-[640px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#20B2AA]" />
              <h2 className="font-bold text-[#2D3436]">대화</h2>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${sessionBadgeClass}`}>
              {activeSession?.status ?? "N/A"}
            </span>
          </div>

          <div className="flex-1 overflow-auto bg-[#FFFCF5] rounded-lg p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl p-3 border ${
                  message.role === "USER"
                    ? "bg-[#20B2AA] text-white border-[#20B2AA] ml-8"
                    : "bg-white text-[#2D3436] border-[#f0eee8] mr-8"
                }`}
              >
                <div className="flex items-center gap-2 mb-2 text-xs opacity-80">
                  {message.role === "USER" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  <span>{message.role}</span>
                  <span>{message.createdAt}</span>
                  {message.intent && (
                    <span className="px-2 py-0.5 rounded-full bg-black/10">{message.intent}</span>
                  )}
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{message.content || "..."}</p>

                {message.blockedByGuardrail && (
                  <div className="mt-3 bg-[#fff6d9] text-[#2D3436] border border-[#FFD166] rounded-lg p-2 text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                    <span>위기 대응 정책으로 일반 LLM 응답을 차단했습니다.</span>
                  </div>
                )}

                {message.needsClarification && (
                  <div className="mt-3 text-xs text-[#6c6f72] bg-[#f5f3eb] rounded-lg p-2">
                    저유사도 질의로 분류되어 재질문 유도 응답이 반환되었습니다.
                  </div>
                )}

                {!!message.references?.length && (
                  <div className="mt-3 pt-2 border-t border-[#f0eee8] space-y-1">
                    {message.references.map((ref) => (
                      <a
                        key={ref.title}
                        href={ref.link}
                        className="text-xs text-[#156f6a] hover:underline flex items-center gap-1"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText className="w-3 h-3" />
                        {ref.title} · {ref.source}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                activeSession?.status === "CLOSED"
                  ? "종료된 세션입니다. 새 세션을 시작해주세요."
                  : "복약, 수면, 부작용 관련 질문을 입력하세요"
              }
              disabled={activeSession?.status !== "ACTIVE"}
              className="flex-1 border-2 border-[#20B2AA] rounded-lg px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
            />
            <button
              type="submit"
              disabled={!canSend}
              className={`px-4 rounded-lg font-medium flex items-center gap-2 ${
                canSend ? "bg-[#20B2AA] text-white hover:bg-[#1a8f89]" : "bg-[#f5f3eb] text-[#6c6f72]"
              }`}
            >
              <Send className="w-4 h-4" />
              전송
            </button>
          </form>
          {isStreaming && <p className="mt-2 text-xs text-[#6c6f72]">SSE 스트리밍 응답 수신 중...</p>}
        </div>
      </div>
    </div>
  );
}
