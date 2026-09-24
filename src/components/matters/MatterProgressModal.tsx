import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Edit,
  FileText,
  Loader2,
  MessageSquareText,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { Button } from "@/components/ui/button";
import { StatusProgressBar } from "@/components/matters/StatusProgressBar";
import { formatPracticeArea, MatterNote, MatterTask, MatterTaskPriority, MatterTaskStatus } from "@/types/legal";
import { writeAuditLog } from "@/lib/audit";

interface MatterProgressModalProps {
  matterId: string;
  onClose: () => void;
}

interface CaseRow {
  id: string;
  title: string;
  description: string | null;
  created_by?: string | null;
  assigned_to?: string | null;
  created_at?: string | null;
  practice_area?: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface CaseMeta {
  description?: string;
  suitNumber?: string;
  adversaryParty?: string;
  proceduralStage?: string;
  assignedCounsel?: string;
  status?: string;
  priority?: string;
  caseType?: string;
  case_type?: string;
  court?: string;
  nextHearing?: string | null;
  filingDeadline?: string | null;
  dueDate?: string | null;
}

interface AuditEntry {
  id: string;
  action?: string | null;
  performed_by?: string | null;
  details?: string | null;
  created_at?: string | null;
}

interface NoteRow {
  id: string;
  matter_id: string;
  content: string;
  created_by: string | null;
  user_id: string | null;
  is_private: boolean;
  note_type: string;
  created_at: string;
}

interface TaskRow {
  id: string;
  matter_id: string;
  title: string;
  description: string | null;
  status: MatterTaskStatus;
  priority: MatterTaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentRow {
  id: string;
  name: string;
  type: string;
  version: string;
  uploaded_by: string;
  size: string;
  status: string;
  created_at: string;
}

interface CaseAccessRow {
  user_id: string;
}

interface ModalState {
  caseRecord: CaseRow | null;
  meta: CaseMeta;
  noteCount: number;
  documentCount: number;
  overdueDeadlineCount: number;
  activity: AuditEntry[];
  notes: MatterNote[];
  tasks: MatterTask[];
  profiles: ProfileRow[];
  documents: DocumentRow[];
}

const emptyState: ModalState = {
  caseRecord: null,
  meta: {},
  noteCount: 0,
  documentCount: 0,
  overdueDeadlineCount: 0,
  activity: [],
  notes: [],
  tasks: [],
  profiles: [],
  documents: [],
};

function parseMeta(description: string | null): CaseMeta {
  if (!description) return {};
  try {
    return JSON.parse(description) as CaseMeta;
  } catch {
    return { description };
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTodayInputValue() {
  const today = new Date();
  const offsetDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const directDateValue = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(directDateValue)) return directDateValue;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toTimeInputValue(value?: string | null) {
  if (!value || !value.includes("T")) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(11, 16);
}

function toSittingDateTimeValue(dateValue: string, timeValue: string) {
  if (!dateValue) return "";
  if (!timeValue) return dateValue;
  return new Date(`${dateValue}T${timeValue}`).toISOString();
}

function relativeTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function profileLabel(profile?: ProfileRow) {
  if (!profile) return "User";
  return profile.full_name || profile.email || "User";
}

function toNote(row: NoteRow, profiles: Map<string, string>): MatterNote {
  const authorId = row.created_by || row.user_id || undefined;
  return {
    id: row.id,
    matterId: row.matter_id,
    content: row.content,
    createdBy: authorId,
    authorName: authorId ? profiles.get(authorId) || "User" : "System",
    isPrivate: row.is_private,
    noteType: row.note_type,
    createdAt: new Date(row.created_at),
  };
}

function toTask(row: TaskRow, profiles: Map<string, string>): MatterTask {
  return {
    id: row.id,
    matterId: row.matter_id,
    title: row.title,
    description: row.description || undefined,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    assignedTo: row.assigned_to || undefined,
    assigneeName: row.assigned_to
      ? profiles.get(row.assigned_to) || "Assigned user"
      : "Unassigned",
    createdBy: row.created_by || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

export function MatterProgressModal({ matterId, onClose }: MatterProgressModalProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { viewingAsUser, isViewingAs } = useViewAs();
  const [state, setState] = useState<ModalState>(emptyState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "notes" | "tasks" | "documents" | "activity"
  >("overview");
  const [noteContent, setNoteContent] = useState("");
  const [taskInput, setTaskInput] = useState({
    title: "",
    description: "",
    dueDate: "",
    assignedTo: "",
    priority: "normal" as MatterTaskPriority,
  });
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [sittingDate, setSittingDate] = useState("");
  const [sittingTime, setSittingTime] = useState("");
  const [isSavingSittingDate, setIsSavingSittingDate] = useState(false);

  const fetchCaseProgress = useCallback(async () => {
    setError(null);
    const today = new Date().toISOString().slice(0, 10);

    const caseQuery = supabase
      .from("matters")
      .select("id,title,description,created_by,assigned_to,created_at,practice_area")
      .eq("id", matterId)
      .single();
    const notesQuery = supabase
      .from("matter_notes")
      .select("id,matter_id,content,created_by,user_id,is_private,note_type,created_at")
      .eq("matter_id", matterId)
      .order("created_at", { ascending: false });
    const tasksQuery = supabase
      .from("matter_tasks")
      .select("id,matter_id,title,description,status,priority,due_date,assigned_to,created_by,completed_at,created_at,updated_at")
      .eq("matter_id", matterId)
      .order("created_at", { ascending: false });
    const documentsQuery = supabase
      .from("documents")
      .select("id,name,type,version,uploaded_by,size,status,created_at")
      .eq("matter_id", matterId)
      .order("created_at", { ascending: false });
    const deadlinesQuery = supabase
      .from("deadlines")
      .select("id", { count: "exact", head: true })
      .eq("matter_id", matterId)
      .lt("due_date", today)
      .neq("status", "completed");
    const activityQuery = supabase
      .from("audit_logs")
      .select("id,action,performed_by,details,created_at")
      .eq("target_id", matterId)
      .order("created_at", { ascending: false })
      .limit(8);
    const profilesQuery = supabase
      .from("profiles")
      .select("id,full_name,email");
    const accessQuery = supabase
      .from("matter_access")
      .select("user_id")
      .eq("matter_id", matterId);

    const [
      caseResult,
      notesResult,
      tasksResult,
      documentsResult,
      deadlinesResult,
      activityResult,
      profilesResult,
      accessResult,
    ] =
      await Promise.all([
        caseQuery,
        notesQuery,
        tasksQuery,
        documentsQuery,
        deadlinesQuery,
        activityQuery,
        profilesQuery,
        accessQuery,
      ]);

    if (caseResult.error) throw caseResult.error;
    const caseRecord = caseResult.data as CaseRow;
    if (
      viewingAsUser &&
      viewingAsUser.role !== "managing_partner" &&
      viewingAsUser.role !== "operations_manager"
    ) {
      const accessRows = (accessResult.data || []) as CaseAccessRow[];
      const canViewedUserAccessCase =
        caseRecord.assigned_to === viewingAsUser.id ||
        accessRows.some((access) => access.user_id === viewingAsUser.id);

      if (!canViewedUserAccessCase) {
        throw new Error("This case is not available to the selected user.");
      }
    }

    const profileRows = (profilesResult.data || []) as ProfileRow[];
    const profileMap = new Map(
      profileRows.map((profileRow) => [profileRow.id, profileLabel(profileRow)]),
    );
    if (user) {
      profileMap.set(user.id, profile?.full_name || profile?.email || user.email || "You");
    }
    const notes = ((notesResult.data || []) as NoteRow[]).map((row) =>
      toNote(row, profileMap),
    );
    const tasks = ((tasksResult.data || []) as TaskRow[]).map((row) =>
      toTask(row, profileMap),
    );

    setState({
      caseRecord,
      meta: parseMeta(caseRecord.description),
      noteCount: notes.length,
      documentCount: (documentsResult.data || []).length,
      overdueDeadlineCount: deadlinesResult.count ?? 0,
      activity: (activityResult.data || []) as AuditEntry[],
      notes,
      tasks,
      profiles: profileRows,
      documents: (documentsResult.data || []) as DocumentRow[],
    });
  }, [matterId, profile?.email, profile?.full_name, user, viewingAsUser]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchCaseProgress()
      .catch((fetchError) => {
        console.error("Failed to fetch case progress:", fetchError);
        if (isMounted) setError("Unable to load this case progress right now.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const channel = supabase
      .channel(`case-progress-${matterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matters",
          filter: `id=eq.${matterId}`,
        },
        () => {
          fetchCaseProgress().catch((refreshError) => {
            console.error("Failed to refresh case progress:", refreshError);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matter_notes",
          filter: `matter_id=eq.${matterId}`,
        },
        () => {
          fetchCaseProgress().catch((refreshError) => {
            console.error("Failed to refresh case notes:", refreshError);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matter_tasks",
          filter: `matter_id=eq.${matterId}`,
        },
        () => {
          fetchCaseProgress().catch((refreshError) => {
            console.error("Failed to refresh case tasks:", refreshError);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `matter_id=eq.${matterId}`,
        },
        () => {
          fetchCaseProgress().catch((refreshError) => {
            console.error("Failed to refresh case documents:", refreshError);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "audit_logs",
          filter: `target_id=eq.${matterId}`,
        },
        () => {
          fetchCaseProgress().catch((refreshError) => {
            console.error("Failed to refresh case activity:", refreshError);
          });
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [matterId, fetchCaseProgress]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setSittingDate(toDateInputValue(state.meta.nextHearing));
    setSittingTime(toTimeInputValue(state.meta.nextHearing));
  }, [state.meta.nextHearing]);

  const caseRecord = state.caseRecord;
  const caseNumber = state.caseRecord?.practice_area === "litigation"
    ? state.meta.suitNumber || `Matter ${matterId.slice(0, 8)}`
    : state.caseRecord?.title || `Matter ${matterId.slice(0, 8)}`;
  const isLitigation = state.caseRecord?.practice_area === "litigation";
  const matterTitle = caseRecord?.title || "Untitled case";
  const isReadOnly = isViewingAs;
  const canEdit = Boolean(user && caseRecord && !isReadOnly);
  const todayInputValue = getTodayInputValue();
  const openTaskCount = state.tasks.filter((task) => task.status !== "completed").length;
  const completedTaskCount = state.tasks.filter((task) => task.status === "completed").length;
  const taskProgress =
    state.tasks.length === 0
      ? 0
      : Math.round((completedTaskCount / state.tasks.length) * 100);
  const activeTasks = state.tasks.filter((task) => task.status !== "completed");
  const completedTasks = state.tasks.filter((task) => task.status === "completed");
  const assigneeOptions = useMemo(() => {
    const options = state.profiles.map((profileRow) => ({
      id: profileRow.id,
      label: profileLabel(profileRow),
    }));
    if (user && !options.some((option) => option.id === user.id)) {
      options.unshift({
        id: user.id,
        label: profile?.full_name || profile?.email || user.email || "You",
      });
    }
    return options;
  }, [profile?.email, profile?.full_name, state.profiles, user]);
  const timelineItems = useMemo(() => {
    const noteItems = state.notes.slice(0, 8).map((note) => ({
      id: `note-${note.id}`,
      title: note.noteType === "system" ? "System note" : "Note added",
      detail: note.content,
      actor: note.authorName,
      date: note.createdAt,
    }));
    const taskItems = state.tasks.slice(0, 8).map((task) => ({
      id: `task-${task.id}`,
      title: task.status === "completed" ? "Task completed" : "Task assigned",
      detail: task.title,
      actor: task.assigneeName,
      date: task.completedAt || task.createdAt,
    }));
    const auditItems = state.activity.map((item) => ({
      id: `audit-${item.id}`,
      title: item.action || "Case activity",
      detail: item.details || "Case updated",
      actor: item.performed_by || "System",
      date: item.created_at ? new Date(item.created_at) : new Date(),
    }));
    return [...noteItems, ...taskItems, ...auditItems]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 12);
  }, [state.activity, state.notes, state.tasks]);

  const goTo = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleAddNote = async () => {
    if (isReadOnly) return;
    if (!user || !noteContent.trim()) return;
    setIsSavingNote(true);
    try {
      const content = noteContent.trim();
      const { error: noteError } = await supabase.from("matter_notes").insert({
        matter_id: matterId,
        content,
        created_by: user.id,
        user_id: user.id,
        is_private: false,
        note_type: "note",
      });
      if (noteError) throw noteError;
      await writeAuditLog({
        action: "CREATE",
        performedBy: user.id,
        targetId: matterId,
        resource: "Case Note",
        details: `Added note to ${caseNumber}`,
      });
      setNoteContent("");
      await fetchCaseProgress();
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleAddTask = async () => {
    if (isReadOnly) return;
    if (!user || !taskInput.title.trim()) return;
    setIsSavingTask(true);
    try {
      const { error: taskError } = await supabase.from("matter_tasks").insert({
        matter_id: matterId,
        title: taskInput.title.trim(),
        description: taskInput.description.trim() || null,
        due_date: taskInput.dueDate || null,
        assigned_to: taskInput.assignedTo || user.id,
        priority: taskInput.priority,
        status: "open",
        created_by: user.id,
      });
      if (taskError) throw taskError;
      await writeAuditLog({
        action: "CREATE",
        performedBy: user.id,
        targetId: matterId,
        resource: "Task",
        details: `Assigned task: ${taskInput.title.trim()}`,
      });
      setTaskInput({
        title: "",
        description: "",
        dueDate: "",
        assignedTo: "",
        priority: "normal",
      });
      await fetchCaseProgress();
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleTaskStatusChange = async (task: MatterTask, status: MatterTaskStatus) => {
    if (isReadOnly) return;
    if (!user) return;
    const { error: taskError } = await supabase
      .from("matter_tasks")
      .update({
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);
    if (taskError) throw taskError;
    await writeAuditLog({
      action: "UPDATE",
      performedBy: user.id,
      targetId: matterId,
      resource: "Task",
      details: `Marked task "${task.title}" as ${status.replace("_", " ")}`,
    });
    await fetchCaseProgress();
  };

  const handleSaveSittingDate = async () => {
    if (isReadOnly) return;
    if (!user || !caseRecord || !sittingDate) return;
    if (sittingDate < todayInputValue) {
      setError("Choose today or a future sitting date.");
      return;
    }
    const nextSittingValue = toSittingDateTimeValue(sittingDate, sittingTime);
    if (sittingTime && new Date(nextSittingValue).getTime() < Date.now()) {
      setError("Choose a future sitting time.");
      return;
    }

    setIsSavingSittingDate(true);
    setError(null);
    try {
      const updatedMeta: CaseMeta = {
        ...state.meta,
        nextHearing: nextSittingValue,
      };
      const { error: caseError } = await supabase
        .from("matters")
        .update({
          description: JSON.stringify(updatedMeta),
        })
        .eq("id", matterId);
      if (caseError) throw caseError;
      await writeAuditLog({
        action: "UPDATE",
        performedBy: user.id,
        targetId: matterId,
        resource: "Case",
        details: `Set sitting date for ${caseNumber} to ${formatDateTime(updatedMeta.nextHearing)}`,
      });
      await fetchCaseProgress();
    } finally {
      setIsSavingSittingDate(false);
    }
  };

  const statCards = useMemo(
    () => [
      {
        label: "Notes",
        value: state.noteCount,
        icon: MessageSquareText,
        tab: "notes" as const,
      },
      {
        label: "Documents",
        value: state.documentCount,
        icon: FileText,
        tab: "documents" as const,
      },
      {
        label: "Deadlines overdue",
        value: state.overdueDeadlineCount,
        icon: CalendarDays,
        path: `/app/calendar?matter=${matterId}`,
      },
      {
        label: "Open tasks",
        value: openTaskCount,
        icon: ClipboardList,
        tab: "tasks" as const,
      },
    ],
    [matterId, openTaskCount, state.documentCount, state.noteCount, state.overdueDeadlineCount],
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Case progress"
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-card shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card/95 p-5 backdrop-blur">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted-foreground">
              {caseNumber}
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
              {matterTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close case progress"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          {isLoading && (
            <div className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading case progress...
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!isLoading && !error && caseRecord && (
            <>
              <StatusProgressBar status={state.meta.status} />
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-foreground">Task progress</span>
                  <span className="text-muted-foreground">
                    {completedTaskCount} of {state.tasks.length} complete
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded bg-muted">
                  <div
                    className={`h-full rounded transition-all duration-500 ${
                      taskProgress === 100 ? "bg-success" : "bg-primary"
                    }`}
                    style={{ width: `${taskProgress}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border border-border bg-background p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Priority: </span>
                  <strong className="uppercase text-foreground">
                    {state.meta.priority || "Normal"}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Practice area: </span>
                  <strong className="capitalize text-foreground">
                    {formatPracticeArea(state.caseRecord?.practice_area)}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Assigned: </span>
                  <strong className="text-foreground">
                    {state.meta.assignedCounsel || "Unassigned"}
                  </strong>
                </div>
                {isLitigation && <div>
                  <span className="text-muted-foreground">Sitting Date: </span>
                  <strong className="text-foreground">{formatDateTime(state.meta.nextHearing)}</strong>
                  {canEdit && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
                      <input
                        type="date"
                        min={todayInputValue}
                        value={sittingDate}
                        onChange={(event) => setSittingDate(event.target.value)}
                        className="min-h-10 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                        aria-label="Future sitting date"
                      />
                      <input
                        type="time"
                        value={sittingTime}
                        onChange={(event) => setSittingTime(event.target.value)}
                        className="min-h-10 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                        aria-label="Sitting time"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveSittingDate}
                        disabled={
                          isSavingSittingDate ||
                          !sittingDate ||
                          (sittingDate === toDateInputValue(state.meta.nextHearing) &&
                            sittingTime === toTimeInputValue(state.meta.nextHearing))
                        }
                        className="gap-2"
                      >
                        {isSavingSittingDate ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save
                      </Button>
                    </div>
                  )}
                </div>}
                {isLitigation && <div>
                  <span className="text-muted-foreground">Filing Date: </span>
                  <strong className="text-foreground">
                    {formatDate(state.meta.filingDeadline || state.meta.dueDate)}
                  </strong>
                </div>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <button
                      key={stat.label}
                      onClick={() =>
                        "tab" in stat ? setActiveTab(stat.tab) : goTo(stat.path)
                      }
                      className="rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-accent/60 hover:bg-accent/5"
                    >
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Icon className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wide">
                          {stat.label}
                        </span>
                      </div>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {stat.value}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 overflow-x-auto border-b border-border">
                {[
                  { id: "notes", label: "Notes" },
                  { id: "documents", label: "Documents" },
                  { id: "tasks", label: "Tasks" },
                  { id: "activity", label: "Activity" },
                  { id: "overview", label: "Overview" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                      activeTab === tab.id
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
              <section className="rounded-lg border border-border bg-background">
                <div className="border-b border-border p-4">
                  <h3 className="font-semibold text-foreground">
                    Matter Summary
                  </h3>
                </div>
                <div className="grid gap-4 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Description</p>
                    <p className="mt-1 text-foreground">
                      {state.meta.description || "No description recorded."}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Latest update</p>
                    <p className="mt-1 text-foreground">
                      {timelineItems[0]?.detail || "No activity recorded yet."}
                    </p>
                  </div>
                </div>
              </section>
              )}

              {activeTab === "notes" && (
                <section className="rounded-lg border border-border bg-background">
                  <div className="border-b border-border p-4">
                    <h3 className="font-semibold text-foreground">Matter Notes</h3>
                  </div>
                  {!isReadOnly && (
                    <div className="space-y-3 p-4">
                      <textarea
                        value={noteContent}
                        onChange={(event) => setNoteContent(event.target.value)}
                        rows={3}
                        placeholder="Add an internal case note..."
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <Button
                        onClick={handleAddNote}
                        disabled={isSavingNote || !noteContent.trim()}
                        className="gap-2"
                      >
                        {isSavingNote ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Add Note
                      </Button>
                    </div>
                  )}
                  <div className="divide-y divide-border">
                    {state.notes.length === 0 && (
                      <p className="p-4 text-sm text-muted-foreground">
                        No notes have been added to this case yet.
                      </p>
                    )}
                    {state.notes.map((note) => (
                      <div key={note.id} className="p-4 text-sm">
                        <p className="whitespace-pre-wrap text-foreground">{note.content}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {note.authorName}
                          <span className="mx-1">-</span>
                          {relativeTime(note.createdAt.toISOString())}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {activeTab === "tasks" && (
                <section className="rounded-lg border border-border bg-background">
                  <div className="border-b border-border p-4">
                    <h3 className="font-semibold text-foreground">Task Assignment</h3>
                    <div className="mt-3 h-2 overflow-hidden rounded bg-muted">
                      <div
                        className={`h-full rounded transition-all duration-500 ${
                          taskProgress === 100 ? "bg-success" : "bg-primary"
                        }`}
                        style={{ width: `${taskProgress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {completedTaskCount} of {state.tasks.length} tasks complete
                    </p>
                  </div>
                  {!isReadOnly && (
                    <div className="grid gap-3 p-4 md:grid-cols-2">
                      <input
                        value={taskInput.title}
                        onChange={(event) =>
                          setTaskInput((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="Task title"
                        className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <select
                        value={taskInput.assignedTo}
                        onChange={(event) =>
                          setTaskInput((current) => ({ ...current, assignedTo: event.target.value }))
                        }
                        className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                      >
                        <option value="">Assign to me</option>
                        {assigneeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={taskInput.dueDate}
                        onChange={(event) =>
                          setTaskInput((current) => ({ ...current, dueDate: event.target.value }))
                        }
                        className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <select
                        value={taskInput.priority}
                        onChange={(event) =>
                          setTaskInput((current) => ({
                            ...current,
                            priority: event.target.value as MatterTaskPriority,
                          }))
                        }
                        className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                      >
                        <option value="low">Low priority</option>
                        <option value="normal">Normal priority</option>
                        <option value="high">High priority</option>
                        <option value="urgent">Urgent priority</option>
                      </select>
                      <textarea
                        value={taskInput.description}
                        onChange={(event) =>
                          setTaskInput((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        rows={3}
                        placeholder="Task details"
                        className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary md:col-span-2"
                      />
                      <Button
                        onClick={handleAddTask}
                        disabled={isSavingTask || !taskInput.title.trim()}
                        className="gap-2 md:w-fit"
                      >
                        {isSavingTask ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Assign Task
                      </Button>
                    </div>
                  )}
                  <div className="divide-y divide-border">
                    {activeTasks.length === 0 && (
                      <p className="p-4 text-sm text-muted-foreground">
                        No active tasks have been assigned for this case.
                      </p>
                    )}
                    {activeTasks.map((task) => (
                      <div key={task.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">{task.title}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                              {task.priority}
                            </span>
                          </div>
                          {task.description && (
                            <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">
                            Assigned to {task.assigneeName}
                            {task.dueDate && (
                              <>
                                <span className="mx-1">-</span>
                                Due {formatDate(task.dueDate.toISOString())}
                              </>
                            )}
                          </p>
                        </div>
                        {!isReadOnly && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTaskStatusChange(task, "completed")}
                              className="gap-2"
                            >
                              <Circle className="h-4 w-4" />
                              Mark Done
                            </Button>
                            {task.createdBy === user?.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (isReadOnly) return;
                                  const { error: deleteError } = await supabase
                                    .from("matter_tasks")
                                    .update({ deleted_at: new Date().toISOString() })
                                    .eq("id", task.id);
                                  if (deleteError) throw deleteError;
                                  await fetchCaseProgress();
                                }}
                                className="gap-2 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {completedTasks.length > 0 && (
                    <details className="border-t border-border">
                      <summary className="cursor-pointer p-4 text-sm font-semibold text-foreground">
                        Completed tasks ({completedTasks.length})
                      </summary>
                      <div className="divide-y divide-border">
                        {completedTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-start sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-muted-foreground line-through">
                                {task.title}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Completed {relativeTime(task.completedAt?.toISOString())}
                              </p>
                            </div>
                            {!isReadOnly && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTaskStatusChange(task, "open")}
                                className="gap-2"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Reopen
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </section>
              )}

              {activeTab === "documents" && (
                <section className="rounded-lg border border-border bg-background">
                  <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                    <div>
                      <h3 className="font-semibold text-foreground">Matter Documents</h3>
                      <p className="text-xs text-muted-foreground">
                        {state.documentCount >= 2
                          ? `${state.documentCount} documents are attached to this case.`
                          : `${state.documentCount} document${state.documentCount === 1 ? "" : "s"} attached.`}
                      </p>
                    </div>
                    {state.documentCount >= 2 && (
                      <span className="rounded-full bg-info/10 px-3 py-1 text-xs font-bold text-info">
                        Multiple documents
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-border">
                    {state.documents.length === 0 && (
                      <p className="p-4 text-sm text-muted-foreground">
                        No documents have been attached to this case yet.
                      </p>
                    )}
                    {state.documents.map((document) => (
                      <div
                        key={document.id}
                        className="grid gap-3 p-4 text-sm sm:grid-cols-[1fr_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {document.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {document.type} - v{document.version} - {document.size}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Uploaded by {document.uploaded_by} on{" "}
                            {formatDate(document.created_at)}
                          </p>
                        </div>
                        <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                          {document.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {activeTab === "activity" && (
                <section className="rounded-lg border border-border bg-background">
                  <div className="border-b border-border p-4">
                      <h3 className="font-semibold text-foreground">Matter Activity</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {timelineItems.length === 0 && (
                      <p className="p-4 text-sm text-muted-foreground">
                        No timeline activity has been recorded for this case.
                      </p>
                    )}
                    {timelineItems.map((item) => (
                      <div key={item.id} className="p-4 text-sm">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-foreground">{item.detail}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {item.actor}
                          <span className="mx-1">-</span>
                          {relativeTime(item.date.toISOString())}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border p-5 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => goTo(`/app/documents?matter=${matterId}`)}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            View Documents
          </Button>
          <Button
            variant="outline"
            onClick={() => goTo(`/app/calendar?matter=${matterId}`)}
            className="gap-2"
          >
            <CalendarDays className="h-4 w-4" />
            View in Calendar
          </Button>
          {canEdit && (
            <Button onClick={() => goTo(`/app/matters/${matterId}/edit`)} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
