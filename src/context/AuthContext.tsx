import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "legal_officer" | "operations_manager" | "managing_partner";
export type ProfileStatus = "pending" | "approved" | "rejected";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: ProfileStatus;
  created_at: string;
}

interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  role: "legal_officer";
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole | null;
  status: ProfileStatus | null;
  isLoading: boolean;
  isApproved: boolean;
  signUp: (input: SignUpInput) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,status,created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    setProfile(data as UserProfile | null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await fetchProfile(data.user.id);
    }
  }, [fetchProfile]);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      setSession(data.session);
      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        await fetchProfile(data.session.user.id);
      }

      if (active) setIsLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setTimeout(() => {
          fetchProfile(nextSession.user.id).catch(() => setProfile(null));
        }, 0);
      } else {
        setProfile(null);
      }

      setIsLoading(false);
    });

    loadSession().catch(() => {
      setProfile(null);
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = async ({ email, password, fullName, role }: SignUpInput) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          requested_role: role,
        },
      },
    });

    if (error) return { error: new Error(error.message) };
    if (!data.user) return { error: new Error("Signup did not return a user.") };

    const activeSession =
      data.session ?? (await supabase.auth.getSession()).data.session;

    if (activeSession) {
      const { data: existingProfile, error: lookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (lookupError) return { error: new Error(lookupError.message) };

      if (!existingProfile) {
        const { error: profileError } = await supabase.from("profiles").insert({
          id: data.user.id,
          email,
          full_name: fullName,
          role,
          status: "pending",
        });

        if (profileError && profileError.code !== "23505") {
          return { error: new Error(profileError.message) };
        }
      }
    }

    await supabase.auth.signOut();
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { error: new Error(error.message) };
    if (!data.user) return { error: new Error("Login did not return a user.") };

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,status,created_at")
      .eq("id", data.user.id)
      .maybeSingle();

    const nextProfile = profileData as UserProfile | null;

    if (profileError || !nextProfile) {
      await supabase.auth.signOut();
      return {
        error: new Error(
          profileError?.message || "No profile exists for this account.",
        ),
      };
    }

    if (nextProfile.status !== "approved") {
      await supabase.auth.signOut();
      return {
        error: new Error(
          nextProfile.status === "rejected"
            ? "Your account has been rejected."
            : "Your account is pending Managing Partner approval.",
        ),
      };
    }

    setProfile(nextProfile);
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      role: profile?.role ?? null,
      status: profile?.status ?? null,
      isLoading,
      isApproved: profile?.status === "approved",
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, isLoading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
