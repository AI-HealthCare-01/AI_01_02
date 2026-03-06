import { Outlet, Link, useLocation } from "react-router";
import { Home, Pill, Brain, FileText, ScanText, MessageCircle, Bell } from "lucide-react";

export default function Layout() {
  const location = useLocation();

  const navItems = [
    { path: "/", icon: Home, label: "홈" },
    { path: "/ocr-scan", icon: ScanText, label: "OCR 스캔" },
    { path: "/ai-coach", icon: Brain, label: "AI 가이드" },
    { path: "/chat", icon: MessageCircle, label: "실시간 챗봇" },
    { path: "/notifications", icon: Bell, label: "알림" },
    { path: "/medications", icon: Pill, label: "내 약 정보" },
    { path: "/records", icon: FileText, label: "기록" },
  ];

  return (
    <div className="flex h-screen bg-[#FFFCF5]">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 bg-[#20B2AA] text-white flex flex-col">
        <div className="p-6 border-b border-[#1a8f89]">
          <h1 className="text-xl font-bold hidden md:block">ADHD Care</h1>
          <div className="text-xl font-bold md:hidden">AC</div>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-white text-[#20B2AA]"
                        : "text-[#FFFCF5] hover:bg-[#1a8f89] hover:text-white"
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="hidden md:block">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-[#1a8f89]">
          <div className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full bg-[#1a8f89] flex items-center justify-center">
              <span className="text-sm font-medium">김</span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium">김민수</p>
              <p className="text-xs text-[#FFFCF5] opacity-80">설정</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
