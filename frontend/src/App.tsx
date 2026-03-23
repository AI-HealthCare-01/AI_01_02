import { lazy, Suspense, Component, type ReactNode, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Toaster } from "sonner";
import { NotificationProvider } from "@/lib/NotificationContext";
import AppLayout from "./components/layout/AppLayout";
import { getToken, profileApi } from "./lib/api";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const OnboardingBasicInfo = lazy(() => import("./pages/onboarding/BasicInfo"));
const OnboardingLifestyle = lazy(() => import("./pages/onboarding/Lifestyle"));
const OnboardingSleep = lazy(() => import("./pages/onboarding/Sleep"));
const OcrScan = lazy(() => import("./pages/onboarding/OcrScan"));
const OcrResult = lazy(() => import("./pages/onboarding/OcrResult"));
const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const AiGuide = lazy(() => import("./pages/app/AiGuide"));
const Chat = lazy(() => import("./pages/app/Chat"));
const Medications = lazy(() => import("./pages/app/Medications"));
const Records = lazy(() => import("./pages/app/Records"));
const Settings = lazy(() => import("./pages/app/Settings"));
const Contact = lazy(() => import("./pages/app/Contact"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "done" | "needed">("loading");

  useEffect(() => {
    profileApi.getHealth()
      .then(() => setStatus("done"))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("RESOURCE_NOT_FOUND") || msg.includes("HTTP 404")) {
          setStatus("needed");
        } else {
          setStatus("done");
        }
      });
  }, []);

  if (status === "loading") return <PageSpinner />;
  if (status === "needed") return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
    </div>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <p className="text-lg font-bold text-gray-800 mb-2">문제가 발생했습니다</p>
          <p className="text-sm text-gray-500 mb-4">{this.state.error?.message}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = "/";
            }}
            className="px-5 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
      <Toaster position="top-center" richColors />
      <ErrorBoundary>
      <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingBasicInfo />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding/lifestyle"
          element={
            <RequireAuth>
              <OnboardingLifestyle />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding/sleep"
          element={
            <RequireAuth>
              <OnboardingSleep />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding/scan"
          element={
            <RequireAuth>
              <OcrScan />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding/scan-result"
          element={
            <RequireAuth>
              <OcrResult />
            </RequireAuth>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppLayout />
              </RequireOnboarding>
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="ai-guide" element={<AiGuide />} />
          <Route path="chat" element={<Chat />} />
          <Route path="medications" element={<Medications />} />
          <Route path="records" element={<Records />} />
          <Route path="settings" element={<Settings />} />
          <Route path="contact" element={<Contact />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
      </NotificationProvider>
    </BrowserRouter>
  );
}
