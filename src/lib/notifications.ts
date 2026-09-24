import { supabase } from "@/integrations/supabase/client";

export const NOTIFICATIONS_REFRESH_EVENT = "notifications:refresh";

export function refreshNotifications() {
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id);

  if (error) throw error;
  refreshNotifications();
}

export async function markNotificationsReadByMessage(messagePart: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .ilike("message", `%${messagePart}%`);

  if (error) throw error;
  refreshNotifications();
}
