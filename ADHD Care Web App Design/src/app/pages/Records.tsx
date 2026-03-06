import { useState } from "react";
import { Calendar, TrendingUp, Activity, Moon, Coffee, Dumbbell } from "lucide-react";

export default function Records() {
  const [selectedDate, setSelectedDate] = useState("2026-02-24");

  const dailyRecords = [
    {
      date: "2026-02-24",
      medication: { morning: true, evening: false },
      symptoms: {
        concentration: 7,
        impulse: 6,
        mood: 8,
      },
      lifestyle: {
        sleep: 7,
        exercise: 30,
        caffeine: 2,
      },
      notes: "오늘 집중력이 좋았음. 오후에 약간의 두통이 있었지만 금방 나아졌음.",
    },
    {
      date: "2026-02-23",
      medication: { morning: true, evening: true },
      symptoms: {
        concentration: 8,
        impulse: 7,
        mood: 7,
      },
      lifestyle: {
        sleep: 6.5,
        exercise: 0,
        caffeine: 3,
      },
      notes: "운동을 못해서 저녁에 집중하기 어려웠음.",
    },
  ];

  const currentRecord = dailyRecords.find((r) => r.date === selectedDate) || dailyRecords[0];

  const weekData = [
    { day: "월", concentration: 7, impulse: 6, mood: 8 },
    { day: "화", concentration: 8, impulse: 7, mood: 7 },
    { day: "수", concentration: 6, impulse: 5, mood: 6 },
    { day: "목", concentration: 7, impulse: 6, mood: 7 },
    { day: "금", concentration: 8, impulse: 7, mood: 8 },
    { day: "토", concentration: 7, impulse: 6, mood: 8 },
    { day: "일", concentration: 7, impulse: 6, mood: 7 },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-[#2D3436]">일상 기록</h1>
        <p className="text-[#6c6f72]">증상과 생활 패턴을 기록하고 분석하세요</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Daily Entry */}
        <div className="lg:col-span-2 space-y-6">
          {/* Date Selector */}
          <div className="bg-[#20B2AA] text-white p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6" />
                <h2 className="text-xl font-bold">오늘의 기록</h2>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-[#1a8f89] border border-[#1a8f89] rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
              />
            </div>
          </div>

          {/* Medication Status */}
          <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
            <h3 className="font-bold text-xl mb-4 text-[#2D3436]">복약 현황</h3>
            <div className="grid grid-cols-2 gap-4">
              <div
                className={`p-4 rounded-lg border-2 ${
                  currentRecord.medication.morning
                    ? "bg-[#20B2AA] text-white border-[#20B2AA]"
                    : "bg-[#FFFCF5] border-[#20B2AA]"
                }`}
              >
                <div className="text-sm mb-1">아침 복약</div>
                <div className="text-2xl font-bold">
                  {currentRecord.medication.morning ? "✓" : "—"}
                </div>
              </div>
              <div
                className={`p-4 rounded-lg border-2 ${
                  currentRecord.medication.evening
                    ? "bg-[#20B2AA] text-white border-[#20B2AA]"
                    : "bg-[#FFFCF5] border-[#20B2AA]"
                }`}
              >
                <div className="text-sm mb-1">저녁 복약</div>
                <div className="text-2xl font-bold">
                  {currentRecord.medication.evening ? "✓" : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Symptoms */}
          <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
            <h3 className="font-bold text-xl mb-4 text-[#2D3436]">증상 기록</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[#2D3436]">집중력</span>
                  <span className="font-bold text-[#2D3436]">{currentRecord.symptoms.concentration}/10</span>
                </div>
                <div className="h-3 bg-[#f5f3eb] rounded-full">
                  <div
                    className="h-full bg-[#20B2AA] rounded-full"
                    style={{ width: `${currentRecord.symptoms.concentration * 10}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[#2D3436]">충동 조절</span>
                  <span className="font-bold text-[#2D3436]">{currentRecord.symptoms.impulse}/10</span>
                </div>
                <div className="h-3 bg-[#f5f3eb] rounded-full">
                  <div
                    className="h-full bg-[#20B2AA] rounded-full"
                    style={{ width: `${currentRecord.symptoms.impulse * 10}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-[#2D3436]">기분</span>
                  <span className="font-bold text-[#2D3436]">{currentRecord.symptoms.mood}/10</span>
                </div>
                <div className="h-3 bg-[#f5f3eb] rounded-full">
                  <div
                    className="h-full bg-[#20B2AA] rounded-full"
                    style={{ width: `${currentRecord.symptoms.mood * 10}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Lifestyle */}
          <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
            <h3 className="font-bold text-xl mb-4 text-[#2D3436]">생활 패턴</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <Moon className="w-8 h-8 mx-auto mb-2 text-[#20B2AA]" />
                <div className="text-2xl font-bold text-[#2D3436]">{currentRecord.lifestyle.sleep}h</div>
                <div className="text-sm text-[#6c6f72]">수면</div>
              </div>
              <div className="text-center">
                <Dumbbell className="w-8 h-8 mx-auto mb-2 text-[#20B2AA]" />
                <div className="text-2xl font-bold text-[#2D3436]">{currentRecord.lifestyle.exercise}분</div>
                <div className="text-sm text-[#6c6f72]">운동</div>
              </div>
              <div className="text-center">
                <Coffee className="w-8 h-8 mx-auto mb-2 text-[#20B2AA]" />
                <div className="text-2xl font-bold text-[#2D3436]">{currentRecord.lifestyle.caffeine}잔</div>
                <div className="text-sm text-[#6c6f72]">카페인</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
            <h3 className="font-bold text-xl mb-3 text-[#2D3436]">오늘의 일기</h3>
            <p className="text-[#6c6f72] leading-relaxed">{currentRecord.notes}</p>
          </div>
        </div>

        {/* Right Column - Trends */}
        <div className="space-y-6">
          {/* Weekly Trend */}
          <div className="bg-[#20B2AA] text-white p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-6 h-6" />
              <h3 className="font-bold text-xl">주간 추세</h3>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-[#FFFCF5] opacity-90 mb-2">평균 집중력</div>
                <div className="text-3xl font-bold">7.1/10</div>
              </div>
              <div>
                <div className="text-sm text-[#FFFCF5] opacity-90 mb-2">평균 수면 시간</div>
                <div className="text-3xl font-bold">6.9h</div>
              </div>
              <div>
                <div className="text-sm text-[#FFFCF5] opacity-90 mb-2">복약 준수율</div>
                <div className="text-3xl font-bold">94%</div>
              </div>
            </div>
          </div>

          {/* Activity Chart */}
          <div className="bg-white border-2 border-[#20B2AA] p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-6 h-6 text-[#20B2AA]" />
              <h3 className="font-bold text-xl text-[#2D3436]">주간 활동</h3>
            </div>

            <div className="space-y-2">
              {weekData.map((day, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-8 text-sm font-medium text-[#2D3436]">{day.day}</div>
                  <div className="flex-1 flex gap-1">
                    <div
                      className="h-8 bg-[#20B2AA] rounded"
                      style={{ width: `${(day.concentration / 10) * 100}%` }}
                      title={`집중력: ${day.concentration}`}
                    />
                  </div>
                  <div className="w-8 text-sm text-right text-[#2D3436]">{day.concentration}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-[#20B2AA]">
              <div className="text-sm text-[#6c6f72]">
                * 청록색 막대는 집중력 수준을 나타냅니다
              </div>
            </div>
          </div>

          {/* Quick Add Button */}
          <button className="w-full bg-[#FFD166] border-2 border-[#FFD166] text-[#2D3436] py-4 rounded-2xl font-bold hover:bg-[#ffc84d] hover:border-[#ffc84d] transition-colors">
            오늘의 기록 추가
          </button>
        </div>
      </div>
    </div>
  );
}
