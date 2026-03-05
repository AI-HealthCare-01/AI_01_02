import { useState, useRef, useEffect } from "react";
import {
  MessageSquare, Send, Plus, Bot, User, AlertTriangle,
  HelpCircle, BookOpen, Loader2, Trash2,
} from "lucide-react";
import { chatApi, ChatSession } from "../../lib/api";
import MedicalSafetyNotice from "../components/MedicalSafetyNotice";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: { title: string; source: string; url?: string }[];
  isCrisisBlocked?: boolean;
  isClarification?: boolean;
  isStreaming?: boolean;
}

export default function Chatbot() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 첫 진입 시 세션 자동 생성
  useEffect(() => {
    handleNewSession();
  }, []);

  const handleNewSession = async () => {
    try {
      const session = await chatApi.createSession();
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session);
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "안녕하세요! 복약 관리와 ADHD 관련 질문에 답변해 드리는 AI 챗봇입니다. 무엇이든 질문해 주세요.",
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      }]);
    } catch (err: any) {
      setMessages([{
        id: "err",
        role: "assistant",
        content: `세션 생성 실패: ${err.message}`,
        timestamp: "",
      }]);
    }
  };

  const handleDeleteSession = async () => {
    if (!activeSession) return;
    try {
      await chatApi.deleteSession(activeSession.id);
      setSessions((prev) => prev.filter((s) => s.id !== activeSession.id));
      await handleNewSession();
    } catch {}
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !activeSession) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const streamingId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, {
      id: streamingId, role: "assistant", content: "", timestamp: "", isStreaming: true,
    }]);

    try {
      let collected = "";
      for await (const token of chatApi.streamMessage(activeSession.id, userMsg.content)) {
        collected += token;
        setMessages((prev) =>
          prev.map((m) => m.id === streamingId ? { ...m, content: collected } : m)
        );
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingId
            ? { ...m, isStreaming: false, timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) }
            : m
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingId
            ? { ...m, isStreaming: false, content: `오류가 발생했습니다: ${err.message}` }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#FFFCF5]">
      {/* Session List */}
      <div className="hidden lg:flex w-72 flex-col bg-white border-r border-gray-100 shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-[#2D3436]">대화 목록</h2>
            <button onClick={handleNewSession}
              className="w-8 h-8 bg-[#6B8E23] text-white rounded-lg flex items-center justify-center hover:bg-[#556b1c] transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[#6c6f72]">새 대화를 시작하거나 이전 대화를 선택하세요</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => (
            <button key={session.id} onClick={() => setActiveSession(session)}
              className={`w-full text-left p-4 border-b border-gray-50 hover:bg-[#f5f3eb] transition-colors ${
                activeSession?.id === session.id ? "bg-[#f5f3eb] border-l-4 border-l-[#6B8E23]" : ""
              }`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#6B8E23] rounded-full flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#2D3436] truncate">{session.title ?? "새 대화"}</p>
                  <p className="text-xs text-[#6c6f72]">{new Date(session.created_at).toLocaleDateString("ko-KR")}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#6B8E23] rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-[#2D3436]">ADHD Care AI</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-[#6c6f72]">온라인 · 복약 전문 AI</span>
              </div>
            </div>
          </div>
          <button onClick={handleDeleteSession} className="text-[#6c6f72] hover:text-red-500 transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "assistant" ? "bg-[#6B8E23]" : "bg-[#FFD166]"
              }`}>
                {msg.role === "assistant" ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-[#2D3436]" />}
              </div>

              <div className={`max-w-[75%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {msg.isStreaming && msg.content === "" ? (
                  <div className="bg-white border-2 border-[#6B8E23] rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex items-center gap-2 text-[#6c6f72]">
                      <Loader2 className="w-4 h-4 animate-spin text-[#6B8E23]" />
                      <span className="text-sm">응답 생성 중...</span>
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-[#6B8E23] text-white rounded-tr-sm"
                      : "bg-white border-2 border-gray-100 text-[#2D3436] rounded-tl-sm"
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    {msg.isStreaming && <span className="inline-block w-1 h-4 bg-[#6B8E23] animate-pulse ml-1" />}
                  </div>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {msg.sources.map((src, i) => (
                      <div key={i} className="flex items-center gap-1 bg-[#f5f3eb] border border-[#6B8E23]/30 px-2 py-1 rounded-full">
                        <BookOpen className="w-3 h-3 text-[#6B8E23]" />
                        <span className="text-xs text-[#6c6f72]">{src.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.timestamp && <span className="text-xs text-[#6c6f72] px-1">{msg.timestamp}</span>}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-white border-t border-gray-100 p-4 shrink-0">
          <div className="flex gap-3 items-end">
            <div className="flex-1 bg-[#f5f3eb] rounded-2xl px-4 py-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                className="w-full bg-transparent text-[#2D3436] text-sm resize-none focus:outline-none placeholder-[#6c6f72]"
                placeholder="복약, 부작용, 생활습관에 대해 질문하세요... (Enter로 전송)"
                rows={1}
                style={{ maxHeight: "120px" }}
                disabled={isStreaming}
              />
            </div>
            <button onClick={handleSend} disabled={!input.trim() || isStreaming}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                input.trim() && !isStreaming ? "bg-[#6B8E23] hover:bg-[#556b1c] text-white" : "bg-[#f5f3eb] text-[#6c6f72] cursor-not-allowed"
              }`}>
              {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-[#6c6f72] mt-2 px-1">
            * 이 AI는 의료 전문가의 진료를 대체하지 않습니다. 긴급 시 1577-0199로 연락하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
