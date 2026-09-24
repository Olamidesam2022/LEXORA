import { supabase } from "@/integrations/supabase/client";

export async function writeAuditLog(input: {
  action: "CREATE" | "UPDATE" | "DELETE" | "VIEW" | "DOWNLOAD";
  performedBy: string;
  targetId?: string;
  resource: string;
  details: string;
}) {
  await supabase.from("audit_logs").insert({
    action: input.action,
    performed_by: input.performedBy,
    target_id: input.targetId || null,
    resource: input.resource,
    details: input.details,
  });
}
