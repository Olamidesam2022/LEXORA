import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://your-project-ref.supabase.co";
const fallbackSupabaseAnonKey = "your-anon-public-key";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
