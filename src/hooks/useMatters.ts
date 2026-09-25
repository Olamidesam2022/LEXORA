import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardMetrics, Matter } from "@/types/legal";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { writeAuditLog } from "@/lib/audit";

interface MatterRow {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  assigned_to?: string | null;
  creator_email?: string | null;
  entered_by?: string | null;
  created_at: string;
  client_id?: string | null;
  practice_area?: Matter["practiceArea"];
  matter_status?: "open" | "closed";
  closed_at?: string | null;
}

interface MatterAccessRow {
  matter_id: string;
  user_id: string;
}

interface ClientAssignmentRow {
  id: string;
  assigned_to: string | null;
}

export interface MatterInput {
  title: string;
  clientId?: string;
  practiceArea?: Exclude<NonNullable<Matter["practiceArea"]>, "needs_review">;
  description?: string;
  suitNumber?: string;
  adversaryParty?: string;
  proceduralStage?: string;
  assignedCounsel?: string;
  assignedTo?: string;
  assignedUserIds?: string[];
  court?: string;
  nextHearing?: string;
  filingDeadline?: string;
  status?: string;
}

const parseDescription = (description: string | null) => {
  if (!description) return {};
  try {
    return JSON.parse(description);
  } catch {
    return { description };
  }
};

export const toMatter = (
  row: MatterRow,
  viewer?: { id: string; role?: string | null },
  assignedUserIds: string[] = [],
  clientAssignedToViewer = false,
): Matter => {
  const meta = parseDescription(row.description);
  const createdAt = new Date(row.created_at);
  const enteredBy = row.entered_by || meta.enteredBy || row.created_by;
  const canEditAll = viewer?.role === "operations_manager" || viewer?.role === "managing_partner";
  const canDeleteAll = viewer?.role === "managing_partner";
  return {
    id: row.id,
    clientId: row.client_id || undefined,
    practiceArea: row.practice_area || "needs_review",
    matterStatus: row.matter_status || "open",
    suitNumber: meta.suitNumber || "Unassigned",
    matterTitle: row.title,
    adversaryParty: meta.adversaryParty || "Unspecified",
    proceduralStage: meta.proceduralStage || "Mention",
    assignedCounsel: meta.assignedCounsel || "Unassigned",
    status: row.matter_status === "closed" ? "Closed" : meta.status || "Active",
    nextHearing: meta.nextHearing ? new Date(meta.nextHearing) : createdAt,
    court: meta.court || "Unspecified",
    filedDate: createdAt,
    description: meta.description || row.description || "",
    createdBy: row.created_by,
    creatorEmail: row.creator_email || meta.creatorEmail || "",
    enteredBy,
    assignedTo: row.assigned_to || undefined,
    assignedUserIds,
    canEdit: row.matter_status !== "closed" && (canEditAll || (viewer?.role === "legal_officer" && clientAssignedToViewer)),
    canDelete: canDeleteAll,
  };
};

const canMatterBeSeenByViewer = (
  _row: MatterRow,
  viewer: { id: string; role?: string | null },
  _assignedUserIds: string[],
  clientAssignedToViewer: boolean,
) => {
  if (viewer.role === "operations_manager" || viewer.role === "managing_partner") return true;
  return clientAssignedToViewer;
};

