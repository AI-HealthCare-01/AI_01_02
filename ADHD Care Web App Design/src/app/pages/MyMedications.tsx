import { useState } from "react";
import { Calendar, Clock, AlertCircle, TrendingUp, ChevronRight } from "lucide-react";

export default function MyMedications() {
  const [selectedMed, setSelectedMed] = useState<number | null>(1);

  const medications = [
    {
      id: 1,
      name: "메틸페니데이트 서방정",
      dosage: "18mg",
      manufacturer: "한국제약",
      totalPills: 30,
      remainingPills: 6,
      startDate: "2026-01-26",
      dosageTime: "08:00",
      dosageInstructions: "아침 식후",
      adherenceRate: 96,
      sideEffects: ["식욕 감소 (경미)", "가끔 두통"],
      dday: 6,
    },
    {
      id: 2,
      name: "아토목세틴",
      dosage: "40mg",
      manufacturer: "글로벌파마",
      totalPills: 30,
      remainingPills: 23,
      startDate: "2026-01-26",
      dosageTime: "20:00",
      dosageInstructions: "저녁 식후",
      adherenceRate: 92,
      sideEffects: ["없음"],
      dday: 23,
    },
  ];

  const selectedMedication = medications.find((m) => m.id === selectedMed);
  const adherenceHistory = [
    { date: "2/24", taken: true },
    { date: "2/23", taken: true },
    { date: "2/22", taken: true },
    { date: "2/21", taken: false },
    { date: "2/20", taken: true },
    { date: "2/19", taken: true },
    { date: "2/18", taken: true },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-[#2D3436]">내 약 정보</h1>
        <p className="text-[#6c6f72]">현재 복용 중인 약물과 D-day를 확인하세요</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-[#2D3436]">현재 복용 약물</h2>

          {medications.map((med) => (
            <button
              key={med.id}
              onClick={() => setSelectedMed(med.id)}
              className={`w-full text-left p-6 rounded-2xl border-2 transition-all ${
                selectedMed === med.id
                  ? "bg-[#20B2AA] text-white border-[#20B2AA]"
                  : "bg-white border-[#20B2AA] hover:bg-[#f5f3eb]"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-bold text-xl mb-1">{med.name}</h3>
                  <p className={selectedMed === med.id ? "text-[#FFFCF5] opacity-90" : "text-[#6c6f72]"}>
                    {med.dosage} · {med.manufacturer}
                  </p>
                </div>
                <ChevronRight className={`w-6 h-6 ${selectedMed === med.id ? "text-white" : "text-[#20B2AA]"}`} />
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{med.remainingPills}</div>
                  <div className={`text-xs ${selectedMed === med.id ? "text-[#FFFCF5] opacity-80" : "text-[#6c6f72]"}`}>
                    남은 알약
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{med.adherenceRate}%</div>
                  <div className={`text-xs ${selectedMed === med.id ? "text-[#FFFCF5] opacity-80" : "text-[#6c6f72]"}`}>
                    복약 준수율
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold">D-{med.dday}</div>
                  <div className={`text-xs ${selectedMed === med.id ? "text-[#FFFCF5] opacity-80" : "text-[#6c6f72]"}`}>
                    소진까지
                  </div>
                </div>
              </div>

              <div className={`h-2 rounded-full mt-4 ${selectedMed === med.id ? "bg-[#1a8f89]" : "bg-[#f5f3eb]"}`}>
                <div
                  className={`h-full rounded-full ${selectedMed === med.id ? "bg-white" : "bg-[#20B2AA]"}`}
                  style={{ width: `${(med.remainingPills / med.totalPills) * 100}%` }}
                />
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {selectedMedication ? (
            <>
              <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
                <h2 className="text-2xl font-bold mb-6 text-[#2D3436]">상세 정보</h2>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 mt-1 text-[#20B2AA]" />
                    <div className="flex-1">
                      <div className="font-bold mb-1 text-[#2D3436]">복용 시간</div>
                      <div className="text-[#6c6f72]">
                        {selectedMedication.dosageTime} ({selectedMedication.dosageInstructions})
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 mt-1 text-[#20B2AA]" />
                    <div className="flex-1">
                      <div className="font-bold mb-1 text-[#2D3436]">복용 시작일</div>
                      <div className="text-[#6c6f72]">{selectedMedication.startDate}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 mt-1 text-[#20B2AA]" />
                    <div className="flex-1">
                      <div className="font-bold mb-1 text-[#2D3436]">부작용 기록</div>
                      <div className="text-[#6c6f72]">{selectedMedication.sideEffects.join(", ")}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-[#2D3436]">최근 복약 기록</h3>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">{selectedMedication.adherenceRate}%</span>
                  </div>
                </div>

                <div className="flex justify-between gap-2">
                  {adherenceHistory.map((day) => (
                    <div key={day.date} className="flex-1 text-center">
                      <div className={`aspect-square rounded-lg mb-2 ${day.taken ? "bg-[#20B2AA]" : "bg-[#f5f3eb]"}`} />
                      <div className="text-xs text-[#6c6f72]">{day.date}</div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedMedication.dday <= 7 ? (
                <div className="bg-[#FFD166] text-[#2D3436] p-6 rounded-2xl">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertCircle className="w-6 h-6" />
                    <h3 className="font-bold text-lg">재처방 알림</h3>
                  </div>
                  <p className="opacity-90 mb-4">
                    약 소진까지 {selectedMedication.dday}일 남았습니다. 병원 예약을 미리 잡아두세요.
                  </p>
                  <button className="w-full bg-[#2D3436] text-white py-3 rounded-lg font-medium hover:bg-[#1a1d1f] transition-colors">
                    병원 일정 확인
                  </button>
                </div>
              ) : (
                <div className="bg-[#f5f3eb] text-[#6c6f72] p-6 rounded-2xl">
                  <p className="text-sm">D-day 알림은 소진 7일 전부터 자동 노출됩니다.</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border-2 border-dashed border-[#20B2AA] p-12 rounded-2xl text-center">
              <p className="text-[#6c6f72]">약물을 선택하여 상세 정보를 확인하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
