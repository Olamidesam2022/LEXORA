import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@/types/legal";
import { AppRole, ProfileStatus, useAuth } from "@/context/AuthContext";
import { markNotificationsReadByMessage } from "@/lib/notifications";

interface PendingProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: ProfileStatus;
  created_at: string;
}

const toUser = (profile: PendingProfileRow): User => ({
  id: profile.id,
  name: profile.full_name || profile.email,
  email: profile.email,
  role: profile.role,
  status: profile.status,
  department: "Legal",
});

export function usePendingApprovals() {
  const { role } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingUsers = useCallback(async () => {
    if (role !== "managing_partner") {
      setPendingUsers([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,status,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Pending approvals fetch failed:", error);
      setError(error.message);
      setIsLoading(false);
      return;
    }

    console.info("Pending approvals fetched:", data);
    setPendingUsers(((data || []) as PendingProfileRow[]).map(toUser));
    setIsLoading(false);
  }, [role]);

  const updatePendingUser = useCallback(
    async (
      user: User,
      values: { role?: AppRole; status?: ProfileStatus },
    ) => {
      const { error } = await supabase
        .from("profiles")
        .update(values)
        .eq("id", user.id);
      if (error) throw error;

      await markNotificationsReadByMessage(user.email);
      await fetchPendingUsers();
    },
    [fetchPendingUsers],
  );

  useEffect(() => {
    fetchPendingUsers();
  }, [fetchPendingUsers]);

  useEffect(() => {
    if (role !== "managing_partner") return;

    const refresh = () => fetchPendingUsers();
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [fetchPendingUsers, role]);

  return {
    pendingUsers,
    fetchPendingUsers,
    updatePendingUser,
    isLoading,
    error,
  };
}
