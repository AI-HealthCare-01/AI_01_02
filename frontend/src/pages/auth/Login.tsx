import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { authApi, profileApi, setToken, clearPreviousUserData } from "@/lib/api";
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
      clearPreviousUserData(email);
      try {
        await profileApi.getHealth();
        navigate("/");
      } catch (profileErr: unknown) {
        const msg = profileErr instanceof Error ? profileErr.message : "";
        if (msg.includes("RESOURCE_NOT_FOUND") || msg.includes("HTTP 404")) {
          navigate("/onboarding");
        } else {
          toast.error("프로필 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.");
          navigate("/");
        }
      }
    } catch (err: unknown) {
      toast.error(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-warm-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Organic decorative blobs */}
      <div className="absolute top-[-8%] right-[-6%] w-80 h-80 bg-green-200/30 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-[-12%] left-[-8%] w-96 h-96 bg-amber-100/25 rounded-full blur-3xl" />
      <div className="absolute top-[40%] left-[10%] w-40 h-40 bg-green-100/20 blob-decoration blur-2xl" />

      <div className="w-full max-w-sm relative z-10 animate-page-enter">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-green-600 tracking-tight">
            logly
          </h1>
          <p className="text-gray-400 text-sm mt-2 font-medium">AI 기반 복약 관리 서비스</p>
        </div>

        <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-lg p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-6">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@example.com"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="********"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400 transition-all duration-200"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-white py-2.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all duration-200 disabled:opacity-60 mt-2"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            계정이 없으신가요?{" "}
            <Link to="/signup" className="text-green-600 font-semibold hover:text-green-700 transition-colors">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
