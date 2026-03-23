import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Bell, BellOff, Clock, Calendar } from "lucide-react";
import { toast } from "sonner";
import { reminderApi, Reminder, DdayReminder } from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";

export default function RemindersTab() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [dday, setDday] = useState<DdayReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      const [r, d] = await Promise.all([reminderApi.list(), reminderApi.getDday(30)]);
      setReminders(r.items);
      setDday(d.items);
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function toggleEnabled(r: Reminder) {
    try {
      const updated = await reminderApi.update(r.id, {
        medication_name: r.medication_name,
        dose: r.dose ?? undefined,
        schedule_times: r.schedule_times,
        start_date: r.start_date ?? undefined,
        end_date: r.end_date ?? undefined,
        enabled: !r.enabled,
      });
      setReminders((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
    } catch (err) {
      toast.error(toUserMessage(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await reminderApi.delete(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
      toast.success("알람이 삭제되었습니다.");
    } catch (err) {
      toast.error(toUserMessage(err));
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 gradient-primary text-white text-sm rounded-xl font-bold hover:shadow-lg transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          알람 추가
        </button>
      </div>

      {/* D-day warnings */}
      {dday.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            30일 내 소진 예정
          </p>
          <div className="space-y-2">
            {dday.map((d) => (
              <div
                key={d.medication_name}
                className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-800">{d.medication_name}</span>
                </div>
                <span className="text-xs text-amber-600 font-medium">
                  {d.remaining_days}일 남음 ({d.estimated_depletion_date})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">등록된 알람이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {reminders.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-4 bg-white/80 rounded-xl px-4 py-4 shadow-sm ${
                r.enabled ? "" : "opacity-50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{r.medication_name}</p>
                {r.dose && <p className="text-xs text-gray-400 mt-0.5">용량: {r.dose}</p>}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {r.schedule_times.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                    >
                      <Clock className="w-3 h-3" />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleEnabled(r)}
                  className={`p-1.5 rounded-lg transition-all duration-200 ${
                    r.enabled ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"
                  }`}
                >
                  {r.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && createPortal(
        <ReminderForm onClose={() => setShowForm(false)} onSaved={load} />,
        document.body,
      )}
    </div>
  );
}

function ReminderForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [times, setTimes] = useState(["08:00"]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  function addTime() { setTimes((t) => [...t, "12:00"]); }
  function setTime(i: number, v: string) { setTimes((t) => t.map((x, j) => (j === i ? v : x))); }
  function removeTime(i: number) { setTimes((t) => t.filter((_, j) => j !== i)); }

  async function handleSave() {
    if (!name.trim()) { toast.error("약 이름을 입력하세요."); return; }
    setLoading(true);
    try {
      await reminderApi.create({
        medication_name: name,
        dose: dose || undefined,
        schedule_times: times,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      toast.success("알람이 추가되었습니다.");
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

  return (
    <div className="fixed inset-0 bg-black/25 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-page-enter">
        <h3 className="text-base font-bold text-gray-800 mb-5">알람 추가</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">약 이름</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="약 이름" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">용량 (선택)</label>
            <input type="text" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="예: 1정" className={inputCls} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">복약 시간</label>
              <button type="button" onClick={addTime} className="text-xs text-green-600 hover:underline">+ 추가</button>
            </div>
            {times.map((t, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="time" value={t} onChange={(e) => setTime(i, e.target.value)} className={inputCls} />
                {times.length > 1 && (
                  <button type="button" onClick={() => removeTime(i)} className="text-gray-300 hover:text-red-400 px-2">×</button>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">시작일</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">종료일</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200">취소</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 text-sm font-bold gradient-primary text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-60">
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
