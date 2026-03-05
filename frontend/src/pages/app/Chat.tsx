import { useEffect, useRef, useState } from "react";
import { Send, Plus, Loader2, MessageCircle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { chatApi } from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";

// ── 세션 목록 (localStorage) ────────────────────────────────────────────────

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

// ── 메시지 타입 ─────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export default function Chat() {
  const [sessions, setSessions] = useState<StoredSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [promptOptions, setPromptOptions] = useState<{ id: string; label: string }[]>([]);
  // 모바일: 대화목록 보기 vs 채팅 보기
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatApi.getPromptOptions().then((r) => setPromptOptions(r.items)).catch(() => {});
    // 저장된 세션 없으면 새 세션 자동 시작
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
      setMessages([
        {
          role: "assistant",
          content: "안녕하세요! 복약, 부작용에 대해서 무엇이든 질문하세요.",
        },
      ]);
      setMobileView("chat");
    } catch (err) {
      toast.error(toUserMessage(err));
    }
  }

  function selectSession(s: StoredSession) {
    setActiveSessionId(s.id);
    setMessages([{ role: "assistant", content: "안녕하세요! 복약, 부작용에 대해서 무엇이든 질문하세요." }]);
    setMobileView("chat");
    chatApi.getMessages(s.id, { limit: 50 })
      .then((r) => {
        if (r.items.length === 0) return;
        setMessages(r.items.map((m) => ({
          role: m.role === "USER" ? "user" : "assistant",
          content: m.content,
        })));
      })
      .catch(() => {
        // 세션이 서버에 없으면 localStorage에서 제거 후 새 세션 생성
        const next = loadSessions().filter((x) => x.id !== s.id);
        saveSessions(next);
        setSessions(next);
        startNewSession();
      });
  }

  async function deleteCurrentSession() {
    if (!activeSessionId) return;
    await chatApi.deleteSession(activeSessionId).catch(() => {});
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

    // 첫 유저 메시지로 세션 제목 업데이트
    const isFirst = messages.filter((m) => m.role === "user").length === 0;
    if (isFirst) {
      const title = msg.length > 20 ? msg.slice(0, 20) + "…" : msg;
      const next = sessions.map((s) =>
        s.id === activeSessionId ? { ...s, title } : s,
      );
      saveSessions(next);
      setSessions(next);
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setStreaming(true);

    const assistantIdx = messages.length + 1;
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      let accumulated = "";
      for await (const chunk of chatApi.streamMessage(activeSessionId, msg)) {
        accumulated += chunk;
        setMessages((prev) =>
          prev.map((m, i) => (i === assistantIdx ? { ...m, content: accumulated } : m)),
        );
      }
      setMessages((prev) =>
        prev.map((m, i) => (i === assistantIdx ? { ...m, streaming: false } : m)),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === assistantIdx
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
    <div className="flex h-full">
      {/* ── 대화 목록 패널 ── */}
      <div
        className={`
          ${mobileView === "list" ? "flex" : "hidden"} md:flex
          w-full md:w-64 shrink-0 flex-col border-r border-gray-100 bg-white
        `}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">대화 목록</h2>
          <button
            onClick={() => startNewSession()}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
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
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                  s.id === activeSessionId ? "bg-green-50" : ""
                }`}
              >
                <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
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

      {/* ── 채팅 패널 ── */}
      <div
        className={`
          ${mobileView === "chat" ? "flex" : "hidden"} md:flex
          flex-1 flex-col min-w-0
        `}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-white">
          {/* 모바일: 뒤로가기 */}
          <button
            onClick={() => setMobileView("list")}
            className="md:hidden p-1 text-gray-400 hover:text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full border-2 border-gray-300 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4 text-gray-400" />
          </div>
          <span className="text-base font-bold text-gray-800">loguri AI</span>
          <div className="flex-1" />
          {activeSession && (
            <button
              onClick={deleteCurrentSession}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors"
            >
              대화 삭제
            </button>
          )}
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full border-2 border-gray-200 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <MessageCircle className="w-3 h-3 text-gray-400" />
                </div>
              )}
              <div
                className={`max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-green-600 text-white rounded-br-sm"
                    : "bg-white border border-gray-200 text-gray-700 rounded-bl-sm"
                }`}
              >
                {msg.content}
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-4 bg-green-400 animate-pulse ml-1 rounded-sm align-middle" />
                )}
              </div>
            </div>
          ))}

          {/* 퀵 프롬프트 */}
          {promptOptions.length > 0 && messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {promptOptions.slice(0, 4).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => sendMessage(opt.label)}
                  disabled={streaming}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:border-green-400 hover:text-green-700 bg-white transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* 입력창 */}
        <div className="px-4 md:px-8 pb-6 pt-2 bg-white border-t border-gray-100">
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
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming || !activeSessionId}
              className="px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 flex items-center"
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
