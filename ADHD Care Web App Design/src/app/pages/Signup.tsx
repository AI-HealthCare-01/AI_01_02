import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Mail, Lock, User, Phone, CalendarDays } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    gender: "",
    birthDate: "",
    phoneNumber: "",
    nickname: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock signup payload
    const payload = {
      email: formData.email,
      password: formData.password,
      name: formData.name,
      gender: formData.gender,
      birth_date: formData.birthDate,
      phone_number: formData.phoneNumber.replaceAll("-", ""),
      nickname: formData.nickname || undefined,
    };
    console.log("signup payload", payload);
    navigate("/onboarding");
  };

  return (
    <div className="min-h-screen bg-[#FFFCF5] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-[#2D3436]">ADHD Care</h1>
          <p className="text-[#6c6f72]">건강한 일상을 위한 첫 걸음</p>
        </div>

        <div className="bg-[#20B2AA] text-white p-8 rounded-2xl">
          <h2 className="text-2xl font-bold mb-6">회원가입</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">이름</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FFFCF5] opacity-60" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#1a8f89] border border-[#1a8f89] rounded-lg pl-10 pr-4 py-3 text-white placeholder-[#FFFCF5] placeholder-opacity-50 focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                  placeholder="홍길동"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">닉네임 (선택)</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FFFCF5] opacity-60" />
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  className="w-full bg-[#1a8f89] border border-[#1a8f89] rounded-lg pl-10 pr-4 py-3 text-white placeholder-[#FFFCF5] placeholder-opacity-50 focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                  placeholder="민수"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FFFCF5] opacity-60" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[#1a8f89] border border-[#1a8f89] rounded-lg pl-10 pr-4 py-3 text-white placeholder-[#FFFCF5] placeholder-opacity-50 focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                  placeholder="email@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FFFCF5] opacity-60" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-[#1a8f89] border border-[#1a8f89] rounded-lg pl-10 pr-4 py-3 text-white placeholder-[#FFFCF5] placeholder-opacity-50 focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                  placeholder="8자 이상"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">성별</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full bg-[#1a8f89] border border-[#1a8f89] rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                  required
                >
                  <option value="" className="text-[#2D3436]">
                    선택
                  </option>
                  <option value="MALE" className="text-[#2D3436]">
                    남성 (MALE)
                  </option>
                  <option value="FEMALE" className="text-[#2D3436]">
                    여성 (FEMALE)
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">생년월일</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FFFCF5] opacity-60" />
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full bg-[#1a8f89] border border-[#1a8f89] rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">전화번호</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FFFCF5] opacity-60" />
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full bg-[#1a8f89] border border-[#1a8f89] rounded-lg pl-10 pr-4 py-3 text-white placeholder-[#FFFCF5] placeholder-opacity-50 focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                  placeholder="010-1234-5678"
                  pattern="^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#FFD166] text-[#2D3436] font-medium py-3 rounded-lg hover:bg-[#ffc84d] transition-colors"
            >
              계속하기
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#FFFCF5] opacity-80">
              이미 계정이 있으신가요?{" "}
              <Link to="/login" className="text-white font-medium hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
