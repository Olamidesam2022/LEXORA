import { supabase } from "@/integrations/supabase/client";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const send = (accessToken?: string) => {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    else headers.delete("Authorization");
    return fetch(path, { ...init, headers });
  };

  const response = await send(data.session?.access_token);
  if (response.status !== 401) return response;

  const payload = await response.clone().json().catch(() => null);
  const authMessage = `${payload?.error || ""} ${payload?.message || ""}`.toLowerCase();
  if (!authMessage.includes("token") || !authMessage.includes("invalid") && !authMessage.includes("expired")) {
    return response;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.session?.access_token) return response;
  return send(refreshed.session.access_token);
}