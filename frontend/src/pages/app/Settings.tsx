import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { BellRing, Loader2, LogOut, Settings as SettingsIcon, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  authApi,
  clearAllUserData,
  notificationApi,
  type NotificationSettings,
  userApi,
  type UserInfo,
} from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";

type SettingKey = keyof NotificationSettings;

const SETTING_ITEMS: Array<{
  key: SettingKey;
  title: string;
  description: string;
}> = [
  {
    key: "home_schedule_enabled",
    title: "홈 일정 요약",
    description: "홈 화면 일정과 리마인더 요약 알림을 받습니다.",
  },
  {
    key: "medication_alarm_enabled",
    title: "복약 알림",
    description: "등록된 복약 시간에 맞춰 알림을 받습니다.",
  },
  {
    key: "meal_alarm_enabled",
    title: "식사 알림",
    description: "규칙적인 식사 습관을 위한 알림을 받습니다.",
  },
  {
    key: "exercise_alarm_enabled",
    title: "운동 알림",
    description: "운동 루틴을 위한 알림을 받습니다.",
  },
  {
    key: "sleep_alarm_enabled",
    title: "수면 알림",
    description: "권장 취침 시간과 수면 루틴 알림을 받습니다.",
  },
  {
    key: "medication_dday_alarm_enabled",
    title: "약 소진 알림",
    description: "약이 떨어지기 전에 D-day 알림을 받습니다.",
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SettingKey | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [userInfo, notificationSettings] = await Promise.all([
          userApi.me(),
          notificationApi.getSettings(),
        ]);
        setUser(userInfo);
        setSettings(notificationSettings);
      } catch (err) {
        toast.error(toUserMessage(err));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function toggleSetting(key: SettingKey) {
    if (!settings || savingKey) return;

    const previous = settings;
    const nextValue = !settings[key];

    setSavingKey(key);
    setSettings({ ...settings, [key]: nextValue });

    try {
      const updated = await notificationApi.updateSettings({ [key]: nextValue });
      setSettings(updated);
      toast.success("환경설정을 저장했습니다.");
    } catch (err) {
      setSettings(previous);
      toast.error(toUserMessage(err));
    } finally {
      setSavingKey(null);
    }
  }

  function handleLogout() {
    authApi.logout();
    clearAllUserData();
    navigate("/login");
  }

  async function handleWithdraw() {
    setShowWithdrawConfirm(false);
    try {
      await userApi.deleteAccount();
    } catch (err) {
      console.warn("Account deletion request failed:", err);
    }
    clearAllUserData();
    navigate("/login");
  }

  return (
    <div className="min-h-full p-4 md:p-8 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">환경설정</h1>
        <p className="text-sm text-gray-400">알림 수신과 계정 정보를 관리하세요.</p>
      </div>

      {loading ? (
        <div className="card-warm p-8 text-center text-sm text-gray-400">
          <Loader2 className="w-5 h-5 mx-auto mb-3 animate-spin text-green-600" />
          환경설정을 불러오는 중입니다.
        </div>
      ) : (
        <>
          <section className="card-warm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
                <UserRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">계정 정보</h2>
                <p className="text-sm text-gray-400">현재 로그인한 기본 정보를 확인할 수 있습니다.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AccountField label="이름" value={user?.name ?? "-"} />
              <AccountField label="이메일" value={user?.email ?? "-"} />
              <AccountField label="전화번호" value={user?.phone_number ?? "-"} />
              <AccountField label="생년월일" value={user?.birthday ?? "-"} />
            </div>
          </section>

          <section className="card-warm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">알림 설정</h2>
                <p className="text-sm text-gray-400">생활 루틴과 복약 관련 알림을 켜고 끌 수 있습니다.</p>
              </div>
            </div>

            <div className="space-y-3">
              {settings && SETTING_ITEMS.map(({ key, title, description }) => {
                const enabled = settings[key];
                const isSaving = savingKey === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSetting(key)}
                    disabled={Boolean(savingKey && !isSaving)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left transition-all duration-200 hover:border-green-200 hover:bg-green-50/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-800">{title}</p>
                          {isSaving && <span className="text-xs font-medium text-green-600">저장 중...</span>}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</p>
                      </div>
                      <span
                        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                          enabled ? "bg-green-500" : "bg-gray-300"
                        }`}
                        aria-hidden="true"
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            enabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card-warm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">계정 관리</h2>
                <p className="text-sm text-gray-400">로그아웃과 회원탈퇴를 여기서 관리할 수 있습니다.</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50"
              >
                <span className="flex items-center gap-3">
                  <LogOut className="w-4 h-4 text-gray-400" />
                  로그아웃
                </span>
                <span className="text-xs text-gray-400">현재 세션 종료</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWithdrawConfirm(true)}
                className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-700 transition-all duration-200 hover:border-red-300 hover:bg-red-100"
              >
                <span className="flex items-center gap-3">
                  <UserX className="w-4 h-4" />
                  회원탈퇴
                </span>
                <span className="text-xs text-red-400">복구 불가</span>
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white/70 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center">
                <SettingsIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">설정 반영 안내</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  알림 설정 변경은 현재 계정에 바로 반영되며, 주요 기능 탭 구조는 그대로 유지됩니다.
                </p>
              </div>
            </div>
          </section>
        </>
      )}

      {showWithdrawConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl animate-page-enter">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <UserX className="h-5 w-5 text-red-400" />
            </div>
            <h3 className="mb-1 text-base font-bold text-gray-800">정말 회원탈퇴 하시겠습니까?</h3>
            <p className="mb-6 text-sm text-gray-400">
              탈퇴 시 모든 데이터는 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowWithdrawConfirm(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleWithdraw}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                탈퇴하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3">
      <p className="text-xs font-semibold text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-gray-700 break-all">{value}</p>
    </div>
  );
}
