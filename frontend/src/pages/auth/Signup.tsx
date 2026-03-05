import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { authApi, setToken } from "@/lib/api";
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

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      navigate("/onboarding");
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-600 tracking-tight">logly</h1>
          <p className="text-gray-400 text-sm mt-1">회원가입</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
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
                placeholder="8자 이상"
                minLength={8}
                className={inputCls}
              />
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
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      form.gender === g
                        ? "bg-green-600 text-white border-green-600"
                        : "border-gray-200 text-gray-500 hover:border-green-400"
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
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  className="w-20 border border-gray-200 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  className="w-20 border border-gray-200 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
              className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? "가입 중..." : "회원가입"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            이미 계정이 있으신가요?{" "}
            <Link to="/login" className="text-green-600 font-medium hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
