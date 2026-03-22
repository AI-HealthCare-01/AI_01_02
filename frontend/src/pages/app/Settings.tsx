import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, FileText, LockKeyhole, LogOut, ShieldCheck, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";
import { authApi, clearAllUserData, userApi } from "@/lib/api";
import type { UserInfo } from "@/lib/api";
import { useNavigate } from "react-router";

const APP_VERSION = "v0.1.0";

type PolicyType = "terms" | "privacy" | null;

export default function Settings() {
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyType>(null);
  const [accountInfo, setAccountInfo] = useState<UserInfo | null>(null);
  const [accountInfoLoading, setAccountInfoLoading] = useState(false);
  const [alertSettings] = useState({
    medication: true,
    guide: true,
  });

  useEffect(() => {
    if (!accountOpen || accountInfo || accountInfoLoading) return;

    let cancelled = false;

    async function loadAccountInfo() {
      setAccountInfoLoading(true);
      try {
        const profile = await userApi.me();
        if (!cancelled) {
          setAccountInfo(profile);
        }
      } catch (err) {
        console.warn("Failed to load account info:", err);
        if (!cancelled) {
          toast.error("계정 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setAccountInfoLoading(false);
        }
      }
    }

    void loadAccountInfo();

    return () => {
      cancelled = true;
    };
  }, [accountOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLogout() {
    authApi.logout();
    clearAllUserData();
    navigate("/login");
  }

  async function handleWithdraw() {
    try {
      await userApi.deleteAccount();
    } catch (err) {
      console.warn("Account deletion request failed:", err);
      toast.error("회원 탈퇴 처리에 실패했습니다. 다시 시도해 주세요.");
      return;
    }
    clearAllUserData();
    navigate("/login");
  }

  return (
    <>
      <div className="min-h-full max-w-3xl mx-auto p-4 md:p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">환경설정</h1>
          <p className="mt-1 text-sm text-gray-400">사용자 계정과 서비스 설정을 한 곳에서 관리할 수 있습니다.</p>
        </div>

        <SettingSection
          title="계정"
          description="가입한 이메일과 전화번호, 계정 관련 기능을 확인할 수 있습니다."
          icon={<UserRound className="w-4 h-4" />}
          collapsible
          open={accountOpen}
          onToggle={() => setAccountOpen((prev) => !prev)}
        >
          <AccountInfoCard
            loading={accountInfoLoading}
            email={accountInfo?.email ?? ""}
            phoneNumber={accountInfo?.phone_number ?? ""}
          />
          <ActionRow
            title="로그아웃"
            description="현재 계정에서 로그아웃합니다."
            icon={<LogOut className="w-4 h-4" />}
            onClick={handleLogout}
            accent="default"
          />
          <ActionRow
            title="회원탈퇴"
            description="계정 비활성화와 서비스 탈퇴를 진행합니다."
            icon={<UserX className="w-4 h-4" />}
            onClick={() => setShowWithdraw(true)}
            accent="danger"
          />
        </SettingSection>

        <SettingSection
          title="서비스"
          description="서비스 버전과 정책 문서를 확인할 수 있습니다."
          icon={<FileText className="w-4 h-4" />}
        >
          <InfoRow
            title="버전 정보"
            description="현재 앱 버전"
            value={APP_VERSION}
            icon={<ShieldCheck className="w-4 h-4" />}
          />
          <ActionRow
            title="이용약관"
            description="서비스 이용 조건과 약관을 확인합니다."
            icon={<FileText className="w-4 h-4" />}
            onClick={() => setSelectedPolicy("terms")}
            accent="default"
          />
          <ActionRow
            title="개인정보 처리방침"
            description="개인정보 수집 및 이용 방침을 확인합니다."
            icon={<LockKeyhole className="w-4 h-4" />}
            onClick={() => setSelectedPolicy("privacy")}
            accent="default"
          />
        </SettingSection>

        <SettingSection
          title="알림"
          description="서비스 알림 수신 여부를 설정할 수 있습니다."
          icon={<ShieldCheck className="w-4 h-4" />}
        >
          <ToggleRow
            title="복약 알림"
            description="복약 시간과 확인 알림을 받습니다."
            checked={alertSettings.medication}
            disabled
          />
          <ToggleRow
            title="가이드 알림"
            description="AI 가이드 업데이트와 안내 알림을 받습니다."
            checked={alertSettings.guide}
            disabled
          />
          <p className="px-5 pb-4 text-xs text-gray-400">알림 설정 기능은 준비 중입니다.</p>
        </SettingSection>
      </div>

      {selectedPolicy && (
        <PolicyModal type={selectedPolicy} onClose={() => setSelectedPolicy(null)} />
      )}

      {showWithdraw && (
        <WithdrawModal
          onClose={() => setShowWithdraw(false)}
          onConfirm={handleWithdraw}
        />
      )}
    </>
  );
}

function SettingSection({
  title,
  description,
  icon,
  children,
  collapsible = false,
  open = true,
  onToggle,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <section className="card-warm overflow-hidden">
      <button
        type="button"
        onClick={collapsible ? onToggle : undefined}
        className={`flex w-full items-center justify-between px-5 py-4 text-left ${collapsible ? "transition-colors hover:bg-gray-50/70" : "cursor-default"}`}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-green-600">
            {icon}
          </span>
          <div>
            <h2 className="text-base font-bold text-gray-800">{title}</h2>
            <p className="mt-0.5 text-xs text-gray-400">{description}</p>
          </div>
        </div>
        {collapsible ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="divide-y divide-gray-100 border-t border-gray-100">{children}</div>
      ) : null}
    </section>
  );
}

function AccountInfoCard({
  loading,
  email,
  phoneNumber,
}: {
  loading: boolean;
  email: string;
  phoneNumber: string;
}) {
  return (
    <div className="px-5 py-4">
      <div className="rounded-2xl border border-green-100 bg-green-50/60 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">가입 정보</p>
        {loading ? (
          <p className="mt-3 text-sm text-gray-500">계정 정보를 불러오는 중입니다.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <AccountInfoRow label="이메일" value={email || "-"} />
            <AccountInfoRow label="전화번호" value={phoneNumber || "-"} />
          </div>
        )}
      </div>
    </div>
  );
}

function AccountInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/85 px-3.5 py-3">
      <span className="text-xs font-semibold text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-700">{value}</span>
    </div>
  );
}

