import { Outlet, NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  BookOpen,
  MessageCircle,
  Bell,
  Pill,
  NotebookPen,
  LogOut,
  UserX,
} from "lucide-react";
import { clearToken, userApi } from "@/lib/api";
import { useNotification } from "@/lib/NotificationContext";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/", label: "홈", icon: LayoutDashboard, end: true },
  { to: "/ai-guide", label: "AI 가이드", icon: BookOpen },
  { to: "/chat", label: "실시간 챗봇", icon: MessageCircle },
  { to: "/reminders", label: "알람 관리", icon: Bell },
  { to: "/medications", label: "내 약 정보", icon: Pill },
  { to: "/records", label: "일상 기록", icon: NotebookPen },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const { unreadCount } = useNotification();

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  async function handleWithdraw() {
    try {
      await userApi.deleteAccount();
    } catch {}
    clearToken();
    navigate("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar — md+ only */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-100 flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <span className="text-xl font-bold text-green-600 tracking-tight">logly</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {to === "/reminders" && unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout / Withdraw */}
        <div className="px-3 pb-4 space-y-0.5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            로그아웃
          </button>
          <button
            onClick={() => setShowWithdraw(true)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors"
          >
            <UserX className="w-3.5 h-3.5 shrink-0" />
            회원 탈퇴
          </button>
        </div>
      </aside>

      {/* Withdraw confirm modal */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 text-center">
            <UserX className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800 mb-1">회원 탈퇴</h3>
            <p className="text-sm text-gray-400 mb-6">
              탈퇴 시 모든 데이터가 비활성화됩니다.<br />정말 탈퇴하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWithdraw(false)}
                className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleWithdraw}
                className="flex-1 py-2.5 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                탈퇴하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Bottom tab bar — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-40">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-colors ${
                isActive ? "text-green-600" : "text-gray-400"
              }`
            }
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {to === "/reminders" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1 py-px rounded-full min-w-[14px] text-center leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
