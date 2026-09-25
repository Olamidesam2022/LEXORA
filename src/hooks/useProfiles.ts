import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@/types/legal";
import { AppRole, ProfileStatus, useAuth } from "@/context/AuthContext";

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: ProfileStatus;
  created_at: string;
}

interface ClientAssignmentRow {
  assigned_to: string | null;
}

const toUser = (profile: ProfileRow, clientCount: number): User => ({
  id: profile.id,
  name: profile.full_name || profile.email,
  email: profile.email,
  role: profile.role,
  status: profile.status,
  department: "Legal",
  createdAt: profile.created_at,
  assignedClientCount: clientCount,
});

export function useProfiles() {
  const { role } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (role !== "managing_partner" && role !== "operations_manager") {
      setUsers([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let query = supabase
      .from("profiles")
      .select("id,email,full_name,role,status,created_at")
      .order("created_at", { ascending: false });

    if (role === "operations_manager") {
      query = query.eq("status", "approved");
    }

    const [{ data, error }, { data: clientAssignments, error: clientError }] = await Promise.all([
      query,
      supabase.from("clients").select("assigned_to").is("deleted_at", null),
    ]);

    if (error) {
      setError(error.message);
      setIsLoading(false);
      throw error;
    }
    if (clientError) {
      setError(clientError.message);
      setIsLoading(false);
      throw clientError;
    }

    const rows = (data || []) as ProfileRow[];
    const assignedClientCounts = new Map<string, number>();
    ((clientAssignments || []) as ClientAssignmentRow[]).forEach((client) => {
      if (client.assigned_to) assignedClientCounts.set(client.assigned_to, (assignedClientCounts.get(client.assigned_to) || 0) + 1);
    });
    const visibleRows =
      role === "operations_manager"
        ? rows.filter((profile) => profile.role === "legal_officer")
        : rows;

    const totalClientCount = (clientAssignments || []).length;
    setUsers(visibleRows.map((profile) => toUser(
      profile,
      profile.role === "operations_manager" || profile.role === "managing_partner"
        ? totalClientCount
        : assignedClientCounts.get(profile.id) || 0,
    )));
    setIsLoading(false);
  }, [role]);

  const updateUser = useCallback(
    async (id: string, values: Partial<Pick<ProfileRow, "role" | "status">>) => {
      const { error } = await supabase.from("profiles").update(values).eq("id", id);
      if (error) throw error;
      await fetchUsers();
    },
    [fetchUsers],
  );

  const deleteUser = useCallback(
    async (id: string) => {
      if (role !== "managing_partner") {
        throw new Error("Only Managing Partners can delete users.");
      }

      const { error } = await supabase.rpc("delete_user_account", {
        target_user_id: id,
      });
      if (error) throw error;
      await fetchUsers();
    },
    [fetchUsers, role],
  );

  useEffect(() => {
    fetchUsers().catch(console.error);
  }, [fetchUsers]);

  useEffect(() => {
    if (role !== "managing_partner" && role !== "operations_manager") return;

    const refreshOnFocus = () => {
      fetchUsers().catch(console.error);
    };

    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshOnFocus();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [fetchUsers, role]);

  return { users, fetchUsers, updateUser, deleteUser, isLoading, error };
}
