import { Outlet, NavLink, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  BookOpen,
  MessageCircle,
  Pill,
  NotebookPen,
  MoreHorizontal,
  Settings,
  LogOut,
  CircleHelp,
  X,
} from "lucide-react";
import { authApi, clearAllUserData } from "@/lib/api";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { to: "/", label: "홈", icon: LayoutDashboard, end: true },
  { to: "/ai-guide", label: "AI 가이드", icon: BookOpen },
  { to: "/chat", label: "실시간 챗봇", icon: MessageCircle },
  { to: "/medications", label: "내 약 정보", icon: Pill },
  { to: "/records", label: "일상 기록", icon: NotebookPen },
];

const UTILITY_ITEMS = [
  { key: "settings", label: "환경설정", icon: Settings },
  { key: "contact", label: "문의하기", icon: CircleHelp },
  { key: "logout", label: "로그아웃", icon: LogOut },
] as const;

type UtilityActionKey = (typeof UTILITY_ITEMS)[number]["key"];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMobileUtilityMenu, setShowMobileUtilityMenu] = useState(false);

  function handleLogout() {
    authApi.logout();
    clearAllUserData();
    navigate("/login");
  }

  useEffect(() => {
    setShowMobileUtilityMenu(false);
  }, [location.pathname]);

  function handleUtilityAction(action: UtilityActionKey) {
    setShowMobileUtilityMenu(false);

    if (action === "settings") {
      navigate("/settings");
      return;
    }

    if (action === "contact") {
      navigate("/contact");
      return;
    }

    if (action === "logout") {
      handleLogout();
    }
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

        {/* Utility menu */}
        <div className="px-3 pb-4 space-y-1 relative z-10">
          <p className="px-3.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-300">
            지원 및 계정
          </p>
          {UTILITY_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleUtilityAction(key)}
              className={`flex items-center gap-3 w-full rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                key === "logout"
                  ? "text-gray-400 hover:bg-red-50 hover:text-red-500"
                  : "text-gray-400 hover:bg-white/60 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Mobile global header ── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200/40 glass px-4 md:hidden">
        <div className="flex items-center">
          <span className="font-display text-lg font-bold tracking-tight text-green-600">logly</span>
          <span className="ml-1 mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-green-400/70">care</span>
        </div>
        <button
          type="button"
          aria-label="전역 메뉴 열기"
          onClick={() => setShowMobileUtilityMenu((prev) => !prev)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-800"
        >
          {showMobileUtilityMenu ? <X className="w-4 h-4" /> : <MoreHorizontal className="w-5 h-5" />}
        </button>
      </header>

      {showMobileUtilityMenu && (
        <>
          <button
            type="button"
            aria-label="전역 메뉴 닫기"
            className="fixed inset-0 z-30 bg-black/10 md:hidden"
            onClick={() => setShowMobileUtilityMenu(false)}
          />
          <div className="fixed right-4 top-[3.75rem] z-40 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_18px_40px_rgba(42,38,34,0.16)] md:hidden">
            <div className="p-2">
              {UTILITY_ITEMS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleUtilityAction(key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-colors ${
                    key === "logout"
                      ? "text-gray-700 hover:bg-gray-50"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto pb-28 pt-14 md:pb-0 md:pt-0">
        <div className="min-h-full animate-page-enter">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom tab bar (mobile) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-gray-200/40 glass px-2 pt-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-3 transition-all duration-200 ${
                isActive ? "text-green-600" : "text-gray-400"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon className={`h-[22px] w-[22px] transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
                </div>
                <span className="text-[11px] font-semibold leading-none tracking-[-0.01em]">{label}</span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 h-0.5 w-9 -translate-x-1/2 rounded-full bg-green-500" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
