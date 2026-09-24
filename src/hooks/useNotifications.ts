import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  markNotificationRead,
  NOTIFICATIONS_REFRESH_EVENT,
} from "@/lib/notifications";

export interface AppNotification {
  id: string;
  type: "urgent" | "info" | "warning";
  message: string;
  user_id: string;
  read: boolean;
  created_at: string;
  kind?: "stored" | "pending_approval";
}

interface PendingApprovalProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: "operations_manager" | "managing_partner" | "legal_officer";
  created_at: string;
}

const PENDING_APPROVAL_ID_PREFIX = "pending-approval:";

export function useNotifications() {
  const { user, isApproved, role } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!user || !isApproved) {
      setNotifications([]);
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,message,user_id,read,created_at")
      .eq("read", false)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const storedNotifications = ((data || []) as AppNotification[]).map(
      (notification) => ({ ...notification, kind: "stored" as const }),
    );

    if (role !== "managing_partner") {
      setNotifications(storedNotifications);
      return;
    }

    const { data: pendingProfiles, error: pendingError } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (pendingError) {
      console.error("Pending approval notifications fetch failed:", pendingError);
      setNotifications(storedNotifications);
      return;
    }

    const pendingApprovalNotifications = (
      (pendingProfiles || []) as PendingApprovalProfile[]
    )
      .filter(
        (profile) =>
          !storedNotifications.some((notification) =>
            notification.message.includes(profile.email),
          ),
      )
      .map<AppNotification>((profile) => ({
        id: `${PENDING_APPROVAL_ID_PREFIX}${profile.id}`,
        type: "info",
        message: `New user awaiting approval: ${
          profile.full_name || profile.email
        } (${profile.email})`,
        user_id: user.id,
        read: false,
        created_at: profile.created_at,
        kind: "pending_approval",
      }));

    setNotifications(
      [...pendingApprovalNotifications, ...storedNotifications].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    );
  }, [isApproved, role, user]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (id.startsWith(PENDING_APPROVAL_ID_PREFIX)) return;

      await markNotificationRead(id);
      setNotifications((current) =>
        current.filter((notification) => notification.id !== id),
      );
    },
    [],
  );

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications
      .filter(
        (notification) =>
          !notification.read &&
          !notification.id.startsWith(PENDING_APPROVAL_ID_PREFIX),
      )
      .map((notification) => notification.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds);

    if (error) throw error;
    setNotifications([]);
    window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
  }, [fetchNotifications, notifications]);

  useEffect(() => {
    fetchNotifications().catch(console.error);
  }, [fetchNotifications]);

  useEffect(() => {
    const refreshNotifications = () => {
      fetchNotifications().catch(console.error);
    };

    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, refreshNotifications);

    return () => {
      window.removeEventListener(
        NOTIFICATIONS_REFRESH_EVENT,
        refreshNotifications,
      );
    };
  }, [fetchNotifications]);

  return { notifications, fetchNotifications, markAsRead, markAllAsRead };
}
