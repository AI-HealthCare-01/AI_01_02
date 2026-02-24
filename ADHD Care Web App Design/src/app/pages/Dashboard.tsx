import { Bell, Calendar, Clock, MessageCircle, Plus, ScanText, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router";

export default function Dashboard() {
  const navigate = useNavigate();

  const medications = [
    {
      name: "메틸페니데이트 서방정",
      dosage: "18mg",
      time: "08:00",
      taken: true,
      remainingPills: 6,
      totalPills: 30,
      dday: 6,
    },
    {
      name: "아토목세틴",
      dosage: "40mg",
      time: "20:00",
      taken: false,
      remainingPills: 23,
      totalPills: 30,
      dday: 23,
    },
  ];

  const ddayAlerts = medications.filter((item) => item.dday <= 7);

  const todaySchedule = [
    { time: "08:00", label: "메틸페니데이트 서방정 18mg", status: "completed" },
    { time: "20:00", label: "아토목세틴 40mg", status: "pending" },
    { time: "21:00", label: "AI 가이드 복약 점검", status: "upcoming" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-[#2D3436]">안녕하세요, 김민수님</h1>
        <p className="text-[#6c6f72]">오늘의 복약, OCR, 가이드, 챗봇 상태를 한 번에 확인하세요</p>
      </div>

      {ddayAlerts.length > 0 && (
        <div className="bg-[#20B2AA] text-white p-6 rounded-2xl mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Bell className="w-5 h-5" />
                <span className="text-sm font-medium">약 소진 D-day 알림 (7일 이내)</span>
              </div>
              <h2 className="text-3xl font-bold mb-1">D-{ddayAlerts[0].dday}</h2>
              <p className="text-[#FFFCF5] opacity-90">
                {ddayAlerts[0].name} 재처방 일정 확인이 필요합니다.
              </p>
            </div>
            <button
              onClick={() => navigate("/notifications")}
              className="bg-[#FFD166] text-[#2D3436] px-4 py-2 rounded-lg font-medium hover:bg-[#ffc84d] transition-colors"
            >
              알림 센터 보기
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#2D3436]">오늘의 복약</h2>
            <Calendar className="w-6 h-6 text-[#20B2AA]" />
          </div>

          <div className="space-y-3">
            {medications.map((medication) => (
              <div
                key={medication.name}
                className={`p-4 rounded-xl border-2 ${
                  medication.taken
                    ? "bg-[#20B2AA] text-white border-[#20B2AA]"
                    : "bg-[#FFFCF5] border-[#20B2AA]"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-lg mb-1">{medication.name}</h3>
                    <p className={medication.taken ? "text-[#FFFCF5] opacity-90" : "text-[#6c6f72]"}>
                      {medication.dosage} · {medication.time}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">{medication.remainingPills}정</div>
                    <div className={`text-xs ${medication.taken ? "text-[#FFFCF5] opacity-80" : "text-[#6c6f72]"}`}>
                      소진까지 D-{medication.dday}
                    </div>
                  </div>
                </div>

                <div className={`h-2 rounded-full mt-3 ${medication.taken ? "bg-[#1a8f89]" : "bg-[#f5f3eb]"}`}>
                  <div
                    className={`h-full rounded-full ${medication.taken ? "bg-white" : "bg-[#20B2AA]"}`}
                    style={{ width: `${(medication.remainingPills / medication.totalPills) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/ocr-scan")}
            className="w-full mt-4 border-2 border-dashed border-[#20B2AA] text-[#20B2AA] p-4 rounded-xl hover:bg-[#f5f3eb] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            새 문서 OCR 등록
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-[#20B2AA]" />
              <h3 className="font-bold text-[#2D3436]">복약 준수율</h3>
            </div>
            <div className="text-5xl font-bold mb-2 text-[#2D3436]">94%</div>
            <p className="text-[#6c6f72] text-sm">지난 30일 평균</p>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-green-600 font-medium">+5% 향상</span>
            </div>
          </div>

          <div className="bg-[#FFD166] text-[#2D3436] p-6 rounded-2xl space-y-3">
            <h3 className="font-bold">바로가기</h3>
            <button
              onClick={() => navigate("/ai-coach")}
              className="w-full bg-[#2D3436] text-white py-2 rounded-lg font-medium hover:bg-[#1a1d1f] transition-colors"
            >
              AI 가이드 보기
            </button>
            <button
              onClick={() => navigate("/chat")}
              className="w-full bg-[#20B2AA] text-white py-2 rounded-lg font-medium hover:bg-[#1a8f89] transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              실시간 챗봇
            </button>
            <button
              onClick={() => navigate("/ocr-scan")}
              className="w-full bg-white border border-[#20B2AA] text-[#20B2AA] py-2 rounded-lg font-medium hover:bg-[#f5f3eb] transition-colors flex items-center justify-center gap-2"
            >
              <ScanText className="w-4 h-4" />
              OCR 스캔
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
        <h2 className="text-2xl font-bold mb-6 text-[#2D3436]">오늘의 일정</h2>
        <div className="space-y-3">
          {todaySchedule.map((item) => (
            <div key={`${item.time}-${item.label}`} className="flex items-center gap-4 p-4 rounded-lg hover:bg-[#f5f3eb] transition-colors">
              <div className="text-lg font-bold w-16 text-[#2D3436]">{item.time}</div>
              <div className="flex-1 text-[#2D3436]">{item.label}</div>
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  item.status === "completed"
                    ? "bg-[#20B2AA] text-white"
                    : item.status === "pending"
                      ? "bg-[#FFD166] text-[#2D3436]"
                      : "bg-[#f5f3eb] text-[#6c6f72]"
                }`}
              >
                {item.status === "completed" ? "완료" : item.status === "pending" ? "예정" : "대기"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
