import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DocumentType, DocumentWorkflowStatus, LegalDocument } from "@/types/legal";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { writeAuditLog } from "@/lib/audit";

const DOCUMENT_BUCKET = "lexora-documents";

interface DocumentRow {
  id: string;
  name: string;
  type: DocumentType;
  matter_id: string | null;
  client_id?: string | null;
  storage_path: string | null;
  mime_type: string | null;
  version: string;
  uploaded_by: string;
  created_by?: string | null;
  entered_by?: string | null;
  size: string;
  status: DocumentWorkflowStatus;
  created_at: string;
  updated_at: string;
}

interface MatterRow {
  id: string;
  client_id?: string | null;
  assigned_to?: string | null;
}

interface ClientAssignmentRow {
  id: string;
  assigned_to: string | null;
}

const toLegalDocument = (
  row: DocumentRow,
  viewer?: { id: string; role?: string | null },
): LegalDocument => {
  const ownsRecord =
    !!viewer?.id &&
    (row.created_by === viewer.id || row.entered_by === viewer.id);
  const canManageAll = viewer?.role === "managing_partner";

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    matterId: row.matter_id || undefined,
    storagePath: row.storage_path || undefined,
    mimeType: row.mime_type || undefined,
    version: row.version,
    uploadedBy: row.uploaded_by,
    uploadedAt: new Date(row.created_at),
    lastModified: new Date(row.updated_at || row.created_at),
    size: row.size,
    status: row.status,
    createdBy: row.created_by || undefined,
    enteredBy: row.entered_by || row.created_by || undefined,
    canDownload: true,
    canDelete: canManageAll,
  };
};

