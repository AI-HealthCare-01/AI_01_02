import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Pill, ChevronDown, ChevronUp, AlertTriangle, Upload, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { reminderApi, guideApi, scheduleApi, Reminder, DdayReminder, GuideJobResult } from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";

// ── 7일 복약 준수율 계산 ────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function calcAdherence(): Promise<number | null> {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d;
  });
  const results = await Promise.all(
    days.map((d) =>
      scheduleApi.getDaily(toDateStr(d)).catch(() => ({ date: toDateStr(d), items: [] })),
    ),
  );
  const medItems = results.flatMap((r) => r.items.filter((it) => it.category === "MEDICATION"));
  if (medItems.length === 0) return null;
  const completed = medItems.filter((it) => it.status === "DONE");
  return Math.round((completed.length / medItems.length) * 100);
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export default function Medications() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [ddayMap, setDdayMap] = useState<Record<string, DdayReminder>>({});
  const [guide, setGuide] = useState<GuideJobResult | null>(null);
  const [adherence, setAdherence] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [remData, ddayData] = await Promise.all([
          reminderApi.list(),
          reminderApi.getDday(30),
        ]);
        setReminders(remData.items);
        const map: Record<string, DdayReminder> = {};
        for (const d of ddayData.items) map[d.medication_name] = d;
        setDdayMap(map);

        // 첫 번째 항목 자동 펼치기
        if (remData.items.length > 0) setExpandedId(remData.items[0].id);
      } catch (err) {
        toast.error(toUserMessage(err));
      } finally {
        setLoading(false);
      }

      // 가이드 & 복약률 (비동기)
      const jobId = localStorage.getItem("guide_job_id");
      if (jobId) {
        try {
          const s = await guideApi.getJobStatus(jobId);
          if (s.status === "SUCCEEDED") {
            const r = await guideApi.getJobResult(jobId);
            setGuide(r);
          }
        } catch {}
      }
      const rate = await calcAdherence().catch(() => null);
      setAdherence(rate);
    }
    load();
  }, []); // eslint-disable-line

  const active = reminders.filter((r) => r.enabled);
  const inactive = reminders.filter((r) => !r.enabled);
  const ddayWarnings = Object.values(ddayMap).filter((d) => d.remaining_days <= 7);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">내 약 정보</h1>
      <p className="text-sm font-medium text-gray-400 mb-5">현재 복용 중인 약물과 복약 현황을 확인하세요.</p>

      {/* 약 소진 경고 알람 */}
      {ddayWarnings.length > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">약 소진 경고 알람</p>
          </div>
          <p className="text-sm text-amber-700">
            {ddayWarnings.map((d, i) => (
              <span key={d.medication_name}>
                {i > 0 && ", "}
                <strong>{d.medication_name}</strong> D-{d.remaining_days}일
              </span>
            ))}
            {" "}— 처방전을 다시 스캔해 약을 보충하세요.
          </p>
        </div>
      )}

      {/* 2-column layout */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* ── 좌측: 현재 복용 약물 ── */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              <Pill className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p>등록된 약이 없습니다.</p>
              <p className="text-xs mt-1">처방전을 스캔하면 자동으로 등록됩니다.</p>
            </div>
          ) : (
            <div className="space-y-4 stagger-children">
              {active.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    현재 복용 약물
                  </p>
                  <div className="space-y-2">
                    {active.map((r) => (
                      <MedicationAccordion
                        key={r.id}
                        reminder={r}
                        dday={ddayMap[r.medication_name]}
                        expanded={expandedId === r.id}
                        onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
              {inactive.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    중단됨
                  </p>
                  <div className="space-y-2 opacity-60">
                    {inactive.map((r) => (
                      <MedicationAccordion
                        key={r.id}
                        reminder={r}
                        dday={ddayMap[r.medication_name]}
                        expanded={expandedId === r.id}
                        onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* ── 우측 패널 ── */}
        <div className="w-full lg:w-64 shrink-0 space-y-3">
          {/* 약물 상세 정보 */}
          <div className="card-warm rounded-xl p-5 min-h-[160px]">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-green-500" />
              <p className="text-sm font-semibold text-gray-700">약물 상세 정보</p>
            </div>
            {guide ? (
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-[10]">
                {guide.medication_guidance}
              </p>
            ) : (
              <p className="text-xs text-gray-400">
                처방전 스캔 후 AI 가이드가 생성되면 약물 상세 정보가 표시됩니다.
              </p>
            )}
          </div>

          {/* 복약률 */}
          <div className="card-warm rounded-xl px-5 py-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">복약률</span>
            <span className="text-xl font-bold text-green-600">
              {adherence !== null ? `${adherence}%` : "—"}
            </span>
          </div>

          {/* 처방전 스캔 버튼 */}
          <button
            onClick={() => navigate("/onboarding/scan")}
            className="w-full flex items-center justify-center gap-2 py-3 gradient-primary text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all duration-200"
          >
            <Upload className="w-4 h-4" />
            처방전 스캔
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 아코디언 카드 ──────────────────────────────────────────────────────────

function MedicationAccordion({
  reminder: r,
  dday,
  expanded,
  onToggle,
}: {
  reminder: Reminder;
  dday?: DdayReminder;
  expanded: boolean;
  onToggle: () => void;
}) {
  // 남은 약 갯수 추정: remaining_days × 하루 복용 횟수
  const estimatedRemaining =
    dday != null ? dday.remaining_days * (r.schedule_times.length || 1) : null;

  return (
    <div className="card-warm rounded-xl overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <Pill className="w-4 h-4 text-green-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-800">{r.medication_name}</span>
          {dday && dday.remaining_days <= 7 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              D-{dday.remaining_days}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {/* 펼쳐진 내용 */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <div className="flex gap-6 mt-4">
            <div className="text-center">
              <p className="text-xs font-medium text-gray-400 mb-1">남은 약 갯수</p>
              <p className="text-sm font-bold text-gray-800">
                {estimatedRemaining != null ? `${estimatedRemaining}정` : "—"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-400 mb-1">준수율</p>
              <p className="text-sm font-bold text-green-600">
                {r.enabled ? "복용 중" : "중단"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-400 mb-1">D-day</p>
              <p className="text-sm font-bold text-amber-600">
                {dday != null ? `D-${dday.remaining_days}` : "—"}
              </p>
            </div>
          </div>

          {r.dose && (
            <p className="text-xs font-medium text-gray-400 mt-3">용량: {r.dose}</p>
          )}

          <div className="flex flex-wrap gap-1.5 mt-2">
            {r.schedule_times.map((t) => (
              <span
                key={t}
                className="text-xs bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full font-medium"
              >
                {t}
              </span>
            ))}
          </div>

          {(r.start_date || r.end_date) && (
            <p className="text-xs font-medium text-gray-400 mt-2">
              {r.start_date ?? "—"} ~ {r.end_date ?? "계속"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
