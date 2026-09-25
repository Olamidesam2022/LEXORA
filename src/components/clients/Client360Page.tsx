import { useEffect, useState } from "react";
import { BriefcaseBusiness, ChevronRight, FileText, ReceiptText, Search, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
import { AlignedList, AlignedListRow } from "@/components/ui/aligned-list";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPracticeArea } from "@/types/legal";

type ClientRow = { id: string; display_name: string; legal_name?: string | null; email?: string | null; phone?: string | null; address?: string | null; notes?: string | null; client_type: string; assigned_to?: string | null; created_at?: string };
type ClientRecord = {
  client: ClientRow;
  matters: Array<{ id: string; title: string; description: string | null; practice_area: string; matter_status: string; closed_at: string | null; created_at: string; assigned_to: string | null }>;
  documents: Array<{ id: string; name: string; type: string; matter_id: string | null; version: string; status: string; created_at: string; updated_at: string }>;
  fee_notes: Array<{ id: string; matter_id: string; reference: string; description: string; amount: number; currency: string; issued_at: string; due_at: string | null; status: string }>;
  payments: Array<{ id: string; matter_id: string; amount: number; currency: string; paid_at: string; reference: string | null; fee_note_id: string | null; payment_method: string | null; proof_document_id: string | null }>;
  matter_notes: Array<{ id: string; matter_id: string; content: string; note_type: string; is_private: boolean; created_at: string }>;
  matter_tasks: Array<{ id: string; matter_id: string; title: string; description: string | null; status: string; priority: string; due_date: string | null; created_at: string }>;
  deadlines: Array<{ id: string; matter_id: string; title: string; due_date: string; status: string }>;
  document_versions: Array<{ id: string; document_id: string; version_number: number; content_sha256: string; size_bytes: number; mime_type: string | null; created_at: string }>;
  recent_activity: Array<{ id: string; action: string; occurred_at: string; subject_type: string; to_status?: string | null }>;
  summary: { active_matter_count: number; outstanding_by_currency: Record<string, number>; document_count: number };
};

