import { Outlet, NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  BookOpen,
  MessageCircle,
  Pill,
  NotebookPen,
  LogOut,
  UserX,
} from "lucide-react";
import { authApi, clearAllUserData, userApi } from "@/lib/api";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/", label: "홈", icon: LayoutDashboard, end: true },
  { to: "/ai-guide", label: "AI 가이드", icon: BookOpen },
  { to: "/chat", label: "실시간 챗봇", icon: MessageCircle },
  { to: "/medications", label: "내 약 정보", icon: Pill },
  { to: "/records", label: "일상 기록", icon: NotebookPen },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const [showWithdraw, setShowWithdraw] = useState(false);

  function handleLogout() {
    authApi.logout();
    clearAllUserData();
    navigate("/login");
  }

  async function handleWithdraw() {
    try {
      await userApi.deleteAccount();
    } catch {}
    clearAllUserData();
    navigate("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── Sidebar (md+) ── */}
      <aside className="hidden md:flex w-[232px] gradient-sidebar border-r border-gray-200/40 flex-col shrink-0 relative overflow-hidden">
        {/* Decorative organic blobs */}
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-green-200/25 rounded-full blur-3xl" />
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-100/20 rounded-full blur-3xl" />

        {/* Logo */}
        <div className="h-16 flex items-center px-6 relative z-10">
          <span className="font-display text-xl font-bold text-green-600 tracking-tight">
            logly
          </span>
          <span className="ml-1 text-[10px] font-semibold text-green-400/70 tracking-wide uppercase mt-1">
            care
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 relative z-10">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "gradient-primary text-white shadow-md"
                    : "text-gray-500 hover:bg-white/50 hover:text-gray-700"
                }`
              }
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className="flex-1">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout / Withdraw */}
        <div className="px-3 pb-4 space-y-0.5 relative z-10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            로그아웃
          </button>
          <button
            onClick={() => setShowWithdraw(true)}
            className="flex items-center gap-3 w-full px-3.5 py-2 rounded-xl text-xs font-medium text-gray-300 hover:bg-red-50 hover:text-red-400 transition-all duration-200"
          >
            <UserX className="w-3.5 h-3.5 shrink-0" />
            회원 탈퇴
          </button>
        </div>
      </aside>

      {/* ── Withdraw modal ── */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 text-center animate-page-enter">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <UserX className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">회원 탈퇴</h3>
            <p className="text-sm text-gray-400 mb-6">
              탈퇴 시 모든 데이터가 비활성화됩니다.<br />정말 탈퇴하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdraw(false)}
                className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleWithdraw}
                className="flex-1 py-2.5 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
              >
                탈퇴하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="min-h-full animate-page-enter">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom tab bar (mobile) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-gray-200/40 flex z-40">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center flex-1 py-2.5 gap-0.5 transition-all duration-200 ${
                isActive ? "text-green-600" : "text-gray-400"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
                </div>
                <span className="text-[10px] font-semibold leading-none">{label}</span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-500 rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
