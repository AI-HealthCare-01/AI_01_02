import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { authApi, profileApi, setToken } from "@/lib/api";
import { toUserMessage } from "@/lib/errorMessages";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { access_token } = await authApi.login(email, password);
      setToken(access_token);
      try {
        await profileApi.getHealth();
        navigate("/");
      } catch {
        navigate("/onboarding");
      }
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-green-600 tracking-tight">logly</h1>
          <p className="text-gray-400 text-sm mt-2">AI 기반 복약 관리 서비스</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            계정이 없으신가요?{" "}
            <Link to="/signup" className="text-green-600 font-medium hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