export function Client360Page({ initialClientId }: { initialClientId?: string | null }) {
  const { user, role } = useAuth();
  const { users: profiles } = useProfiles();
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [record, setRecord] = useState<ClientRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientLegalName, setNewClientLegalName] = useState("");
  const [newClientType, setNewClientType] = useState("organization");

  async function api(path: string) {
    const { data } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
    const response = await fetch(path, { headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload;
  }

  useEffect(() => {
    let alive = true;
    if (!user) { setClients([]); return; }
    setLoadingClients(true);
    const search = query.trim();
    const timer = window.setTimeout(() => {
      api(`/api/clients${search ? `?search=${encodeURIComponent(search)}` : ""}`)
        .then((payload) => { if (alive) setClients(payload.clients || []); })
        .catch((reason: Error) => { if (alive) setError(reason.message); })
        .finally(() => { if (alive) setLoadingClients(false); });
    }, search ? 180 : 0);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query, user?.id]);

  useEffect(() => {
    if (!initialClientId || !user) return;
    setLoading(true);
    api(`/api/clients/${initialClientId}/360`)
      .then((payload) => setRecord(payload))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [initialClientId, user?.id]);

  const selectClient = async (client: ClientRow) => {
    setError(""); setLoading(true);
    try { setRecord(await api(`/api/clients/${client.id}/360`)); }
    catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  };

  const assignClient = async (assignedTo: string | null) => {
    if (!record) return;
    setError("");
    try {
      const { data } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      const response = await fetch(`/api/clients/${record.client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ assigned_to: assignedTo }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not assign this client");
      setRecord((current) => current ? { ...current, client: payload.client } : current);
      setClients((current) => current.map((client) => client.id === payload.client.id ? { ...client, ...payload.client } : client));
    } catch (reason) {
      setError((reason as Error).message);
    }
  };

  const updateClientDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    try {
      const { data } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      const response = await fetch(`/api/clients/${record.client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify(values),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update this client");
      setRecord((current) => current ? { ...current, client: payload.client } : current);
      setClients((current) => current.map((client) => client.id === payload.client.id ? { ...client, ...payload.client } : client));
      setEditingClient(false);
    } catch (reason) {
      setError((reason as Error).message);
    }
  };

  const createClient = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const { data } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ display_name: newClientName, legal_name: newClientLegalName || null, client_type: newClientType }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create client");
      setShowCreate(false); setQuery(""); setRecord(null);
      setNewClientName(""); setNewClientLegalName(""); setNewClientType("organization");
      const listPayload = await api("/api/clients");
      setClients(listPayload.clients || []);
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  };

  return <section className="space-y-6">
    {/* <header>
      <h1 className="text-2xl font-semibold text-foreground">Client 360</h1>
    </header> */}
    {!record && <>
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client name, legal name, or email" className="h-12 pl-10" />
      </div>
      <section className="w-full overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-semibold">Clients</h2><span className="text-sm text-muted-foreground">{clients.length} shown</span>
        </div>
        {loadingClients ? <p className="px-5 py-6 text-sm text-muted-foreground">Loading clients…</p> : clients.length ? <AlignedList className="client-directory-list">
          {clients.map((client) => <AlignedListRow
            key={client.id}
            avatar={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold uppercase text-primary">{client.display_name.slice(0, 2)}</span>}
            primary={client.display_name}
            secondary={client.legal_name || client.email || client.client_type}
            tag={<Badge variant="outline" className="max-w-full truncate">{client.client_type}</Badge>}
            metric="—"
            date={client.created_at ? new Date(client.created_at).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
            action={<ChevronRight className="h-4 w-[18px] text-muted-foreground" />}
            onClick={() => void selectClient(client)}
            ariaLabel={`Open client ${client.display_name}`}
            disableHover
          />)}
        </AlignedList> : <p className="px-5 py-6 text-sm text-muted-foreground">{query ? "No matching clients found." : "No clients yet."}</p>}
      </section>
    </>}
    {role !== "legal_officer" && <button onClick={() => setShowCreate((value) => !value)} className="text-sm font-semibold text-primary hover:underline">{showCreate ? "Cancel new client" : "+ Add client"}</button>}
    {showCreate && role !== "legal_officer" && <form onSubmit={createClient} className="grid w-full gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 xl:grid-cols-4">
      <label className="grid gap-2 text-sm font-semibold text-foreground">Client name
        <Input required value={newClientName} onChange={(event) => setNewClientName(event.target.value)} placeholder="Client display name" />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-foreground">Registered legal name
        <Input value={newClientLegalName} onChange={(event) => setNewClientLegalName(event.target.value)} placeholder="Optional legal name" />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-foreground">Client type
        <select value={newClientType} onChange={(event) => setNewClientType(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal">
          <option value="organization">Organization</option>
          <option value="individual">Individual</option>
          <option value="other">Other</option>
        </select>
      </label>
      <button className="h-10 self-end rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create client</button>
    </form>}
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {loading && <p className="text-sm text-muted-foreground">Loading client record…</p>}
    {record && <>
      <button type="button" onClick={() => { setRecord(null); setEditingClient(false); setError(""); }} className="text-sm font-semibold text-primary hover:underline">← Back to clients</button>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><h2 className="text-2xl font-semibold">{record.client.display_name}</h2><p className="mt-1 text-sm text-muted-foreground">{record.client.legal_name || record.client.client_type}</p>{record.client.notes && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{record.client.notes}</p>}
            {(role === "operations_manager" || role === "managing_partner") && <label className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium">Assigned Legal Officer
              <select value={record.client.assigned_to || ""} onChange={(event) => void assignClient(event.target.value || null)} className="h-9 rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Unassigned</option>
                {profiles.filter((profile) => profile.role === "legal_officer" && profile.status === "approved").map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </label>}
          </div>
          <div className="flex items-start gap-3">
            <div className="text-sm text-muted-foreground">{record.client.email}<br />{record.client.phone}{record.client.address && <><br />{record.client.address}</>}</div>
            {(role === "operations_manager" || role === "managing_partner" || record.client.assigned_to === user?.id) && <button type="button" onClick={() => setEditingClient((value) => !value)} className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">{editingClient ? "Cancel" : "Edit client"}</button>}
          </div>
        </div>
        {editingClient && <form onSubmit={updateClientDetails} className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
          <Input required name="display_name" defaultValue={record.client.display_name} placeholder="Client display name" />
          <Input name="legal_name" defaultValue={record.client.legal_name || ""} placeholder="Registered legal name" />
          <Input name="email" type="email" defaultValue={record.client.email || ""} placeholder="Email" />
          <Input name="phone" defaultValue={record.client.phone || ""} placeholder="Phone" />
          <Input name="address" defaultValue={record.client.address || ""} placeholder="Address" />
          <select name="client_type" defaultValue={record.client.client_type} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="organization">Organization</option><option value="individual">Individual</option><option value="other">Other</option></select>
          <textarea name="notes" defaultValue={record.client.notes || ""} placeholder="Client notes" className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2"><button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save changes</button><button type="button" onClick={() => setEditingClient(false)} className="rounded-md border border-border px-4 py-2 text-sm font-semibold">Cancel</button></div>
        </form>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={BriefcaseBusiness} label="Active matters" value={String(record.summary.active_matter_count)} />
        <Stat icon={Wallet} label="Outstanding balance" value={Object.entries(record.summary.outstanding_by_currency).map(([currency, amount]) => `${currency} ${Number(amount).toLocaleString()}`).join(" · ") || "0"} />
        <Stat icon={FileText} label="Documents on file" value={String(record.summary.document_count)} />
        <Stat icon={ReceiptText} label="Fee notes" value={String(record.fee_notes.length)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={`Matters (${record.matters.length})`}>{record.matters.map((matter) => <Row key={matter.id} title={matter.title} detail={`${formatPracticeArea(matter.practice_area)} · ${matter.matter_status} · Opened ${new Date(matter.created_at).toLocaleDateString()}${matter.closed_at ? ` · Closed ${new Date(matter.closed_at).toLocaleDateString()}` : ""}${matter.assigned_to ? " · Assigned" : " · Unassigned"}`}><Badge variant="outline">{matter.matter_status}</Badge></Row>)}{record.matters.length === 0 && <Empty />}</Panel>
        <Panel title="Documents">{record.documents.map((document) => <Row key={document.id} title={document.name} detail={`${document.type} · ${new Date(document.created_at).toLocaleDateString()}`}><Badge variant="outline">{document.status.replaceAll("_", " ")}</Badge></Row>)}{record.documents.length === 0 && <Empty />}</Panel>
        <Panel title="Billing">{record.fee_notes.map((fee) => <Row key={fee.id} title={`${fee.reference} · ${fee.description}`} detail={`${fee.currency} ${Number(fee.amount).toLocaleString()}`}><Badge variant="outline">{fee.status}</Badge></Row>)}{record.payments.map((payment) => <Row key={payment.id} title={payment.reference || "Payment received"} detail={`${payment.currency} ${Number(payment.amount).toLocaleString()} · ${new Date(payment.paid_at).toLocaleDateString()}`}><span className="text-xs text-muted-foreground">{payment.proof_document_id ? "Proof on file" : "No proof attached"}</span></Row>)}{record.fee_notes.length + record.payments.length === 0 && <Empty />}</Panel>
        <Panel title="Recent activity">{record.recent_activity.map((item) => <Row key={`${item.subject_type}-${item.id}`} title={item.action.replaceAll("_", " ")} detail={new Date(item.occurred_at).toLocaleString()}><span className="text-xs capitalize text-muted-foreground">{item.subject_type}</span></Row>)}{record.recent_activity.length === 0 && <Empty />}</Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={`Matter notes (${record.matter_notes.length})`}>
          {record.matter_notes.map((note) => <Row key={note.id} title={clientMatterTitle(record, note.matter_id)} detail={`${note.note_type}${note.is_private ? " · Private" : ""} · ${new Date(note.created_at).toLocaleString()} · ${note.content}`} />)}
          {record.matter_notes.length === 0 && <Empty />}
        </Panel>
        <Panel title={`Tasks (${record.matter_tasks.length})`}>
          {record.matter_tasks.map((task) => <Row key={task.id} title={task.title} detail={`${clientMatterTitle(record, task.matter_id)} · ${task.priority} priority${task.due_date ? ` · Due ${new Date(task.due_date).toLocaleDateString()}` : ""}${task.description ? ` · ${task.description}` : ""}`}><Badge variant="outline">{task.status.replaceAll("_", " ")}</Badge></Row>)}
          {record.matter_tasks.length === 0 && <Empty />}
        </Panel>
        <Panel title={`Deadlines (${record.deadlines.length})`}>
          {record.deadlines.map((deadline) => <Row key={deadline.id} title={deadline.title} detail={`${clientMatterTitle(record, deadline.matter_id)} · ${new Date(deadline.due_date).toLocaleDateString()}`}><Badge variant="outline">{deadline.status}</Badge></Row>)}
          {record.deadlines.length === 0 && <Empty />}
        </Panel>
        <Panel title={`Document versions (${record.document_versions.length})`}>
          {record.document_versions.map((version) => <Row key={version.id} title={`${record.documents.find((document) => document.id === version.document_id)?.name || "Document"} · Version ${version.version_number}`} detail={`${version.mime_type || "File"} · ${Number(version.size_bytes).toLocaleString()} bytes · ${new Date(version.created_at).toLocaleString()} · SHA-256 ${version.content_sha256}`} />)}
          {record.document_versions.length === 0 && <Empty />}
        </Panel>
      </div>
    </>}
  </section>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof BriefcaseBusiness; label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><p className="mt-3 text-2xl font-semibold text-foreground">{value}</p></div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-4 shadow-sm"><h3 className="mb-2 text-lg font-semibold">{title}</h3><AlignedList>{children}</AlignedList></section>;
}
function Row({ title, detail, children }: { title: string; detail: string; children?: React.ReactNode }) {
  return <AlignedListRow avatar={<span className="h-9 w-9 rounded-full bg-primary/10" />} primary={title} secondary={detail} tag={children} />;
}
function Empty() { return <p className="aligned-list-empty py-4 text-sm text-muted-foreground">Nothing recorded yet.</p>; }
function clientMatterTitle(record: ClientRecord, matterId: string) { return record.matters.find((matter) => matter.id === matterId)?.title || "Matter"; }
