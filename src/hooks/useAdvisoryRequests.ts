import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdvisoryRequest, AdvisoryStatus } from "@/types/legal";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { writeAuditLog } from "@/lib/audit";

export interface AdvisoryInput {
  title: string;
  requestedBy: string;
  department: string;
  status?: AdvisoryStatus;
  priority?: string;
  dueDate?: string;
  assignedTo?: string;
  description?: string;
}

interface AdvisoryRow {
  id: string;
  title: string;
  requested_by: string;
  department: string;
  due_date: string | null;
  status: AdvisoryStatus;
  assigned_to: string | null;
  created_by?: string | null;
  priority: "Low" | "Medium" | "High" | "Critical";
  description: string | null;
  created_at: string;
}

const toAdvisoryRequest = (row: AdvisoryRow): AdvisoryRequest => ({
  id: row.id,
  requestNumber: `ADV-${row.created_at.slice(0, 4)}-${row.id.slice(0, 4).toUpperCase()}`,
  title: row.title,
  requestedBy: row.requested_by,
  department: row.department,
  dateReceived: new Date(row.created_at),
  dueDate: row.due_date ? new Date(row.due_date) : new Date(row.created_at),
  status: row.status,
  assignedTo: row.assigned_to || "Unassigned",
  priority: row.priority,
  description: row.description || "",
});

export function useAdvisoryRequests() {
  const { user, isApproved } = useAuth();
  const { viewingAsUser, isViewingAs } = useViewAs();
  const [advisoryRequests, setAdvisoryRequests] = useState<AdvisoryRequest[]>([]);

  const fetchAdvisoryRequests = useCallback(async () => {
    if (!user || !isApproved) {
      setAdvisoryRequests([]);
      return;
    }

    const { data, error } = await supabase
      .from("advisory_requests")
      .select("id,title,requested_by,department,due_date,status,assigned_to,created_by,priority,description,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const rows = (data || []) as AdvisoryRow[];
    const visibleRows =
      isViewingAs && viewingAsUser
        ? rows.filter((row) => {
            if (viewingAsUser.role === "managing_partner" || viewingAsUser.role === "operations_manager") {
              return true;
            }

            const targetValues = [
              viewingAsUser.id,
              viewingAsUser.email,
              viewingAsUser.name,
            ].map((value) => value.toLowerCase());
            const rowValues = [
              row.created_by || "",
              row.assigned_to || "",
              row.requested_by || "",
            ].map((value) => value.toLowerCase());

            return targetValues.some((target) =>
              rowValues.some((value) => value === target || value.includes(target)),
            );
          })
        : rows;

    setAdvisoryRequests(visibleRows.map(toAdvisoryRequest));
  }, [isApproved, isViewingAs, user, viewingAsUser]);

  const createAdvisoryRequest = useCallback(
    async (input: AdvisoryInput) => {
      if (!user) throw new Error("You must be logged in.");

      const { data, error } = await supabase
        .from("advisory_requests")
        .insert({
          title: input.title,
          requested_by: input.requestedBy,
          department: input.department,
          status: input.status || "Pending",
          priority: input.priority || "Medium",
          due_date: input.dueDate || null,
          assigned_to: input.assignedTo || null,
          description: input.description || "",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (error) throw error;
      await writeAuditLog({
        action: "CREATE",
        performedBy: user.id,
        targetId: data.id,
        resource: "Advisory",
        details: `Created advisory request: ${input.title}`,
      });
      await fetchAdvisoryRequests();
    },
    [fetchAdvisoryRequests, user],
  );

  const updateAdvisoryRequest = useCallback(
    async (id: string, input: AdvisoryInput) => {
      if (!user) throw new Error("You must be logged in.");

      const { error } = await supabase
        .from("advisory_requests")
        .update({
          title: input.title,
          requested_by: input.requestedBy,
          department: input.department,
          status: input.status || "Pending",
          priority: input.priority || "Medium",
          due_date: input.dueDate || null,
          assigned_to: input.assignedTo || null,
          description: input.description || "",
        })
        .eq("id", id);

      if (error) throw error;
      await writeAuditLog({
        action: "UPDATE",
        performedBy: user.id,
        targetId: id,
        resource: "Advisory",
        details: `Updated advisory request: ${input.title}`,
      });
      await fetchAdvisoryRequests();
    },
    [fetchAdvisoryRequests, user],
  );

  const deleteAdvisoryRequest = useCallback(
    async (request: AdvisoryRequest) => {
      if (!user) throw new Error("You must be logged in.");

      const { error } = await supabase
        .from("advisory_requests")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", request.id);

      if (error) throw error;
      await writeAuditLog({
        action: "DELETE",
        performedBy: user.id,
        targetId: request.id,
        resource: "Advisory",
        details: `Deleted advisory request: ${request.title}`,
      });
      await fetchAdvisoryRequests();
    },
    [fetchAdvisoryRequests, user],
  );

  useEffect(() => {
    fetchAdvisoryRequests().catch(console.error);
  }, [fetchAdvisoryRequests]);

  return {
    advisoryRequests,
    fetchAdvisoryRequests,
    createAdvisoryRequest,
    updateAdvisoryRequest,
    deleteAdvisoryRequest,
  };
}
