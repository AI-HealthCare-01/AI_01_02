import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  Home,
  ScanLine,
  Brain,
  MessageSquare,
  Bell,
  Pill,
  BarChart2,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { path: "/", icon: Home, label: "홈" },
    { path: "/ocr-scan", icon: ScanLine, label: "처방전 스캔" },
    { path: "/ai-guide", icon: Brain, label: "AI 가이드" },
    { path: "/chatbot", icon: MessageSquare, label: "실시간 챗봇" },
    { path: "/notifications", icon: Bell, label: "알림" },
    { path: "/medications", icon: Pill, label: "내 약 정보" },
    { path: "/records", icon: BarChart2, label: "기록" },
  ];

  const handleLogout = () => {
    navigate("/login");
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-[#6d7a49]">
        <div className="flex items-center justify-center lg:justify-start">
          <h1 className="text-2xl lg:text-3xl font-bold leading-tight text-white">Logly</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <p className="hidden lg:block text-xs text-[#FFFCF5] opacity-50 px-3 mb-2 mt-1">메뉴</p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    isActive
                      ? "bg-white text-[#8A9A5B] shadow-sm"
                      : "text-[#FFFCF5] hover:bg-[#6d7a49]"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="hidden lg:block text-sm whitespace-nowrap">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="hidden lg:block w-4 h-4 ml-auto text-[#8A9A5B]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-[#6d7a49]">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-[#FFD166] flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-[#2D3436]">김</span>
          </div>
          <div className="hidden lg:block flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">김민수</p>
            <p className="text-xs text-[#FFFCF5] opacity-60 truncate">minsu@example.com</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-[#FFFCF5] hover:bg-[#6d7a49] transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="hidden lg:block text-sm whitespace-nowrap">로그아웃</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#FFFCF5] overflow-hidden">
      {/* Desktop Sidebar - now using lg breakpoint (1024px) instead of md (768px) */}
      <aside className="hidden lg:flex w-64 xl:w-72 bg-[#8A9A5B] text-white flex-col shrink-0 transition-all duration-300">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-0 bottom-0 z-50 w-64 bg-[#8A9A5B] text-white flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 flex items-center justify-between border-b border-[#6d7a49]">
          <span className="text-2xl font-bold text-white">Logly</span>
          <button onClick={() => setSidebarOpen(false)} className="text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-[#2D3436]">
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-xl font-bold text-[#8A9A5B]">Logly</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}