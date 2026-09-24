import { ArrowRight, CalendarDays, Loader2, MapPin, Scale } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { StatusProgressBar } from "@/components/matters/StatusProgressBar";
import { useMatterProgressModal } from "@/hooks/useMatterProgressModal";
import { useMatters } from "@/hooks/useMatters";
import { cn } from "@/lib/utils";
import { formatPracticeArea } from "@/types/legal";

function humanize(value?: string | null) {
  if (!value) return "Open";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getProgressPercent(status?: string | null) {
  const normalized = (status || "open").toLowerCase().replace(/\s+/g, "_");
  const percentByStatus: Record<string, number> = {
    open: 20,
    active: 20,
    urgent: 20,
    in_progress: 40,
    pending: 60,
    pending_response: 60,
    closed: 80,
    completed: 80,
    archived: 80,
  };

  return percentByStatus[normalized] ?? 20;
}

export default function ProgressPage() {
  const { openModal } = useMatterProgressModal();
  const { matters, isLoading } = useMatters();
  const [searchParams] = useSearchParams();
  const focusedMatterId = searchParams.get("matter");
  const activeMatters = matters.filter(
    (matterItem) => !["Closed", "Archived"].includes(matterItem.status),
  );

  useEffect(() => {
    if (!isLoading && focusedMatterId) {
      openModal(focusedMatterId);
    }
  }, [focusedMatterId, isLoading, openModal]);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="rounded-full border border-border bg-background px-3 py-1 text-sm font-semibold text-muted-foreground">
          {activeMatters.length} active matter{activeMatters.length === 1 ? "" : "s"}
        </div>
      </div>

      <section className="app-table-shell">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-foreground">
            <Scale className="h-4 w-4" />
            Matter Progress Overview
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading progress...
          </div>
        ) : activeMatters.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
            <Scale className="h-9 w-9 text-muted-foreground" />
            <h3 className="mt-3 text-base font-extrabold text-foreground">
              No matter progress yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Matters you create or are permitted to access will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            {activeMatters.map((matterItem) => {
              const progressPercent = getProgressPercent(matterItem.status);
              const statusKey = (matterItem.status || "open").toLowerCase();

              return (
                <article
                  key={matterItem.id}
                  className="rounded-2xl border border-border bg-background p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className={cn("text-sm font-semibold text-muted-foreground", matterItem.practiceArea === "litigation" && "text-xs uppercase tracking-wide")}>
                        {matterItem.practiceArea === "litigation" ? matterItem.suitNumber : formatPracticeArea(matterItem.practiceArea)}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-base font-extrabold text-foreground">
                        {matterItem.matterTitle}
                      </h3>
                    </div>
                    <span
                      className={cn(
                        "status-pill w-fit",
                        statusKey === "urgent"
                          ? "status-urgent"
                          : statusKey === "closed"
                            ? "status-completed"
                            : "status-active",
                      )}
                    >
                      {humanize(matterItem.status)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <StatusProgressBar status={matterItem.status} />
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {matterItem.practiceArea === "litigation" && <div className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Next Hearing
                      </div>
                      <p className="mt-1 text-sm font-extrabold text-foreground">
                        {matterItem.nextHearing.toLocaleDateString("en-NG", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>}
                    {matterItem.practiceArea === "litigation" && <div className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        Court
                      </div>
                      <p className="mt-1 truncate text-sm font-extrabold text-foreground">
                        {matterItem.court}
                      </p>
                    </div>}
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>Completion</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => openModal(matterItem.id)}
                    className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-extrabold text-foreground transition-colors hover:bg-foreground hover:text-background"
                  >
                    Open Progress
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
