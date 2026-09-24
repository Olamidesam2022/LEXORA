import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://your-project-ref.supabase.co";
const fallbackSupabaseAnonKey = "your-anon-public-key";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase environment variables are not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable authentication and data access.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
