import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, FileText, Scale, Users, Wallet, BriefcaseBusiness } from "lucide-react";
import { RecentActivity } from "./RecentActivity";
import { Matter, AuditLog, DashboardMetrics } from "@/types/legal";
import { useAuth } from "@/contexts/AuthContext";
import { useViewAs } from "@/contexts/ViewAsContext";
import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AlignedList, AlignedListRow } from "@/components/ui/aligned-list";

interface DashboardSummary {
  active_matter_count: number;
  outstanding_by_currency: Record<string, number>;
  document_count: number;
  upcoming_deadlines: Array<{ id: string; title: string; due_date: string; matter_id: string }>;
  recent_activity: Array<{ id: number; document_id: string; actor_id: string | null; action: string; details: unknown; occurred_at: string }>;
}
interface RetentionMatter {
  matter_id: string;
  title: string;
  minimum_retention_until: string;
  retention_threshold_reached: boolean;
}

interface DashboardProps {
  metrics: DashboardMetrics;
  matters: Matter[];
  auditLogs: AuditLog[];
  onNavigate?: (view: string) => void;
}

const quickLinks = [
  { label: "Matters", view: "litigation", icon: Scale },
  { label: "Documents", view: "documents", icon: FileText },
  { label: "Calendar", view: "calendar", icon: CalendarDays },
  {
    label: "Users",
    view: "users",
    icon: Users,
    managing_partnerOnly: true,
  },
];

