import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { authApi, setToken, clearPreviousUserData } from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";
import { toast } from "sonner";

const YEARS = Array.from({ length: 80 }, (_, i) => 2005 - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    name: "",
    gender: "" as "MALE" | "FEMALE" | "",
    phone_number: "",
  });
  const [birth, setBirth] = useState({ year: "", month: "", day: "" });
  const [loading, setLoading] = useState(false);

  const pwRules = [
    { label: "8자 이상", ok: form.password.length >= 8 },
    { label: "128자 이하", ok: form.password.length <= 128 },
    { label: "영문 포함", ok: /[a-zA-Z]/.test(form.password) },
    { label: "숫자 포함", ok: /[0-9]/.test(form.password) },
    { label: "특수문자 포함", ok: /[^a-zA-Z0-9]/.test(form.password) },
  ];
  const pwAllValid = pwRules.every((r) => r.ok);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pwAllValid) {
      toast.error("비밀번호 조건을 모두 충족해주세요.");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!form.gender) {
      toast.error("성별을 선택해주세요.");
      return;
    }
    if (!birth.year || !birth.month || !birth.day) {
      toast.error("생년월일을 입력해주세요.");
      return;
    }
    const birth_date = `${birth.year}-${String(birth.month).padStart(2, "0")}-${String(birth.day).padStart(2, "0")}`;
    setLoading(true);
    try {
      await authApi.signup({
        email: form.email,
        password: form.password,
        name: form.name,
        gender: form.gender as "MALE" | "FEMALE",
        birth_date,
        phone_number: form.phone_number,
      });
      const { access_token } = await authApi.login(form.email, form.password);
      setToken(access_token);
      clearPreviousUserData(form.email);
      navigate("/onboarding");
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400 transition-all duration-200";
  const labelCls = "block text-sm font-semibold text-gray-600 mb-1.5";

  return (
    <div className="min-h-screen gradient-warm-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Organic decorative blobs */}
      <div className="absolute top-[-6%] left-[-5%] w-72 h-72 bg-green-200/25 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-6%] w-80 h-80 bg-amber-100/20 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10 animate-page-enter">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-green-600 tracking-tight">logly</h1>
          <p className="text-gray-400 text-sm mt-1 font-medium">회원가입</p>
        </div>

        <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>이름</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
                placeholder="홍길동"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
                placeholder="email@example.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>전화번호</label>
              <input
                type="tel"
                value={form.phone_number}
                onChange={(e) => set("phone_number", e.target.value)}
                required
                placeholder="010-0000-0000"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>비밀번호</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required
                placeholder="영문, 숫자, 특수문자 포함 8자 이상"
                minLength={8}
                className={inputCls}
              />
              {form.password.length > 0 && (
                <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {pwRules.map((r) => (
                    <li
                      key={r.label}
                      className={`text-xs flex items-center gap-1 transition-colors duration-200 ${
                        r.ok ? "text-green-500" : "text-gray-400"
                      }`}
                    >
                      <span className="text-[10px]">{r.ok ? "\u2714" : "\u25CB"}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className={labelCls}>비밀번호 확인</label>
              <input
                type="password"
                value={form.passwordConfirm}
                onChange={(e) => set("passwordConfirm", e.target.value)}
                required
                placeholder="비밀번호 재입력"
                className={inputCls}
              />
            </div>

            {/* Gender */}
            <div>
              <label className={labelCls}>성별</label>
              <div className="flex gap-3">
                {(["MALE", "FEMALE"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set("gender", g)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                      form.gender === g
                        ? "gradient-primary text-white border-transparent shadow-sm"
                        : "border-gray-200 text-gray-500 hover:border-green-300 bg-white/70"
                    }`}
                  >
                    {g === "MALE" ? "남성" : "여성"}
                  </button>
                ))}
              </div>
            </div>

            {/* Birth date */}
            <div>
              <label className={labelCls}>생년월일</label>
              <div className="flex gap-2">
                <select
                  value={birth.year}
                  onChange={(e) => setBirth((b) => ({ ...b, year: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-xl px-2 py-2.5 text-sm bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400/50"
                >
                  <option value="">년도</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  value={birth.month}
                  onChange={(e) => setBirth((b) => ({ ...b, month: e.target.value }))}
                  className="w-20 border border-gray-200 rounded-xl px-2 py-2.5 text-sm bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400/50"
                >
                  <option value="">월</option>
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}월
                    </option>
                  ))}
                </select>
                <select
                  value={birth.day}
                  onChange={(e) => setBirth((b) => ({ ...b, day: e.target.value }))}
                  className="w-20 border border-gray-200 rounded-xl px-2 py-2.5 text-sm bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400/50"
                >
                  <option value="">일</option>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}일
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-white py-2.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all duration-200 disabled:opacity-60 mt-2"
            >
              {loading ? "가입 중..." : "회원가입"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            이미 계정이 있으신가요?{" "}
            <Link to="/login" className="text-green-600 font-semibold hover:text-green-700 transition-colors">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