export function useMatters() {
  const { user, role, profile, isApproved } = useAuth();
  const { viewingAsUser, isViewingAs } = useViewAs();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMatters = useCallback(async () => {
    if (!user || !isApproved) {
      setMatters([]);
      return;
    }

    setIsLoading(true);
    const mattersQuery = supabase
      .from("matters")
      .select("id,title,description,created_by,creator_email,entered_by,assigned_to,client_id,practice_area,matter_status,closed_at,created_at")
      .order("created_at", { ascending: false });
    const accessQuery = supabase.from("matter_access").select("matter_id,user_id");
    const clientAssignmentsQuery = supabase.from("clients").select("id,assigned_to");

    const [mattersResult, accessResult, clientAssignmentsResult] = await Promise.all([
      mattersQuery,
      accessQuery,
      clientAssignmentsQuery,
    ]);
    const { data, error } = mattersResult;

    if (error) {
      console.error("Failed to load matters:", error);
      setMatters([]);
      setIsLoading(false);
      return;
    }
    if (accessResult.error) {
      console.error("Failed to load matter assignments:", accessResult.error);
    }
    if (clientAssignmentsResult.error) {
      console.error("Failed to load client assignments:", clientAssignmentsResult.error);
    }

    const viewer = isViewingAs && viewingAsUser
      ? { id: viewingAsUser.id, role: viewingAsUser.role }
      : { id: user.id, role };
    const assignedClientIds = new Set(
      ((clientAssignmentsResult.data || []) as ClientAssignmentRow[])
        .filter((client) => client.assigned_to === viewer.id)
        .map((client) => client.id),
    );

    const assignedUsersByMatter = new Map<string, string[]>();
    ((accessResult.error ? [] : accessResult.data || []) as MatterAccessRow[]).forEach((access) => {
      assignedUsersByMatter.set(access.matter_id, [
        ...(assignedUsersByMatter.get(access.matter_id) || []),
        access.user_id,
      ]);
    });

    const visibleRows = ((data || []) as MatterRow[]).filter((row) => {
      if (!isViewingAs) return true;
      return canMatterBeSeenByViewer(
        row,
        viewer,
        assignedUsersByMatter.get(row.id) || [],
        !!row.client_id && assignedClientIds.has(row.client_id),
      );
    });

    setMatters(
      visibleRows.map((row) =>
        toMatter(
          row,
          viewer,
          assignedUsersByMatter.get(row.id) || [],
          !!row.client_id && assignedClientIds.has(row.client_id),
        ),
      ),
    );
    setIsLoading(false);
  }, [isApproved, isViewingAs, role, user, viewingAsUser]);

  const syncMatterAccess = useCallback(
    async (matterId: string, assignedUserIds: string[]) => {
      if (!user || role !== "operations_manager") return;

      const uniqueUserIds = Array.from(new Set(assignedUserIds.filter(Boolean)));
      const { error: deleteError } = await supabase
        .from("matter_access")
        .delete()
        .eq("matter_id", matterId);
      if (deleteError) throw deleteError;

      if (uniqueUserIds.length === 0) return;

      const { error: insertError } = await supabase.from("matter_access").insert(
        uniqueUserIds.map((userId) => ({
          matter_id: matterId,
          user_id: userId,
          granted_by: user.id,
        })),
      );
      if (insertError) throw insertError;
    },
    [role, user],
  );

  const createMatter = useCallback(
    async (input: MatterInput) => {
      if (!user) throw new Error("You must be logged in to create a matter.");
      if (!role) throw new Error("Your account role is required to create a matter.");

      const canAssignMatters = role === "operations_manager" || role === "managing_partner";
      const assignedUserIds = canAssignMatters ? input.assignedUserIds : undefined;
      const assignedTo = canAssignMatters ? input.assignedTo : undefined;

      const { data, error } = await supabase
        .from("matters")
        .insert({
          title: input.title,
          client_id: input.clientId || null,
          practice_area: input.practiceArea || "needs_review",
          matter_status: "open",
          created_by: user.id,
          creator_email: profile?.email || user.email || null,
          entered_by: user.id,
          assigned_to: assignedUserIds?.[0] || assignedTo || null,
          description: JSON.stringify({
            description: input.description || "",
            suitNumber: input.suitNumber || "",
            adversaryParty: input.adversaryParty || "",
            proceduralStage: input.proceduralStage || "Mention",
            assignedCounsel: input.assignedCounsel || "",
            court: input.court || "",
            nextHearing: input.nextHearing || null,
            filingDeadline: input.filingDeadline || null,
            status: input.status || "Active",
          }),
        })
        .select("id")
        .single();

      if (error) throw error;
      if (assignedUserIds !== undefined) {
        await syncMatterAccess(data.id, assignedUserIds);
      } else if (assignedTo) {
        await syncMatterAccess(data.id, [assignedTo]);
      }
      await writeAuditLog({
        action: "CREATE",
        performedBy: user.id,
        targetId: data.id,
        resource: "Matter",
        details: `Created matter: ${input.title}`,
      });
      await fetchMatters();
    },
    [fetchMatters, profile?.email, role, syncMatterAccess, user],
  );

  const updateMatter = useCallback(
    async (id: string, input: MatterInput) => {
      if (!user) throw new Error("You must be logged in to update a matter.");
      const current = matters.find((matterItem) => matterItem.id === id);
      if (current && !current.canEdit) {
        throw new Error("You are not authorized to update this matter.");
      }

      const canAssignMatters = role === "operations_manager";
      const nextAssignedUserIds = canAssignMatters ? input.assignedUserIds : undefined;
      const nextAssignedTo = canAssignMatters ? input.assignedTo : undefined;
      const primaryAssignedUserId =
        nextAssignedUserIds === undefined
          ? nextAssignedTo
          : nextAssignedUserIds[0] || "";

      const { error } = await supabase
        .from("matters")
        .update({
          title: input.title,
          client_id: input.clientId || current?.clientId || null,
          practice_area: input.practiceArea || current?.practiceArea || "needs_review",
          assigned_to:
            nextAssignedUserIds === undefined && nextAssignedTo === undefined
              ? current?.assignedTo || null
              : primaryAssignedUserId || null,
          description: JSON.stringify({
            description: input.description || "",
            suitNumber: input.suitNumber || "",
            adversaryParty: input.adversaryParty || "",
            proceduralStage: input.proceduralStage || "Mention",
            assignedCounsel: input.assignedCounsel || "",
            court: input.court || "",
            nextHearing: input.nextHearing || null,
            filingDeadline: input.filingDeadline || null,
            status: input.status || "Active",
          }),
        })
        .eq("id", id);

      if (error) throw error;
      if (nextAssignedUserIds !== undefined) {
        await syncMatterAccess(id, nextAssignedUserIds);
      }
      await writeAuditLog({
        action: "UPDATE",
        performedBy: user.id,
        targetId: id,
        resource: "Matter",
        details: `Updated matter: ${input.title}`,
      });
      await fetchMatters();
    },
    [matters, fetchMatters, role, syncMatterAccess, user],
  );

  const deleteMatter = useCallback(
    async (matterItem: Matter) => {
      if (!user) throw new Error("You must be logged in to archive a matter.");
      if (!matterItem.canDelete) {
        throw new Error("You are not authorized to archive this matter.");
      }

      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`/api/matters/${matterItem.id}/soft-delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session?.access_token || ""}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to soft-delete matter.");
      }
      await writeAuditLog({
        action: "DELETE",
        performedBy: user.id,
        targetId: matterItem.id,
        resource: "Matter",
        details: `Soft-deleted matter: ${matterItem.matterTitle}`,
      });
      await fetchMatters();
    },
    [fetchMatters, user],
  );

  const closeMatter = useCallback(async (matter: Matter) => {
    if (!user || !["operations_manager", "managing_partner"].includes(role || "")) {
      throw new Error("Only Operations Managers and Managing Partners can close matters.");
    }
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`/api/matters/${matter.id}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.session?.access_token || ""}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Failed to close matter.");
    await writeAuditLog({ action: "CLOSE", performedBy: user.id, targetId: matter.id, resource: "Matter", details: `Closed matter: ${matter.matterTitle}` });
    await fetchMatters();
  }, [fetchMatters, role, user]);

  useEffect(() => {
    fetchMatters().catch(console.error);
  }, [fetchMatters]);

  const metrics = useMemo<DashboardMetrics>(() => {
    const activeMatters = matters.filter(
      (matterItem) => !["Closed", "Archived"].includes(matterItem.status),
    );
    const now = new Date();
    const soon = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    return {
      activeLitigation: activeMatters.length,
      urgentHearings: activeMatters.filter(
        (matterItem) =>
          matterItem.practiceArea === "litigation" &&
          matterItem.nextHearing >= now && matterItem.nextHearing <= soon,
      ).length,
      winRate: 0,
      totalMatters: activeMatters.length,
    };
  }, [matters]);

  return {
    matters,
    metrics,
    isLoading,
    fetchMatters,
    createMatter,
    updateMatter,
    deleteMatter,
    closeMatter,
  };
}