export function Dashboard({
  metrics,
  matters,
  auditLogs,
  onNavigate,
}: DashboardProps) {
  const { role, profile, user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [retentionMatters, setRetentionMatters] = useState<RetentionMatter[]>([]);
  const { effectiveRole, isViewingAs } = useViewAs();
  const {
    pendingUsers,
    updatePendingUser,
    fetchPendingUsers,
    isLoading,
    error,
  } = usePendingApprovals();
  const canViewAudit =
    !isViewingAs && (role === "managing_partner" || role === "operations_manager" || role === "managing_partner");
  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const response = await fetch("/api/dashboard/summary", { headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } });
      if (!response.ok) return;
      const result = await response.json();
      if (active) setSummary(result);
      if (!isViewingAs && ["operations_manager", "managing_partner", ].includes(role || "")) {
        const retentionResponse = await fetch("/api/retention/review", { headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } });
        if (retentionResponse.ok) {
          const retentionResult = await retentionResponse.json();
          if (active) setRetentionMatters(retentionResult.matters || []);
        }
      }
    }).catch(console.error);
    return () => { active = false; };
  }, [user?.id, isViewingAs, role]);
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";
  const feeTotal = summary ? Object.entries(summary.outstanding_by_currency).map(([currency, amount]) => `${currency} ${Number(amount).toLocaleString()}`).join(" · ") || "NGN 0" : "—";
  const activityLogs: AuditLog[] = summary?.recent_activity.map((item) => ({
    id: String(item.id), userId: item.actor_id || "", userName: "LEXORA team", action: item.action,
    resource: "Document", resourceId: item.document_id, timestamp: new Date(item.occurred_at), ipAddress: "",
    details: typeof item.details === "string" ? item.details : JSON.stringify(item.details || {}),
  })) || auditLogs;
  const retentionReviewMatters = retentionMatters.filter((matter) =>
    matter.retention_threshold_reached ||
    new Date(matter.minimum_retention_until).getTime() <= Date.now() + 365 * 24 * 60 * 60 * 1000,
  );

  return (
    <div className="dashboard-canvas space-y-5 p-3 sm:p-5 lg:p-7">
      <section className="dashboard-hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              {greeting}, {profile?.full_name?.split(" ")[0] || "there"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "Firm",
              "Matters",
              "Documents",
              "Calendar",
              ...(!isViewingAs && (role === "managing_partner" || role === "operations_manager")
                ? ["Users"]
                : []),
            ].map((item) => (
              <button
                key={item}
                onClick={() =>
                  onNavigate?.(
                    item === "Firm"
                      ? "dashboard"
                      : item === "Matters"
                        ? "litigation"
                        : item.toLowerCase(),
                  )
                }
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-bold transition-colors",
                  item === "Firm"
                    ? "bg-foreground text-background"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={BriefcaseBusiness} label="Active matters" value={String(summary?.active_matter_count ?? metrics.activeLitigation)} />
          <Stat icon={Wallet} label="Outstanding fees" value={feeTotal} onClick={() => onNavigate?.("billing")} />
          <Stat icon={FileText} label="Documents on file" value={String(summary?.document_count ?? 0)} onClick={() => onNavigate?.("documents")} />
          <Stat icon={CalendarDays} label="Upcoming deadlines" value={String(summary?.upcoming_deadlines.length ?? 0)} onClick={() => onNavigate?.("calendar")} />
        </div>
      </section>

      {!isViewingAs && retentionReviewMatters.length > 0 && (
        <section className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <h2 className="font-semibold text-foreground">Retention review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {retentionReviewMatters.filter((matter) => matter.retention_threshold_reached).length} matters have reached five years and {retentionReviewMatters.filter((matter) => !matter.retention_threshold_reached).length} approach the threshold within one year. Review the retention schedule before an archive decision.
          </p>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="dashboard-panel">
          <div className="flex items-center justify-between border-b border-border/70 p-4">
            <div>
              <h2 className="text-lg font-black text-foreground">
                Recommended for you
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            {quickLinks
              .filter(
                (item) =>
                  !item.managing_partnerOnly ||
                  (!isViewingAs &&
                    role === "managing_partner" && effectiveRole === "managing_partner"),
              )
              .map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => onNavigate?.(item.view)}
                    className="dashboard-quick-tile"
                  >
                    <span className="dashboard-quick-icon">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-black text-foreground">
                      {item.label}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="dashboard-panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 p-4">
            <div>
              <h2 className="text-lg font-black text-foreground">
                Upcoming Deadlines
              </h2>
              <p className="text-sm text-muted-foreground">
                Deadlines over the next seven days
              </p>
            </div>
            <button
              onClick={() => onNavigate?.("calendar")}
              className="rounded-full bg-foreground px-4 py-2 text-xs font-black text-background"
            >
              View Calendar
            </button>
          </div>
          <AlignedList>
            {(summary?.upcoming_deadlines || []).length === 0 && (
              <div className="aligned-list-empty p-8 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-bold text-foreground">
                  No upcoming deadlines
                </p>
                <p className="text-xs text-muted-foreground">
                  Upcoming matter deadlines will appear here.
                </p>
              </div>
            )}
            {(summary?.upcoming_deadlines || []).map((deadline) => {
              const date = new Date(deadline.due_date);
              return <AlignedListRow
                key={deadline.id}
                avatar={<span className="flex h-9 w-9 flex-col items-center justify-center rounded-lg bg-muted text-[10px] font-bold uppercase text-muted-foreground">{date.getDate()}</span>}
                primary={deadline.title}
                secondary={`Matter: ${matters.find((item) => item.id === deadline.matter_id)?.matterTitle || "Matter record"}`}
                tag={<span className="status-pill status-active">Due soon</span>}
                date={date.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "2-digit" })}
                action={<ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />}
                onClick={() => onNavigate?.("calendar")}
                ariaLabel={`Open deadline ${deadline.title}`}
              />;
            })}
          </AlignedList>
        </div>
      </section>

      <RecentActivity
        logs={activityLogs}
        onViewAll={canViewAudit ? () => onNavigate?.("audit") : undefined}
      />

      {role === "managing_partner" && !isViewingAs && (
        <div className="dashboard-panel p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-black text-foreground">
              Pending User Approvals
            </h3>
            <button
              onClick={() => fetchPendingUsers()}
              className="toolbar-button px-3 py-1"
              disabled={isLoading}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {error ? (
            <p className="text-sm text-destructive">
              Could not load pending approvals: {error}
            </p>
          ) : pendingUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending signups</p>
          ) : (
            <div className="space-y-2">
              {pendingUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/60 p-3"
                >
                  <div>
                    <p className="font-bold text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.email} - {u.role === "operations_manager" ? "operations_manager" : "legal user"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await updatePendingUser(u, { status: "approved" });
                          toast.success(`${u.name} approved`);
                        } catch (e) {
                          console.error(e);
                          toast.error("Could not approve user");
                        }
                      }}
                      className="rounded-full bg-foreground px-3 py-1 text-sm font-bold text-background"
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await updatePendingUser(u, { status: "rejected" });
                          toast.success(`${u.name} rejected`);
                        } catch (e) {
                          console.error(e);
                          toast.error("Could not reject user");
                        }
                      }}
                      className="rounded-full bg-muted px-3 py-1 text-sm font-bold text-foreground"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, onClick }: { icon: typeof BriefcaseBusiness; label: string; value: string; onClick?: () => void }) {
  return <button onClick={onClick} className="dashboard-stat-card min-h-32 text-left">
    <div className="flex items-center justify-between"><span className="dashboard-stat-icon"><Icon className="h-4 w-4" /></span><span className="text-xs font-semibold text-muted-foreground">LEXORA</span></div>
    <p className="mt-4 text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-1 break-words text-2xl font-semibold tracking-tight text-foreground">{value}</p>
  </button>;
}
