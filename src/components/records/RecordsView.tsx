import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderSearch,
  MapPin,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuditLog, LegalDocument, Matter } from "@/types/legal";
import { cn } from "@/lib/utils";

interface RecordsViewProps {
  matters: Matter[];
  documents: LegalDocument[];
  auditLogs: AuditLog[];
  onViewMatter?: (matterItem: Matter) => void;
}

interface MatterNoteRow {
  id: string;
  matter_id: string;
  content: string;
  note_type: string;
  created_at: string;
}

interface MatterTaskRow {
  id: string;
  matter_id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not set";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusClass(status: string) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  if (key === "closed") return "bg-success/10 text-success";
  if (key === "archived") return "bg-muted text-muted-foreground";
  if (key === "urgent") return "bg-destructive/10 text-destructive";
  if (key === "pending") return "bg-warning/10 text-warning";
  return "bg-info/10 text-info";
}

export function RecordsView({
  matters,
  documents,
  auditLogs,
  onViewMatter,
}: RecordsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState<MatterNoteRow[]>([]);
  const [tasks, setTasks] = useState<MatterTaskRow[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const closedMatters = useMemo(
    () => matters.filter((matterItem) => matterItem.status === "Closed"),
    [matters],
  );

  useEffect(() => {
    const matterIds = closedMatters.map((matterItem) => matterItem.id);
    if (matterIds.length === 0) {
      setNotes([]);
      setTasks([]);
      return;
    }

    let isMounted = true;
    setIsLoadingHistory(true);

    Promise.all([
      supabase
        .from("matter_notes")
        .select("id,matter_id,content,note_type,created_at")
        .in("matter_id", matterIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("matter_tasks")
        .select("id,matter_id,title,status,priority,due_date,completed_at,created_at")
        .in("matter_id", matterIds)
        .order("created_at", { ascending: false }),
    ])
      .then(([notesResult, tasksResult]) => {
        if (notesResult.error) throw notesResult.error;
        if (tasksResult.error) throw tasksResult.error;
        if (!isMounted) return;
        setNotes((notesResult.data || []) as MatterNoteRow[]);
        setTasks((tasksResult.data || []) as MatterTaskRow[]);
      })
      .catch((error) => {
        console.error("Failed to load case records:", error);
        if (isMounted) {
          setNotes([]);
          setTasks([]);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [closedMatters]);

  const notesByCase = useMemo(() => {
    const map = new Map<string, MatterNoteRow[]>();
    notes.forEach((note) => {
      map.set(note.matter_id, [...(map.get(note.matter_id) || []), note]);
    });
    return map;
  }, [notes]);

  const tasksByCase = useMemo(() => {
    const map = new Map<string, MatterTaskRow[]>();
    tasks.forEach((task) => {
      map.set(task.matter_id, [...(map.get(task.matter_id) || []), task]);
    });
    return map;
  }, [tasks]);

  const documentsByCase = useMemo(() => {
    const map = new Map<string, LegalDocument[]>();
    documents.forEach((document) => {
      if (!document.matterId) return;
      map.set(document.matterId, [...(map.get(document.matterId) || []), document]);
    });
    return map;
  }, [documents]);

  const auditLogsByCase = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    auditLogs.forEach((log) => {
      map.set(log.resourceId, [...(map.get(log.resourceId) || []), log]);
    });
    return map;
  }, [auditLogs]);

  const filteredMatters = closedMatters.filter((matterItem) => {
    const caseDocuments = documentsByCase.get(matterItem.id) || [];
    const caseNotes = notesByCase.get(matterItem.id) || [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      matterItem.suitNumber,
      matterItem.matterTitle,
      matterItem.adversaryParty,
      matterItem.assignedCounsel,
      matterItem.court,
      matterItem.status,
      matterItem.proceduralStage,
      ...caseDocuments.map((document) => document.name),
      ...caseNotes.slice(0, 3).map((note) => note.content),
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Total records</p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">{closedMatters.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Closed matters</p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">{closedMatters.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">History loaded</p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">
              {isLoadingHistory ? "..." : notes.length + tasks.length}
            </p>
          </div>
        </div>
        <div className="relative w-full xl:w-96">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search records, parties, notes, documents..."
            className="search-input w-full pl-10"
          />
        </div>
      </div>

      <div className="grid gap-3">
        {filteredMatters.map((matterItem) => {
          const caseDocuments = documentsByCase.get(matterItem.id) || [];
          const caseNotes = notesByCase.get(matterItem.id) || [];
          const caseTasks = tasksByCase.get(matterItem.id) || [];
          const caseAuditLogs = auditLogsByCase.get(matterItem.id) || [];
          const latestNote = caseNotes[0];
          const latestTask = caseTasks[0];
          const latestAudit = caseAuditLogs[0];
          const completedTasks = caseTasks.filter((task) => task.status === "completed").length;

          return (
            <article key={matterItem.id} className="case-modern-row items-stretch">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Archive className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {matterItem.suitNumber}
                  </p>
                  <span className={cn("status-pill", statusClass(matterItem.status))}>
                    {matterItem.status}
                  </span>
                  <span className="status-pill bg-background text-muted-foreground">
                    {matterItem.proceduralStage}
                  </span>
                </div>

                <h3 className="mt-1 line-clamp-2 text-base font-extrabold text-foreground">
                  {matterItem.matterTitle}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  vs. {matterItem.adversaryParty}
                </p>

                <div className="mt-3 grid gap-2 text-xs font-semibold text-muted-foreground md:grid-cols-3">
                  <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-background/70 px-2.5 py-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{matterItem.court}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Next date {formatDate(matterItem.nextHearing)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Filed {formatDate(matterItem.filedDate)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background/70 p-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Tasks
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {completedTasks}/{caseTasks.length} completed
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {latestTask ? latestTask.title : "No tasks recorded."}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/70 p-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      Notes
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {caseNotes.length} note{caseNotes.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {latestNote ? latestNote.content : "No notes recorded."}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/70 p-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      Documents
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {caseDocuments.length} document{caseDocuments.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {caseDocuments[0]?.name || "No documents attached."}
                    </p>
                  </div>
                </div>

                {latestAudit && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Latest audit: {latestAudit.details} on {formatDate(latestAudit.timestamp)}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-start">
                <button
                  onClick={() => onViewMatter?.(matterItem)}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-extrabold text-foreground transition-colors hover:bg-foreground hover:text-background"
                >
                  Full History
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filteredMatters.length === 0 && (
        <div className="surface-card flex flex-col items-center justify-center border-dashed py-12 text-center">
          <FolderSearch className="h-9 w-9 text-muted-foreground" />
          <h3 className="mt-3 text-base font-extrabold text-foreground">
            No records found
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Only matters marked Closed appear in records.
          </p>
        </div>
      )}
    </div>
  );
}
