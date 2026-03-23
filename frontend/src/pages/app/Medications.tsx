import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Pill, ChevronDown, ChevronUp, AlertTriangle, Upload, Pencil, X, Trash2, Plus, Bell, Clock } from "lucide-react";
import { toast } from "sonner";
import { reminderApi, Reminder, DdayReminder } from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";

const TIME_OPTIONS = [
  { label: "아침 (08:00)", value: "08:00" },
  { label: "점심 (13:00)", value: "13:00" },
  { label: "저녁 (19:00)", value: "19:00" },
  { label: "취침 전 (22:00)", value: "22:00" },
];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTE_OPTIONS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function parseDosagePerOnce(doseText: string | null | undefined) {
  if (!doseText) return null;
  const match = doseText.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export default function Medications() {
  const navigate = useNavigate();
  const location = useLocation();
  const setupReminders = (location.state as { setupReminders?: boolean })?.setupReminders === true;
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [ddayMap, setDdayMap] = useState<Record<string, DdayReminder>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSetupBanner, setShowSetupBanner] = useState(setupReminders);

  async function reload(initial = false) {
    try {
      const [remData, ddayData] = await Promise.all([
        reminderApi.list(),
        reminderApi.getDday(30),
      ]);
      setReminders(remData.items);
      const map: Record<string, DdayReminder> = {};
      for (const d of ddayData.items) map[d.medication_name] = d;
      setDdayMap(map);
      if (initial && remData.items.length > 0) {
        setExpandedId(remData.items[0].id);
        if (setupReminders) setEditingId(remData.items[0].id);
      }
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      await reload(true);
    }
    init();

    // 온보딩에서 전달된 state를 소비하여 새로고침 시 재발 방지
    if (setupReminders) window.history.replaceState({}, "");
  }, []); // eslint-disable-line

  async function handleSave(id: string, data: {
    medication_name: string;
    dose?: string;
    schedule_times: string[];
    dispensed_date?: string;
    total_days?: number;
    enabled?: boolean;
  }) {
    try {
      await reminderApi.update(id, data);
      toast.success("약물 정보가 수정되었습니다.");
      setEditingId(null);
      await reload();
    } catch (err) {
      toast.error(toUserMessage(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await reminderApi.delete(id);
      toast.success("약물이 삭제되었습니다.");
      setEditingId(null);
      await reload();
    } catch (err) {
      toast.error(toUserMessage(err));
    }
  }

  const active = reminders.filter((r) => r.enabled);
  const inactive = reminders.filter((r) => !r.enabled);
  const ddayWarnings = Object.values(ddayMap).filter((d) => d.remaining_days <= 7);
  const totalPlannedIntakes = active.reduce((sum, reminder) => {
    if (reminder.daily_intake_count == null || reminder.total_days == null) return sum;
    return sum + reminder.daily_intake_count * reminder.total_days;
  }, 0);
  const totalConfirmedIntakes = active.reduce((sum, reminder) => sum + reminder.confirmed_intake_count, 0);
  const totalRespondedIntakes = active.reduce((sum, reminder) => sum + reminder.responded_intake_count, 0);
  const overallAdherenceRate = totalPlannedIntakes > 0
    ? Math.round((totalConfirmedIntakes / totalPlannedIntakes) * 100)
    : null;
  const overallRecordRate = totalPlannedIntakes > 0
    ? Math.round((totalRespondedIntakes / totalPlannedIntakes) * 100)
    : null;

  return (
    <div className="min-h-full p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">내 약 정보</h1>
      <p className="text-sm font-medium text-gray-400 mb-5">현재 복용 중인 약물과 복약 현황을 확인하세요.</p>

      {/* 복약 알림 설정 안내 배너 (온보딩에서 진입 시) */}
      {showSetupBanner && reminders.length > 0 && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800 mb-1">복약 알림 시간을 설정하세요</p>
              <p className="text-xs text-green-600 leading-relaxed">
                아래에서 <Clock className="w-3 h-3 inline -mt-0.5" /> <strong>복용 시간</strong>을 선택하고 <strong>저장</strong>을 눌러주세요.
                약마다 개별로 설정할 수 있어요.
              </p>
            </div>
            <button
              onClick={() => setShowSetupBanner(false)}
              className="text-green-400 hover:text-green-600 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
                        editing={editingId === r.id}
                        onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        onEdit={() => setEditingId(editingId === r.id ? null : r.id)}
                        onSave={(data) => handleSave(r.id, data)}
                        onDelete={() => handleDelete(r.id)}
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
                        editing={editingId === r.id}
                        onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        onEdit={() => setEditingId(editingId === r.id ? null : r.id)}
                        onSave={(data) => handleSave(r.id, data)}
                        onDelete={() => handleDelete(r.id)}
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
          {/* 총 복약 현황 */}
          <div className="card-warm rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">처방 기준 복약 현황</h3>
            <div className="space-y-3">
              <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3">
                <p className="text-xs font-semibold text-green-700 mb-1">총 복용율</p>
                <p className="text-2xl font-bold text-green-800">
                  {overallAdherenceRate !== null ? `${overallAdherenceRate}%` : "—"}
                </p>
                <p className="text-[11px] text-green-700 mt-1">
                  완료 {totalConfirmedIntakes} / 예정 {totalPlannedIntakes || 0}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">기록률</p>
                <p className="text-2xl font-bold text-gray-800">
                  {overallRecordRate !== null ? `${overallRecordRate}%` : "—"}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  응답 {totalRespondedIntakes} / 예정 {totalPlannedIntakes || 0}
                </p>
              </div>
            </div>
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
  editing,
  onToggle,
  onEdit,
  onSave,
  onDelete,
}: {
  reminder: Reminder;
  dday?: DdayReminder;
  expanded: boolean;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onSave: (data: {
    medication_name: string;
    dose?: string;
    schedule_times: string[];
    dispensed_date?: string;
    total_days?: number;
    enabled?: boolean;
  }) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    medication_name: r.medication_name,
    dose: r.dose ?? "",
    schedule_times: [...r.schedule_times],
    dispensed_date: r.dispensed_date ?? "",
    total_days: r.total_days?.toString() ?? "",
    enabled: r.enabled,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customHour, setCustomHour] = useState("12");
  const [customMinute, setCustomMinute] = useState("00");

  // editing 모드 진입 시 폼 초기화
  useEffect(() => {
    if (editing) {
      setForm({
        medication_name: r.medication_name,
        dose: r.dose ?? "",
        schedule_times: [...r.schedule_times],
        dispensed_date: r.dispensed_date ?? "",
        total_days: r.total_days?.toString() ?? "",
        enabled: r.enabled,
      });
      setConfirmDelete(false);
      setShowCustomTime(false);
      setCustomHour("12");
      setCustomMinute("00");
    }
  }, [editing, r]);

  const dosagePerOnce = parseDosagePerOnce(r.dose);
  const estimatedRemaining =
    dosagePerOnce != null && r.daily_intake_count != null && r.total_days != null
      ? Math.max(0, dosagePerOnce * r.daily_intake_count * r.total_days - r.confirmed_intake_count * dosagePerOnce)
      : null;
  const maxScheduleTimes =
    r.daily_intake_count != null && Number.isFinite(r.daily_intake_count)
      ? Math.max(1, Math.floor(r.daily_intake_count))
      : null;
  const hasReachedScheduleLimit = maxScheduleTimes != null && form.schedule_times.length >= maxScheduleTimes;

  function toggleTime(time: string) {
    if (!form.schedule_times.includes(time) && hasReachedScheduleLimit) {
      toast.error(`복용 시간은 1일 복용 횟수(${maxScheduleTimes}회)까지만 입력할 수 있어요.`);
      return;
    }
    setForm((f) => ({
      ...f,
      schedule_times: f.schedule_times.includes(time)
        ? f.schedule_times.filter((t) => t !== time)
        : [...f.schedule_times, time].sort(),
    }));
  }

  function handleSubmit() {
    if (!form.medication_name.trim()) {
      toast.error("약물명을 입력해주세요.");
      return;
    }
    if (form.schedule_times.length === 0) {
      toast.error("복용 시간을 하나 이상 선택해주세요.");
      return;
    }
    if (maxScheduleTimes != null && form.schedule_times.length > maxScheduleTimes) {
      toast.error(`복용 시간은 1일 복용 횟수(${maxScheduleTimes}회)를 넘길 수 없어요.`);
      return;
    }
    onSave({
      medication_name: form.medication_name.trim(),
      dose: form.dose.trim() || undefined,
      schedule_times: form.schedule_times,
      dispensed_date: form.dispensed_date || undefined,
      total_days: form.total_days ? parseInt(form.total_days) : undefined,
      enabled: form.enabled,
    });
  }

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
      {expanded && !editing && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-3 mt-4 bg-gray-50 rounded-lg p-3">
            <div className="text-center">
              <p className="text-xs font-medium text-gray-400 mb-1">남은 약 갯수</p>
              <p className="text-sm font-bold text-gray-800">
                {estimatedRemaining != null ? `${estimatedRemaining}정` : "—"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-400 mb-1">상태</p>
              <p className={`text-sm font-bold ${r.enabled ? "text-green-600" : "text-gray-400"}`}>
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

          <div className="grid grid-cols-2 gap-3 mt-3">
            {r.dose && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-400 mb-1.5">용량</p>
                <p className="text-sm font-semibold text-gray-800">{r.dose}</p>
              </div>
            )}
            <div className={`bg-gray-50 rounded-lg p-3 ${!r.dose ? "col-span-2" : ""}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-medium text-gray-400">복용 시간</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.schedule_times.map((t) => (
                  <span
                    key={t}
                    className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {(r.start_date || r.end_date) && (
            <p className="text-xs font-medium text-gray-400 mt-2">
              {r.start_date ?? "—"} ~ {r.end_date ?? "계속"}
            </p>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2 text-xs font-semibold text-green-600 hover:bg-green-100 active:scale-95 transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
            수정
          </button>
        </div>
      )}

      {/* 수정 폼 */}
      {expanded && editing && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <div className="space-y-3 mt-4">
            {/* 약물명 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">약물명</label>
              <input
                type="text"
                value={form.medication_name}
                onChange={(e) => setForm((f) => ({ ...f, medication_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
              />
            </div>

            {/* 용량 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">용량</label>
              <input
                type="text"
                value={form.dose}
                onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))}
                placeholder="예: 10mg"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
              />
            </div>

            {/* 복용 시간 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">복용 시간</label>
              {maxScheduleTimes != null && (
                <p className="text-[11px] text-gray-400 mb-2">
                  1일 복용 횟수 기준 최대 {maxScheduleTimes}개까지 입력할 수 있어요.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleTime(opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      form.schedule_times.includes(opt.value)
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* 직접 입력한 커스텀 시간 표시 */}
              {form.schedule_times.filter((t) => !TIME_OPTIONS.some((o) => o.value === t)).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.schedule_times
                    .filter((t) => !TIME_OPTIONS.some((o) => o.value === t))
                    .map((t) => (
                      <span
                        key={t}
                        className="text-xs px-3 py-1.5 rounded-full font-medium bg-green-500 text-white flex items-center gap-1"
                      >
                        {t}
                        <button type="button" onClick={() => toggleTime(t)} className="hover:text-green-200">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                </div>
              )}
              {/* 커스텀 시간 추가 */}
              {showCustomTime ? (
                <div className="flex items-center gap-2 mt-2">
                  <select
                    value={customHour}
                    onChange={(e) => setCustomHour(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 bg-white"
                  >
                    {HOUR_OPTIONS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}시
                      </option>
                    ))}
                  </select>
                  <select
                    value={customMinute}
                    onChange={(e) => setCustomMinute(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 bg-white"
                  >
                    {MINUTE_OPTIONS.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}분
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (hasReachedScheduleLimit) {
                        toast.error(`복용 시간은 1일 복용 횟수(${maxScheduleTimes}회)까지만 입력할 수 있어요.`);
                        return;
                      }
                      const customTimeValue = `${customHour}:${customMinute}`;
                      if (customTimeValue && !form.schedule_times.includes(customTimeValue)) {
                        setForm((f) => ({
                          ...f,
                          schedule_times: [...f.schedule_times, customTimeValue].sort(),
                        }));
                      }
                      setShowCustomTime(false);
                    }}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    추가
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomTime(false)}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (hasReachedScheduleLimit) {
                      toast.error(`복용 시간은 1일 복용 횟수(${maxScheduleTimes}회)까지만 입력할 수 있어요.`);
                      return;
                    }
                    setShowCustomTime(true);
                  }}
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  직접 입력
                </button>
              )}
            </div>

            {/* 조제일 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">조제일</label>
              <input
                type="date"
                value={form.dispensed_date}
                onChange={(e) => setForm((f) => ({ ...f, dispensed_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
              />
            </div>

            {/* 총 투약 일수 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">총 투약 일수</label>
              <input
                type="number"
                value={form.total_days}
                onChange={(e) => setForm((f) => ({ ...f, total_days: e.target.value }))}
                placeholder="예: 30"
                min={1}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
              />
            </div>

            {/* 복용 상태 토글 */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">복용 상태</label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  form.enabled ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    form.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* 버튼 */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    삭제
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-500">정말 삭제할까요?</span>
                    <button
                      type="button"
                      onClick={onDelete}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      확인
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs font-medium text-gray-400 hover:text-gray-600"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

