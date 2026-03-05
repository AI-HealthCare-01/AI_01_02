import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Mail, Lock, User, Phone } from "lucide-react";
import { authApi } from "../../lib/api";
import { toUserMessage } from "../../lib/errorMessages";

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = "이름을 입력해주세요.";
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "올바른 이메일 형식이 아닙니다.";
    if (formData.password.length < 8) e.password = "비밀번호는 8자 이상이어야 합니다.";
    if (formData.password !== formData.confirmPassword) e.confirmPassword = "비밀번호가 일치하지 않습니다.";
    if (!formData.gender) e.gender = "성별을 선택해주세요.";
    if (!formData.birthYear || !formData.birthMonth || !formData.birthDay) e.birthDate = "생년월일을 입력해주세요.";
    if (!formData.phone.match(/^01[0-9]-?\d{4}-?\d{4}$/)) e.phone = "올바른 휴대폰 번호를 입력해주세요.";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }

    setLoading(true);
    try {
      const month = formData.birthMonth.padStart(2, "0");
      const day = formData.birthDay.padStart(2, "0");
      await authApi.signup({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        gender: formData.gender as "MALE" | "FEMALE",
        birth_date: `${formData.birthYear}-${month}-${day}`,
        phone_number: formData.phone.replace(/-/g, ""),
      });
      navigate("/login");
    } catch (err: unknown) {
      setErrors({ submit: toUserMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full border-2 rounded-xl px-4 py-3 text-[#2D3436] bg-[#FFFCF5] placeholder-[#6c6f72] focus:outline-none focus:ring-2 focus:ring-[#FFD166] transition-colors";

  return (
    <div className="min-h-screen bg-[#FFFCF5] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#2D3436]">Logly</h1>
          <p className="text-[#6c6f72] mt-1">건강한 일상을 위한 첫 걸음</p>
        </div>

        <div className="bg-white border-2 border-[#8A9A5B] p-8 rounded-2xl shadow-sm">
          <h2 className="text-2xl font-bold mb-6 text-[#2D3436]">회원가입</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">이름 <span className="text-red-500">*</span></label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6f72]" />
                <input type="text" value={formData.name} onChange={(e) => handleChange("name", e.target.value)}
                  className={`${inputBase} pl-10 ${errors.name ? "border-red-400" : "border-[#8A9A5B]"}`} placeholder="홍길동" />
              </div>
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">이메일 <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6f72]" />
                <input type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)}
                  className={`${inputBase} pl-10 ${errors.email ? "border-red-400" : "border-[#8A9A5B]"}`} placeholder="email@example.com" />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">비밀번호 <span className="text-red-500">*</span></label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6f72]" />
                <input type="password" value={formData.password} onChange={(e) => handleChange("password", e.target.value)}
                  className={`${inputBase} pl-10 ${errors.password ? "border-red-400" : "border-[#8A9A5B]"}`} placeholder="8자 이상 입력" />
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">비밀번호 확인 <span className="text-red-500">*</span></label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6f72]" />
                <input type="password" value={formData.confirmPassword} onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  className={`${inputBase} pl-10 ${errors.confirmPassword ? "border-red-400" : "border-[#8A9A5B]"}`} placeholder="비밀번호 재입력" />
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">성별 <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                {(["MALE", "FEMALE"] as const).map((g) => (
                  <button key={g} type="button" onClick={() => handleChange("gender", g)}
                    className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      formData.gender === g ? "bg-[#8A9A5B] text-white border-[#8A9A5B]" : "border-gray-200 text-[#6c6f72] hover:border-[#8A9A5B]"
                    }`}>
                    {g === "MALE" ? "남성" : "여성"}
                  </button>
                ))}
              </div>
              {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">생년월일 <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <select
                  value={formData.birthYear}
                  onChange={(e) => handleChange("birthYear", e.target.value)}
                  className={`flex-1 ${inputBase} ${errors.birthDate ? "border-red-400" : "border-[#8A9A5B]"}`}
                >
                  <option value="">년도</option>
                  {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={String(y)}>{y}년</option>
                  ))}
                </select>
                <select
                  value={formData.birthMonth}
                  onChange={(e) => handleChange("birthMonth", e.target.value)}
                  className={`flex-1 ${inputBase} ${errors.birthDate ? "border-red-400" : "border-[#8A9A5B]"}`}
                >
                  <option value="">월</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={String(m)}>{m}월</option>
                  ))}
                </select>
                <select
                  value={formData.birthDay}
                  onChange={(e) => handleChange("birthDay", e.target.value)}
                  className={`flex-1 ${inputBase} ${errors.birthDate ? "border-red-400" : "border-[#8A9A5B]"}`}
                >
                  <option value="">일</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>{d}일</option>
                  ))}
                </select>
              </div>
              {errors.birthDate && <p className="text-red-500 text-xs mt-1">{errors.birthDate}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#2D3436]">휴대폰 번호 <span className="text-red-500">*</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6f72]" />
                <input type="tel" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value)}
                  className={`${inputBase} pl-10 ${errors.phone ? "border-red-400" : "border-[#8A9A5B]"}`} placeholder="'-' 없이 숫자만" />
              </div>
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>

            {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-[#8A9A5B] text-white py-3.5 rounded-xl hover:bg-[#6d7a49] transition-colors disabled:opacity-60 mt-2">
              {loading ? "가입 중..." : "회원가입"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm text-[#6c6f72]">
              이미 계정이 있으신가요?{" "}
              <Link to="/login" className="text-[#8A9A5B] font-medium hover:underline">로그인</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