function ActionRow({
  title,
  description,
  icon,
  onClick,
  accent,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  accent: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
    >
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent === "danger" ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-500"}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${accent === "danger" ? "text-red-500" : "text-gray-700"}`}>{title}</p>
        <p className="mt-0.5 text-xs text-gray-400">{description}</p>
      </div>
      <ChevronRight className={`h-4 w-4 shrink-0 ${accent === "danger" ? "text-red-300" : "text-gray-300"}`} />
    </button>
  );
}

function InfoRow({
  title,
  description,
  value,
  icon,
}: {
  title: string;
  description: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <p className="mt-0.5 text-xs text-gray-400">{description}</p>
      </div>
      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{value}</span>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onToggle,
  disabled = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-5 py-4 ${disabled ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <p className="mt-0.5 text-xs text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
          checked ? "bg-green-500" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function PolicyModal({ type, onClose }: { type: Exclude<PolicyType, null>; onClose: () => void }) {
  const isTerms = type === "terms";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-bold text-gray-800">{isTerms ? "이용약관" : "개인정보 처리방침"}</h3>
          <p className="mt-1 text-xs text-gray-400">
            {isTerms ? "서비스 이용 전반에 대한 기본 정책입니다." : "개인정보 수집 및 이용에 대한 안내입니다."}
          </p>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-5 text-sm leading-7 text-gray-600">
          {isTerms ? (
            <>
              <p>본 서비스는 복약 관리 및 건강 가이드 확인을 돕기 위한 디지털 헬스케어 서비스입니다.</p>
              <p>회원은 정확한 건강 정보를 입력하고, 서비스 이용 시 제공되는 안내를 참고용으로 활용해야 합니다.</p>
              <p>의료적 판단이 필요한 경우 반드시 의료 전문가의 진료와 상담을 우선해야 합니다.</p>
            </>
          ) : (
            <>
              <p>서비스는 복약 일정, 건강 프로필, AI 가이드 제공을 위해 필요한 최소한의 정보를 처리합니다.</p>
              <p>입력된 건강 정보는 서비스 제공과 기능 개선을 위해 사용되며, 관련 법령에 따라 보호됩니다.</p>
              <p>사용자는 언제든지 계정 설정에서 로그아웃 또는 회원탈퇴를 통해 이용을 종료할 수 있습니다.</p>
            </>
          )}
        </div>
        <div className="border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function WithdrawModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <UserX className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="mb-1 text-base font-bold text-gray-800">회원 탈퇴</h3>
        <p className="mb-6 text-sm text-gray-400">
          탈퇴 시 모든 데이터가 비활성화됩니다.
          <br />
          정말 탈퇴하시겠습니까?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
          >
            탈퇴하기
          </button>
        </div>
      </div>
    </div>
  );
}
