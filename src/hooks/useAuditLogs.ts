import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuditLog } from "@/types/legal";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";

interface AuditLogRow {
  id: string;
  action: string;
  performed_by: string | null;
  target_id: string | null;
  resource: string | null;
  details: string | null;
  created_at: string;
}

const toAuditLog = (row: AuditLogRow): AuditLog => ({
  id: row.id,
  userId: row.performed_by || "system",
  userName: row.performed_by ? "Authenticated User" : "System",
  action: row.action,
  resource: row.resource || "System",
  resourceId: row.target_id || "n/a",
  timestamp: new Date(row.created_at),
  ipAddress: "Supabase",
  details: row.details || row.action,
});

export function useAuditLogs() {
  const { role, isApproved } = useAuth();
  const { viewingAsUser, isViewingAs } = useViewAs();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const fetchAuditLogs = useCallback(async () => {
    if (!isApproved || (role !== "managing_partner" && role !== "operations_manager")) {
      setAuditLogs([]);
      return;
    }

    const { data, error } = await supabase
      .from("audit_logs")
      .select("id,action,performed_by,target_id,resource,details,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const rows = (data || []) as AuditLogRow[];
    const visibleRows =
      isViewingAs && viewingAsUser
        ? rows.filter((row) => row.performed_by === viewingAsUser.id)
        : rows;

    setAuditLogs(visibleRows.map(toAuditLog));
  }, [isApproved, isViewingAs, role, viewingAsUser]);

  useEffect(() => {
    fetchAuditLogs().catch(console.error);
  }, [fetchAuditLogs]);

  return { auditLogs, fetchAuditLogs };
}
