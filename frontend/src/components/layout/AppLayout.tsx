import { Outlet, NavLink, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  BookOpen,
  MessageCircle,
  Pill,
  NotebookPen,
  Settings,
  CircleHelp,
  MoreHorizontal,
  LogOut,
} from "lucide-react";
import { authApi, clearAllUserData } from "@/lib/api";
import { useEffect, useState } from "react";

const PRIMARY_NAV_ITEMS = [
  { to: "/", label: "홈", icon: LayoutDashboard, end: true },
  { to: "/ai-guide", label: "AI 가이드", icon: BookOpen },
  { to: "/chat", label: "실시간 챗봇", icon: MessageCircle },
  { to: "/medications", label: "내 약 정보", icon: Pill },
  { to: "/records", label: "일상 기록", icon: NotebookPen },
];

const AUXILIARY_NAV_ITEMS = [
  { to: "/settings", label: "환경설정", icon: Settings },
  { to: "/support", label: "문의하기", icon: CircleHelp },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  useEffect(() => {
    setShowMoreMenu(false);
  }, [location.pathname]);

  function handleLogout() {
    setShowMoreMenu(false);
    authApi.logout();
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
          {PRIMARY_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
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

        <div className="px-3 pb-3 relative z-10">
          <p className="px-3.5 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
            보조 메뉴
          </p>
          <div className="space-y-0.5">
            {AUXILIARY_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-white text-green-700 shadow-sm"
                      : "text-gray-500 hover:bg-white/50 hover:text-gray-700"
                  }`
                }
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="flex-1">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="px-3 pb-4 space-y-0.5 relative z-10 border-t border-gray-200/50 pt-3 mx-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── Mobile more menu ── */}
      <div className="md:hidden fixed inset-x-0 top-0 z-50 px-4 pt-3">
        <div className="mx-auto flex max-w-5xl justify-end">
          <div className="relative">
            <button
              type="button"
              aria-label="더보기"
              aria-expanded={showMoreMenu}
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className="flex items-center gap-2 rounded-2xl border border-gray-200/70 bg-white/90 px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white"
            >
              <MoreHorizontal className="w-4 h-4" />
              더보기
            </button>

            {showMoreMenu && (
              <>
                <button
                  type="button"
                  aria-label="더보기 닫기"
                  className="fixed inset-0 z-40 bg-black/10"
                  onClick={() => setShowMoreMenu(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                  {AUXILIARY_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setShowMoreMenu(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200 ${
                          isActive
                            ? "bg-green-50 text-green-700"
                            : "text-gray-600 hover:bg-gray-50"
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{label}</span>
                    </NavLink>
                  ))}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-600 transition-all duration-200 hover:bg-red-50 hover:text-red-500"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>로그아웃</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto pb-20 pt-[4.5rem] md:pb-0 md:pt-0">
        <div className="min-h-full animate-page-enter">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom tab bar (mobile) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-gray-200/40 flex z-40">
        {PRIMARY_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
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
