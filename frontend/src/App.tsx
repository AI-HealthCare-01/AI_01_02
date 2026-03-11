import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Toaster } from "sonner";
import { NotificationProvider } from "@/lib/NotificationContext";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import OnboardingBasicInfo from "./pages/onboarding/BasicInfo";
import OnboardingLifestyle from "./pages/onboarding/Lifestyle";
import OnboardingSleep from "./pages/onboarding/Sleep";
import OcrScan from "./pages/onboarding/OcrScan";
import OcrResult from "./pages/onboarding/OcrResult";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import AiGuide from "./pages/app/AiGuide";
import Chat from "./pages/app/Chat";
import Medications from "./pages/app/Medications";
import Records from "./pages/app/Records";
import { getToken } from "./lib/api";

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
      <Toaster position="top-center" richColors />
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
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="ai-guide" element={<AiGuide />} />
          <Route path="chat" element={<Chat />} />
          <Route path="medications" element={<Medications />} />
          <Route path="records" element={<Records />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
}
