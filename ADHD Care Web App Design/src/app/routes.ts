import { createBrowserRouter } from "react-router";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import OcrScan from "./pages/OcrScan";
import MyMedications from "./pages/MyMedications";
import AiGuide from "./pages/AiGuide";
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
      { path: "ai-guide", Component: AiGuide },
      { path: "chatbot", Component: Chatbot },
      { path: "notifications", Component: Notifications },
      { path: "medications", Component: MyMedications },
      { path: "records", Component: Records },
    ],
  },
]);
