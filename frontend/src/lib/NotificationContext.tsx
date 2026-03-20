import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { notificationApi, getToken, isAuthRoute } from "@/lib/api";

interface NotificationContextValue {
  unreadCount: number;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refresh: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedRef = useRef(false);
  const paused = isAuthRoute(location.pathname);

  const refresh = useCallback(() => {
    if (paused || !getToken()) return;
    notificationApi
      .list({ limit: 20 })
      .then((r) => {
        setUnreadCount(r.unread_count);

        const incomingIds = new Set(r.items.map((item) => item.id));
        if (hasLoadedRef.current) {
          const newMedicationReminders = r.items.filter((item) => {
            if (knownNotificationIdsRef.current.has(item.id)) return false;
            return item.payload?.event === "medication_reminder";
          });

          for (const notification of newMedicationReminders) {
            toast(notification.title, {
              description: notification.message,
            });
          }
        }

        knownNotificationIdsRef.current = incomingIds;
        hasLoadedRef.current = true;
      })
      .catch(() => {});
  }, [paused]);

  useEffect(() => {
    if (paused) {
      setUnreadCount(0);
      knownNotificationIdsRef.current = new Set();
      hasLoadedRef.current = false;
      return;
    }

    refresh();
    const id = setInterval(refresh, 60000);
    return () => clearInterval(id);
  }, [paused, refresh]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext);
}
