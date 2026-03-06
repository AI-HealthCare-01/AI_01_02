import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import { guideApi, ocrApi, reminderApi, GuideJobResult, GuideStatus, OcrMedication } from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";

// ── 아코디언 ──────────────────────────────────────────────────────────────────

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Bell className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 bg-white">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{children}</p>
        </div>
      )}
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

export default function AiGuide() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<GuideStatus | "IDLE">("IDLE");
  const [result, setResult] = useState<GuideJobResult | null>(null);
  const [error, setError] = useState("");
  const [detectedMeds, setDetectedMeds] = useState<OcrMedication[]>([]);
  const [creatingReminders, setCreatingReminders] = useState(false);
  const [remindersDismissed, setRemindersDismissed] = useState(false);

  async function loadDetectedMedications() {
    const ocrJobId = localStorage.getItem("ocr_job_id");
    if (!ocrJobId) return;
    try {
      const ocrResult = await ocrApi.getJobResult(ocrJobId);
      const meds = ocrResult.structured_data?.medications ?? [];
      if (meds.length > 0) {
        const existing = await reminderApi.list();
        const existingNames = new Set(existing.items.map((r) => r.medication_name));
        setDetectedMeds(meds.filter((m) => !existingNames.has(m.drug_name)));
      }
    } catch {
      // OCR 결과 로드 실패 시 무시
    }
  }

  async function createRemindersForMeds() {
    setCreatingReminders(true);
    try {
      await Promise.all(
        detectedMeds.map((med) =>
          reminderApi.create({
            medication_name: med.drug_name,
            schedule_times: ["09:00", "13:00", "19:00"].slice(0, med.frequency_per_day ?? 3),
            total_days: med.total_days ?? undefined,
            daily_intake_count: med.frequency_per_day ?? undefined,
          }),
        ),
      );
      toast.success("리마인더가 설정되었습니다.");
      setDetectedMeds([]);
      navigate("/reminders");
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    } finally {
      setCreatingReminders(false);
    }
  }

  async function loadGuide() {
    const jobId = localStorage.getItem("guide_job_id");
    if (!jobId) {
      setStatus("IDLE");
      return;
    }
    setError("");
    setRemindersDismissed(false);
    try {
      const s = await guideApi.getJobStatus(jobId);
      if (s.status === "SUCCEEDED") {
        const r = await guideApi.getJobResult(jobId);
        setResult(r);
        setStatus("SUCCEEDED");
        loadDetectedMedications();
      } else if (s.status === "FAILED") {
        setStatus("FAILED");
        setError(s.error_message ?? "가이드 생성에 실패했습니다.");
      } else {
        setStatus(s.status);
        pollStatus(jobId);
      }
    } catch {
      setStatus("FAILED");
      setError("가이드를 불러오지 못했습니다.");
    }
  }

  async function pollStatus(jobId: string) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const s = await guideApi.getJobStatus(jobId);
        if (s.status === "SUCCEEDED") {
          const r = await guideApi.getJobResult(jobId);
          setResult(r);
          setStatus("SUCCEEDED");
          loadDetectedMedications();
          return;
        }
        if (s.status === "FAILED") {
          setStatus("FAILED");
          setError(s.error_message ?? "가이드 생성에 실패했습니다.");
          return;
        }
      } catch {
        break;
      }
    }
    setStatus("FAILED");
    setError("가이드 생성 시간이 초과되었습니다.");
  }

  useEffect(() => {
    loadGuide();
  }, []); // eslint-disable-line

  const updatedAt = result?.updated_at
    ? new Date(result.updated_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">AI 가이드</h1>
          <p className="text-sm text-gray-400 mt-0.5">복약 및 생활습관 맞춤 가이드</p>
        </div>
        <button
          onClick={loadGuide}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* IDLE */}
      {status === "IDLE" && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Bell className="w-10 h-10 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">아직 생성된 가이드가 없습니다.</p>
          <p className="text-sm text-gray-400 mt-1">처방전 스캔 후 AI 가이드가 생성됩니다.</p>
        </div>
      )}

      {/* 생성 중 배너 */}
      {(status === "QUEUED" || status === "PROCESSING") && (
        <div className="bg-green-600 text-white rounded-xl px-6 py-5 flex items-center gap-4">
          <Bell className="w-6 h-6 shrink-0 animate-pulse" />
          <div>
            <p className="font-semibold">AI 가이드 생성중</p>
            <p className="text-sm text-green-100 mt-0.5">잠시만 기다려주세요...</p>
          </div>
        </div>
      )}

      {/* FAILED */}
      {status === "FAILED" && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">{error}</p>
          <button
            onClick={loadGuide}
            className="mt-4 px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 생성 완료 */}
      {status === "SUCCEEDED" && result && (
        <div className="space-y-4">
          {/* 완료 배너 */}
          <div className="bg-green-600 text-white rounded-xl px-6 py-5 flex items-center gap-4">
            <Bell className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-semibold">AI 가이드 생성완료</p>
              {updatedAt && (
                <p className="text-sm text-green-100 mt-0.5">최후 업데이트: {updatedAt}</p>
              )}
            </div>
          </div>

          {/* 아코디언 */}
          {result.medication_guidance && (
            <Accordion title="복약 안내">{result.medication_guidance}</Accordion>
          )}
          {result.lifestyle_guidance && (
            <Accordion title="생활 습관 가이드">{result.lifestyle_guidance}</Accordion>
          )}
          {result.safety_notice && (
            <Accordion title="주의사항">{result.safety_notice}</Accordion>
          )}

          {/* 리마인더 설정 제안 (REQ-060) */}
          {detectedMeds.length > 0 && !remindersDismissed && (
            <div className="border border-green-200 rounded-xl p-5 bg-green-50">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-green-600" />
                <p className="text-sm font-semibold text-green-700">복약 리마인더 설정</p>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                감지된 약물에 대해 복약 리마인더를 자동으로 설정할 수 있습니다.
              </p>
              <ul className="space-y-1 mb-4">
                {detectedMeds.map((med, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full shrink-0" />
                    {med.drug_name}
                    {med.frequency_per_day && (
                      <span className="text-xs text-gray-400">
                        (1일 {med.frequency_per_day}회)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={() => setRemindersDismissed(true)}
                  className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-500 rounded-lg hover:bg-white transition-colors"
                >
                  나중에
                </button>
                <button
                  onClick={createRemindersForMeds}
                  disabled={creatingReminders}
                  className="flex-1 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {creatingReminders ? "설정중..." : "리마인더 설정"}
                </button>
              </div>
            </div>
          )}

          {/* 참고 자료 */}
          {result.source_references?.length > 0 && (
            <div className="border border-gray-100 rounded-xl p-4 bg-white">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">참고 자료</p>
              <ul className="space-y-1">
                {result.source_references.map((ref, i) => (
                  <li key={i} className="text-xs text-gray-500">
                    {ref.title} — <span className="text-gray-400">{ref.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center pt-2">
            본 가이드는 참고용 정보이며, 의료진의 진료 및 처방을 대체하지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}
