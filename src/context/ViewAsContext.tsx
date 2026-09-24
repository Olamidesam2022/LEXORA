import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { writeAuditLog } from "@/lib/audit";
import { User } from "@/types/legal";

const STORAGE_KEY = "lexora:view-as-user";

interface ViewAsContextValue {
  viewingAsUser: User | null;
  isViewingAs: boolean;
  effectiveUserId: string | null;
  effectiveRole: User["role"] | null;
  startViewingAs: (targetUser: User) => Promise<void>;
  stopViewingAs: () => Promise<void>;
}

const ViewAsContext = createContext<ViewAsContextValue | null>(null);

function readStoredUser() {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY);
    return rawValue ? (JSON.parse(rawValue) as User) : null;
  } catch {
    return null;
  }
}

function persistUser(user: User | null) {
  if (typeof window === "undefined") return;

  if (user) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [viewingAsUser, setViewingAsUser] = useState<User | null>(() =>
    readStoredUser(),
  );

  const stopViewingAs = useCallback(async () => {
    const previousUser = viewingAsUser;
    setViewingAsUser(null);
    persistUser(null);

    if (user && previousUser) {
      await writeAuditLog({
        action: "VIEW",
        performedBy: user.id,
        targetId: previousUser.id,
        resource: "User View",
        details: `Stopped viewing as ${previousUser.name} (${previousUser.email})`,
      }).catch(console.error);
    }
  }, [user, viewingAsUser]);

  const startViewingAs = useCallback(
    async (targetUser: User) => {
      if (!user || role !== "managing_partner") {
        throw new Error("Only Managing Partner accounts can view as another user.");
      }

      if (targetUser.id === user.id) {
        await stopViewingAs();
        return;
      }

      setViewingAsUser(targetUser);
      persistUser(targetUser);

      await writeAuditLog({
        action: "VIEW",
        performedBy: user.id,
        targetId: targetUser.id,
        resource: "User View",
        details: `Started viewing as ${targetUser.name} (${targetUser.email})`,
      }).catch(console.error);
    },
    [role, stopViewingAs, user],
  );

  useEffect(() => {
    if (!user || role !== "managing_partner") {
      if (viewingAsUser) {
        setViewingAsUser(null);
        persistUser(null);
      }
      return;
    }

    if (viewingAsUser?.id === user.id) {
      setViewingAsUser(null);
      persistUser(null);
    }
  }, [role, user, viewingAsUser]);

  const value = useMemo<ViewAsContextValue>(
    () => ({
      viewingAsUser,
      isViewingAs: Boolean(viewingAsUser),
      effectiveUserId: viewingAsUser?.id || user?.id || null,
      effectiveRole: viewingAsUser?.role || role || null,
      startViewingAs,
      stopViewingAs,
    }),
    [role, startViewingAs, stopViewingAs, user?.id, viewingAsUser],
  );

  return (
    <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>
  );
}

export function useViewAs() {
  const context = useContext(ViewAsContext);
  if (!context) {
    throw new Error("useViewAs must be used within a ViewAsProvider");
  }
  return context;
}
