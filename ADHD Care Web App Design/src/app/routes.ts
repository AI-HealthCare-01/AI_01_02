import { createBrowserRouter } from "react-router";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import OcrScan from "./pages/OcrScan";
import MyMedications from "./pages/MyMedications";
import AiCoach from "./pages/AiCoach";
import Chatbot from "./pages/Chatbot";
import Notifications from "./pages/Notifications";
import Records from "./pages/Records";
import Layout from "./components/Layout";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/onboarding",
    Component: Onboarding,
  },
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "ocr-scan", Component: OcrScan },
      { path: "medications", Component: MyMedications },
      { path: "ai-coach", Component: AiCoach },
      { path: "chat", Component: Chatbot },
      { path: "notifications", Component: Notifications },
      { path: "records", Component: Records },
    ],
  },
]);
