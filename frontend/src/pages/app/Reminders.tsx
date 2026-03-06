import { useState } from "react";
import NotificationsTab from "./reminders/NotificationsTab";
import RemindersTab from "./reminders/RemindersTab";

type Tab = "notifications" | "reminders";

export default function Reminders() {
  const [tab, setTab] = useState<Tab>("notifications");

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">알람 관리</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {(
          [
            { key: "notifications", label: "알림" },
            { key: "reminders", label: "리마인더" },
          ] as { key: Tab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? "bg-white text-gray-800 shadow-sm font-bold"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "notifications" ? <NotificationsTab /> : <RemindersTab />}
    </div>
  );
}
