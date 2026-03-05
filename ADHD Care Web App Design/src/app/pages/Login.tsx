import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Mail, Lock } from "lucide-react";
import { authApi, setToken } from "../../lib/api";
import { toUserMessage } from "../../lib/errorMessages";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await authApi.login(email, password);
      setToken(access_token);
      navigate("/");
    } catch (err: unknown) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFCF5] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-[#2D3436]">Logly</h1>
          <p className="text-[#6c6f72]">복약 관리를 더 쉽게</p>
        </div>

        <div className="bg-[#8A9A5B] text-white p-8 rounded-2xl">
          <h2 className="text-2xl font-bold mb-6">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FFFCF5] opacity-60" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#6d7a49] border border-[#6d7a49] rounded-lg pl-10 pr-4 py-3 text-white placeholder-[#FFFCF5] placeholder-opacity-50 focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#6d7a49] border border-[#6d7a49] rounded-lg pl-10 pr-4 py-3 text-white placeholder-[#FFFCF5] placeholder-opacity-50 focus:outline-none focus:ring-2 focus:ring-[#FFD166]"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && <p className="text-[#FFD166] text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FFD166] text-[#2D3436] font-medium py-3 rounded-lg hover:bg-[#ffc84d] transition-colors disabled:opacity-60"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#FFFCF5] opacity-80">
              계정이 없으신가요?{" "}
              <Link to="/signup" className="text-white font-medium hover:underline">
                회원가입
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