export function useDocuments() {
  const { user, role, profile, isApproved } = useAuth();
  const { viewingAsUser, isViewingAs } = useViewAs();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);

  const fetchDocuments = useCallback(async () => {
    if (!user || !isApproved) {
      setDocuments([]);
      return;
    }

    const documentsQuery = supabase
      .from("documents")
      .select("id,name,type,matter_id,client_id,storage_path,mime_type,version,uploaded_by,created_by,entered_by,size,status,created_at,updated_at,deleted_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    const profilesQuery = supabase.from("profiles").select("id,full_name");
    const matterQuery =
      isViewingAs && viewingAsUser
        ? supabase.from("matters").select("id,client_id,assigned_to")
        : null;
    const clientAssignmentsQuery = supabase.from("clients").select("id,assigned_to");

    const [documentsResult, profilesResult, matterResult, clientAssignmentsResult] = await Promise.all([
      documentsQuery,
      profilesQuery,
      matterQuery ?? Promise.resolve({ data: [], error: null }),
      clientAssignmentsQuery,
    ]);
    const { data, error } = documentsResult;

    if (error) throw error;
    if (profilesResult.error) throw profilesResult.error;
    if (matterResult.error) console.error("Failed to load document matter access:", matterResult.error);
    if (clientAssignmentsResult.error) console.error("Failed to load client assignments:", clientAssignmentsResult.error);

    const profileNameById = new Map<string, string>();
    for (const profileRow of profilesResult.data || []) {
      if (profileRow?.id && profileRow?.full_name) {
        profileNameById.set(profileRow.id, profileRow.full_name);
      }
    }

    const resolveUploaderName = (row: DocumentRow) => {
      const rawValue = row.uploaded_by?.trim();
      if (!rawValue) return "Unknown uploader";
      if (row.created_by && profileNameById.has(row.created_by)) {
        return profileNameById.get(row.created_by) || rawValue;
      }
      if (row.entered_by && profileNameById.has(row.entered_by)) {
        return profileNameById.get(row.entered_by) || rawValue;
      }
      const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawValue);
      if (looksLikeUuid) {
        const match = [...profileNameById.entries()].find(([id]) => id === rawValue);
        return match?.[1] || rawValue;
      }
      return rawValue;
    };

    const viewer = isViewingAs && viewingAsUser
      ? { id: viewingAsUser.id, role: viewingAsUser.role }
      : { id: user.id, role };
    const accessibleMatterIds = new Set<string>();
    const assignedClientIds = new Set(
      ((clientAssignmentsResult.data || []) as ClientAssignmentRow[])
        .filter((client) => client.assigned_to === viewer.id)
        .map((client) => client.id),
    );

    if (isViewingAs && viewingAsUser) {
      ((matterResult.data || []) as MatterRow[]).forEach((matterRow) => {
        if (
          viewer.role === "managing_partner" ||
          viewer.role === "operations_manager" ||
          (!!matterRow.client_id && assignedClientIds.has(matterRow.client_id))
        ) {
          accessibleMatterIds.add(matterRow.id);
        }
      });
    }

    const visibleRows = ((data || []) as DocumentRow[]).filter((row) => {
      if (!isViewingAs || !viewingAsUser) return true;
      if (viewer.role === "managing_partner" || viewer.role === "operations_manager") return true;
      if (row.client_id && assignedClientIds.has(row.client_id)) return true;
      return !!row.matter_id && accessibleMatterIds.has(row.matter_id);
    });

    setDocuments(
      visibleRows.map((row) => {
        const resolvedRow: DocumentRow = {
          ...row,
          uploaded_by: resolveUploaderName(row),
        };

        return isViewingAs
          ? {
              ...toLegalDocument(resolvedRow, viewer),
              canDelete: false,
            }
          : toLegalDocument(resolvedRow, viewer);
      }),
    );
  }, [isApproved, isViewingAs, role, user, viewingAsUser]);

  const createDocument = useCallback(
    async (input: {
      name: string;
      type: DocumentType;
      relatedMatter?: string;
      file?: File | null;
    }) => {
      if (!user) throw new Error("You must be logged in.");
      if (!input.file) throw new Error("Please select a file to upload.");

      const extension = input.file.name.includes(".")
        ? input.file.name.split(".").pop()?.toLowerCase()
        : "bin";
      const safeName = input.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const documentId = crypto.randomUUID();
      const uploaderName = profile?.full_name || user.email || "User";
      let clientId: string | null = null;
      if (input.relatedMatter) {
        const { data: matter, error: matterError } = await supabase.from("matters").select("client_id").eq("id", input.relatedMatter).maybeSingle();
        if (matterError) throw matterError;
        clientId = matter?.client_id || null;
      }

      const { data, error } = await supabase
        .from("documents")
        .insert({
          id: documentId,
          name: input.name,
          type: input.type,
          matter_id: input.relatedMatter || null,
          client_id: clientId,
          mime_type: input.file.type || "application/octet-stream",
          version: "1.0",
          uploaded_by: uploaderName,
          size: input.file
            ? `${(input.file.size / 1024 / 1024).toFixed(2)} MB`
            : "0 MB",
          status: "draft",
          created_by: user.id,
          entered_by: user.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      const storagePath = `${user.id}/${documentId}/1-${crypto.randomUUID()}-${safeName}.${extension || "bin"}`;
      const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, input.file, {
        contentType: input.file.type || "application/octet-stream",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: session } = await supabase.auth.getSession();
      const versionResponse = await fetch(`/api/documents/${data.id}/versions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token || ""}`,
        },
        body: JSON.stringify({ storage_path: storagePath, mime_type: input.file.type || null }),
      });
      if (!versionResponse.ok) {
        const payload = await versionResponse.json().catch(() => ({}));
        throw new Error(payload.error || "Could not register uploaded document version.");
      }

      if (input.relatedMatter) {
        const { error: noteError } = await supabase.from("matter_notes").insert({
          matter_id: input.relatedMatter,
          content: `Document "${input.name}" was uploaded to this matter.`,
          created_by: user.id,
          user_id: user.id,
          is_private: false,
          note_type: "system",
        });

        if (noteError) {
          console.error("Failed to add matter document note:", noteError);
        }
      }

      await writeAuditLog({
        action: "CREATE",
        performedBy: user.id,
        targetId: input.relatedMatter || data.id,
        resource: "Document",
        details: input.relatedMatter
          ? `Uploaded document "${input.name}" to a matter`
          : `Uploaded document metadata: ${input.name}`,
      });
      await fetchDocuments();
    },
    [fetchDocuments, profile?.full_name, user],
  );

  const downloadDocument = useCallback(
    async (document: LegalDocument) => {
      if (!user) throw new Error("You must be logged in.");
      if (!document.canDownload) {
        throw new Error("You are not authorized to download this document.");
      }
      if (!document.storagePath) {
        throw new Error("This document has no stored file attached.");
      }

      const { data, error } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .createSignedUrl(document.storagePath, 60);

      if (error) throw error;

      await writeAuditLog({
        action: "DOWNLOAD",
        performedBy: user.id,
        targetId: document.id,
        resource: "Document",
        details: `Downloaded document: ${document.name}`,
      });

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    },
    [user],
  );

  const deleteDocument = useCallback(
    async (document: LegalDocument) => {
      if (!user) throw new Error("You must be logged in.");
      if (role !== "managing_partner") throw new Error("Only Managing Partner may soft-delete a document.");
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`/api/documents/${document.id}/soft-delete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session?.access_token || ""}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to soft-delete document.");
      }
      await fetchDocuments();
    },
    [fetchDocuments, role, user],
  );

  useEffect(() => {
    fetchDocuments().catch(console.error);
  }, [fetchDocuments]);

  return {
    documents,
    fetchDocuments,
    createDocument,
    downloadDocument,
    deleteDocument,
  };
}
