export type AppRole = "legal_officer" | "operations_manager" | "managing_partner";
export type ProfileStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  status: ProfileStatus;
  department?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}
