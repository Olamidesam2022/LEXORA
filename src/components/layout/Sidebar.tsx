import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Scale,
  FileText,
  FolderOpen,
  Users,
  UserRoundSearch,
  ReceiptText,
  ClipboardList,
  Settings,
  LogOut,
  CalendarDays,
  Activity,
  Archive,
  FolderSearch,
  UserCircle2,
  X,
} from "lucide-react";
import { User, UserRole } from "@/types/legal";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/layout/BrandLogo";

interface SidebarProps {
  currentUser: User;
  activeView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["operations_manager", "managing_partner", "legal_officer"],
  },
  {
    id: "clients",
    label: "Clients",
    icon: UserRoundSearch,
    roles: ["operations_manager", "managing_partner", "legal_officer"],
  },
  {
    id: "billing",
    label: "Billing",
    icon: ReceiptText,
    roles: ["operations_manager", "managing_partner", "legal_officer"],
  },
  {
    id: "litigation",
    label: "Matters",
    icon: Scale,
    roles: ["operations_manager", "managing_partner", "legal_officer"],
  },
  {
    id: "advisory",
    label: "Advisory Workflow",
    icon: FileText,
    roles: ["operations_manager", "managing_partner", "legal_officer"],
  },
  {
    id: "documents",
    label: "Document Vault",
    icon: FolderOpen,
    roles: ["operations_manager", "managing_partner", "legal_officer"],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarDays,
    roles: ["operations_manager", "managing_partner", "legal_officer"],
  },
  {
    id: "progress",
    label: "Progress Bar",
    icon: Activity,
    roles: ["operations_manager", "managing_partner", "legal_officer"],
  },
  {
    id: "records",
    label: "Records",
    icon: FolderSearch,
    roles: ["operations_manager", "managing_partner", "legal_officer"],
  },
  {
    id: "archive",
    label: "Archive",
    icon: Archive,
    roles: ["operations_manager", "managing_partner", "legal_officer"],
  },
  { id: "audit", label: "Audit Trail", icon: ClipboardList, roles: ["operations_manager", "managing_partner"] },
  { id: "users", label: "User Management", icon: Users, roles: ["managing_partner"] },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    roles: ["operations_manager", "managing_partner", "legal_officer"],
  },
];

export function Sidebar({
  currentUser,
  activeView,
  onViewChange,
  onLogout,
  isOpen,
  onClose,
  collapsed = false,
  onCollapsedChange,
}: SidebarProps) {
  const [overdueCount, setOverdueCount] = useState(0);

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(currentUser.role),
  );
  // Close sidebar on navigation in mobile
  const handleNavClick = (viewId: string) => {
    onViewChange(viewId);
    if (onClose) onClose();
  };

  const handleBrandClick = () => {
    if (isOpen && onClose) {
      onClose();
      return;
    }
    onCollapsedChange?.(!collapsed);
  };

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const fetchOverdueCount = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { count, error } = await supabase
        .from("deadlines")
        .select("id", { count: "exact", head: true })
        .lt("due_date", today)
        .neq("status", "completed");

      if (error) {
        console.error("Failed to fetch overdue deadline count:", error);
        return;
      }

      setOverdueCount(count ?? 0);
    };

    fetchOverdueCount();
    const channel = supabase
      .channel("sidebar-deadlines-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deadlines" },
        fetchOverdueCount,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "glass-sidebar fixed left-0 top-0 z-50 flex h-dvh max-h-dvh flex-col overflow-hidden transition-all duration-300 ease-in-out",
          // Mobile: Full width drawer, hidden by default
          "w-[min(82vw,18rem)]",
          // Mobile display
          !isOpen && "-translate-x-full md:translate-x-0",
          isOpen && "translate-x-0",
          // Desktop: Collapsible with smooth width transition
          "md:relative md:translate-x-0",
          collapsed ? "md:w-20 lg:w-20" : "md:w-[17rem] lg:w-[17rem]",
          // Prevent sidebar from being hidden on desktop when collapsed
          "md:block",
        )}
      >
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-sidebar-border/80 px-3">
          {(!collapsed || isOpen) && (
            <button
              type="button"
              onClick={handleBrandClick}
              className="min-w-0 rounded-lg text-left transition-opacity hover:opacity-80"
              aria-label={isOpen ? "Close sidebar" : "Toggle sidebar"}
            >
              <BrandLogo inverse className="animate-fade-in" />
            </button>
          )}
          {collapsed && !isOpen && (
            <button
              type="button"
              onClick={handleBrandClick}
              className="mx-auto hidden h-10 w-10 md:flex"
              aria-label="Expand sidebar"
            >
              <BrandLogo compact inverse />
            </button>
          )}

          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
          <ul className="space-y-1.5">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "nav-item w-full transition-all duration-300",
                      isActive && "active",
                      collapsed &&
                        !isOpen &&
                        "md:justify-center md:px-2 md:py-2",
                    )}
                    aria-current={isActive ? "page" : undefined}
                    title={collapsed && !isOpen ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {(!collapsed || isOpen) && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.id === "calendar" && overdueCount > 0 && (
                          <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
                            {overdueCount}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-sidebar-border bg-sidebar p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
          {/* User Info */}
          <div
            className={cn(
              "mb-2.5 flex items-center gap-3 rounded-xl p-2 text-sidebar-foreground transition-colors duration-300 hover:bg-sidebar-accent",
              collapsed && !isOpen && "md:justify-center",
            )}
            title={`${currentUser.name} - ${currentUser.role}`}
            aria-label={`${currentUser.name} account`}
          >
            <UserCircle2 className="h-9 w-9 flex-shrink-0 text-sidebar-foreground" />
            {(!collapsed || isOpen) && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  {currentUser.name}
                </p>
                <p className="truncate text-xs capitalize text-sidebar-foreground/60">
                  {currentUser.role}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div
            className={cn(
                "space-y-1.5",
              collapsed &&
                !isOpen &&
                "md:flex md:flex-col md:items-center md:gap-2",
            )}
          >
            <button
              onClick={() => {
                onLogout();
                if (onClose) onClose();
              }}
              className={cn(
                "nav-item w-full text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-all duration-300 dark:font-semibold",
                collapsed && !isOpen && "md:justify-center md:px-2 md:py-2",
              )}
              title={collapsed && !isOpen ? "Logout" : undefined}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {(!collapsed || isOpen) && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
