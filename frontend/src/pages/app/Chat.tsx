import { useEffect, useRef, useState } from "react";
import { Send, Plus, Loader2, MessageCircle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { chatApi, type ChatReference } from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";

// ── Session list (localStorage) ──────────────────────────────────────────────

interface StoredSession {
  id: string;
  title: string;
  created_at: string;
}

const SESSIONS_KEY = "logly_chat_sessions";

function loadSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: StoredSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === yesterday.toDateString()) return "어제";
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

const WELCOME_MESSAGE = "안녕하세요! 복약, 부작용에 대해서 무엇이든 질문하세요.";

function formatAssistantContent(content: string): string[] {
  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/([.!?]|다\.)\s*(💊|⚠️|✅|☕|📱|🥗|🍽️|🏃|😴|📞)/g, "$1\n\n$2")
    .replace(/([.!?]|다\.)\s*(복약|약물|운동|식단|영양|디지털 사용|카페인|수면|주의|도움)(?=[:：\s])/g, "$1\n\n$2")
    .replace(/\s*•\s*/g, "\n• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized ? normalized.split("\n\n") : [];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  references?: ChatReference[];
}

export default function Chat() {
  const [sessions, setSessions] = useState<StoredSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [promptOptions, setPromptOptions] = useState<{ id: string; label: string }[]>([]);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatApi.getPromptOptions().then((r) => setPromptOptions(r.items)).catch((err) => console.warn("Failed to load prompt options:", err));
    const stored = loadSessions();
    if (stored.length === 0) {
      startNewSession();
    } else {
      selectSession(stored[0]);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startNewSession(title?: string) {
    try {
      const session = await chatApi.createSession(title);
      const stored: StoredSession = {
        id: session.id,
        title: title ?? `새 대화`,
        created_at: new Date().toISOString(),
      };
      const next = [stored, ...loadSessions()];
      saveSessions(next);
      setSessions(next);
      setActiveSessionId(session.id);
      setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
      setMobileView("chat");
    } catch (err) {
      toast.error(toUserMessage(err));
    }
  }

  function selectSession(s: StoredSession) {
    setActiveSessionId(s.id);
    setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
    setMobileView("chat");
    chatApi.getMessages(s.id, { limit: 50 })
      .then((r) => {
        if (r.items.length === 0) return;
        const orderedItems = [...r.items].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        setMessages(
          orderedItems.map((m) => ({
            role: m.role === "USER" ? "user" : "assistant",
            content: m.content,
            references: m.references ?? [],
          })),
        );
      })
      .catch((err) => {
        console.warn("Failed to load chat messages:", err);
        toast.error("대화 기록을 불러오지 못했습니다. 다시 시도해 주세요.");
      });
  }

  async function deleteCurrentSession() {
    if (!activeSessionId) return;
    await chatApi.deleteSession(activeSessionId).catch((err) => {
      console.warn("Failed to delete session:", err);
    });
    const next = sessions.filter((s) => s.id !== activeSessionId);
    saveSessions(next);
    setSessions(next);
    setMessages([]);
    if (next.length > 0) {
      selectSession(next[0]);
    } else {
      startNewSession();
    }
  }

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || !activeSessionId || streaming) return;

    const isFirst = messages.filter((m) => m.role === "user").length === 0;
    if (isFirst) {
      const title = msg.length > 20 ? msg.slice(0, 20) + "..." : msg;
      const next = sessions.map((s) =>
        s.id === activeSessionId ? { ...s, title } : s,
      );
      saveSessions(next);
      setSessions(next);
    }

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: msg },
      { role: "assistant", content: "", streaming: true, references: [] },
    ]);
    setStreaming(true);

    try {
      let accumulated = "";
      for await (const chunk of chatApi.streamMessage(activeSessionId, msg)) {
        if (chunk.type === "token") {
          accumulated += chunk.content;
          setMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: accumulated } : m)),
          );
        }
        if (chunk.type === "reference") {
          setMessages((prev) =>
            prev.map((m, i) => (i === prev.length - 1 ? { ...m, references: chunk.references } : m)),
          );
        }
      }
      setMessages((prev) =>
        prev.map((m, i) => (i === prev.length - 1 ? { ...m, streaming: false } : m)),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { role: "assistant", content: "오류가 발생했습니다. 다시 시도해주세요." }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-[calc(100dvh-5rem)] md:h-dvh">
      {/* ── Session list panel ── */}
      <div
        className={`
          ${mobileView === "list" ? "flex" : "hidden"} md:flex
          w-full md:w-64 shrink-0 flex-col border-r border-gray-200/40 gradient-sidebar
        `}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/40">
          <h2 className="text-base font-bold text-gray-800">대화 목록</h2>
          <button
            onClick={() => startNewSession()}
            className="p-1.5 rounded-xl hover:bg-white/60 text-gray-400 hover:text-gray-600 transition-all duration-200"
            title="새 대화"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">대화 내역이 없습니다.</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSession(s)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/50 transition-all duration-200 border-b border-gray-100/50 ${
                  s.id === activeSessionId ? "bg-white/60" : ""
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  s.id === activeSessionId ? "bg-green-100 border-2 border-green-300" : "border-2 border-gray-200"
                }`}>
                  <MessageCircle className={`w-3.5 h-3.5 ${s.id === activeSessionId ? "text-green-600" : "text-gray-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${
                    s.id === activeSessionId ? "text-green-700" : "text-gray-700"
                  }`}>
                    {s.title}
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{dateLabel(s.created_at)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat panel ── */}
      <div
        className={`
          ${mobileView === "chat" ? "flex" : "hidden"} md:flex
          flex-1 flex-col min-w-0
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200/40 bg-white/60 backdrop-blur-sm">
          <button
            onClick={() => setMobileView("list")}
            className="md:hidden p-1 text-gray-400 hover:text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center shrink-0 shadow-sm">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-gray-800">loguri AI</span>
          <div className="flex-1" />
          {activeSession && (
            <button
              onClick={deleteCurrentSession}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors font-medium"
            >
              대화 삭제
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={`${i}-${msg.role}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center shrink-0 mr-2 mt-0.5 shadow-sm">
                  <MessageCircle className="w-3 h-3 text-white" />
                </div>
              )}
              <div
                className={`max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "gradient-primary text-white rounded-br-md shadow-md"
                    : "bg-white border border-gray-200/60 text-gray-700 rounded-bl-md shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="space-y-3">
                    {formatAssistantContent(msg.content).map((paragraph, idx) => (
                      <p key={`${idx}-${paragraph.slice(0, 24)}`} className="whitespace-pre-wrap">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-4 bg-green-300 animate-pulse ml-1 rounded-sm align-middle" />
                )}
                {msg.references && msg.references.length > 0 && (
                  <div className="mt-3 border-t border-gray-200/60 pt-3">
                    <p className="text-[11px] font-semibold text-gray-500">참고 문헌</p>
                    <div className="mt-2 space-y-1">
                      {msg.references.map((ref) => (
                        <div key={ref.document_id} className="text-xs text-gray-500">
                          <span className="font-medium text-gray-700">{ref.title}</span>
                          <span className="ml-1">- {ref.source}</span>
                          {ref.url && (ref.url.startsWith("http://") || ref.url.startsWith("https://")) && (
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-green-700 underline"
                            >
                              링크
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Quick prompts */}
          {promptOptions.length > 0 && messages.length <= 1 && (
            <div className="flex flex-wrap gap-2.5 mt-3">
              {promptOptions.slice(0, 4).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => sendMessage(opt.label)}
                  disabled={streaming}
                  className="px-5 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:border-green-300 hover:text-green-700 hover:bg-green-50/50 bg-white active:scale-95 transition-all duration-200 font-medium"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 md:px-8 pb-6 pt-2 bg-white/80 backdrop-blur-sm border-t border-gray-200/40">
          <p className="text-[11px] text-gray-400 text-center mb-2">
            AI 챗봇의 응답은 참고용이며, 의료진의 전문적인 진단·처방을 대체하지 않습니다.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming || !activeSessionId}
              placeholder="복약, 부작용에 대해서 질문하세요"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400 transition-all duration-200"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming || !activeSessionId}
              className="px-4 py-3 gradient-primary text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-40 flex items-center"
            >
              {streaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
