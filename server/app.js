import crypto from "node:crypto";
import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json({ limit: "60mb" }));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const allowedRoles = new Set(["legal_officer", "operations_manager", "managing_partner"]);
const managerRoles = new Set(["operations_manager", "managing_partner"]);
const jsonError = (res, status, message) => res.status(status).json({ error: message });

async function authenticate(req, res, next) {
  if (!supabaseUrl || !anonKey) return jsonError(res, 500, "LEXORA API credentials are not configured");
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonError(res, 401, "A Supabase access token is required");
  const userDb = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userDb.auth.getUser(token);
  if (authError || !authData.user) return jsonError(res, 401, "The access token is invalid or expired");
  const { data: profile, error: profileError } = await userDb
    .from("profiles").select("id,role,status,full_name,email").eq("id", authData.user.id).maybeSingle();
  if (profileError) return jsonError(res, 500, profileError.message);
  if (!profile || profile.status !== "approved" || !allowedRoles.has(profile.role)) return jsonError(res, 403, "An approved LEXORA profile is required");
  req.profile = profile;
  req.db = userDb;
  req.adminDb = supabaseAdmin;
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => roles.includes(req.profile.role)
    ? next()
    : jsonError(res, 403, `This action requires one of these roles: ${roles.join(", ")}`);
}

app.get("/api/health", (_req, res) => res.json({ name: "LEXORA API", status: "ok" }));
app.use("/api", authenticate);

app.get("/api/dashboard/summary", async (req, res) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nextWeek = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const [matterResult, documentResult, feeResult, paymentResult, deadlineResult, activityResult] = await Promise.all([
    req.db.from("matters").select("id", { count: "exact", head: true }).eq("matter_status", "open").is("deleted_at", null),
    req.db.from("documents").select("id", { count: "exact", head: true }).is("deleted_at", null),
    req.db.from("fee_notes").select("id,amount,currency,status").is("deleted_at", null),
    req.db.from("payments").select("amount,currency,fee_note_id").is("deleted_at", null),
    req.db.from("deadlines").select("id,title,due_date,status,matter_id").gte("due_date", today).lte("due_date", nextWeek).neq("status", "completed").order("due_date").limit(8),
    req.db.from("document_activity").select("id,document_id,actor_id,action,details,occurred_at").order("occurred_at", { ascending: false }).limit(8),
  ]);
  const failed = [matterResult, documentResult, feeResult, paymentResult, deadlineResult, activityResult].find((result) => result.error);
  if (failed) return jsonError(res, 400, failed.error.message);
  const fees = feeResult.data || [];
  const payments = paymentResult.data || [];
  const outstanding = {};
  for (const fee of fees) {
    if (fee.status === "void") continue;
    const paid = payments.filter((payment) => payment.fee_note_id === fee.id).reduce((sum, payment) => sum + Number(payment.amount), 0);
    outstanding[fee.currency] = (outstanding[fee.currency] || 0) + Math.max(0, Number(fee.amount) - paid);
  }
  return res.json({
    active_matter_count: matterResult.count || 0,
    outstanding_by_currency: outstanding,
    document_count: documentResult.count || 0,
    upcoming_deadlines: deadlineResult.data || [],
    recent_activity: activityResult.data || [],
  });
});

app.get("/api/clients", async (req, res) => {
  const search = String(req.query.search || "").trim();
  let query = req.db.from("clients").select("id,display_name,legal_name,email,phone,client_type,created_at,assigned_to")
    .is("deleted_at", null).order("display_name");
  if (req.profile.role === "legal_officer") query = query.eq("assigned_to", req.profile.id);
  if (search) {
    const safeSearch = search.replace(/[%,_()]/g, " ").trim();
    if (safeSearch) query = query.or(`display_name.ilike.%${safeSearch}%,legal_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
  }
  const { data, error } = await query;
  if (error) return jsonError(res, 400, error.message);
  return res.json({ clients: data || [] });
});

app.post("/api/clients", requireRoles("operations_manager", "managing_partner"), async (req, res) => {
  const { display_name, legal_name, client_type, email, phone, address, notes } = req.body || {};
  if (!display_name?.trim()) return jsonError(res, 400, "display_name is required");
  const { data, error } = await req.db.from("clients").insert({
    display_name: display_name.trim(), legal_name, client_type, email, phone, address, notes, created_by: req.profile.id,
  }).select().single();
  if (error) return jsonError(res, 400, error.message);
  return res.status(201).json({ client: data });
});

app.patch("/api/clients/:clientId", async (req, res) => {
  const allowed = ["display_name", "legal_name", "client_type", "email", "phone", "address", "notes", "assigned_to"];
  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  updates.updated_at = new Date().toISOString();
  const { data, error } = await req.db.from("clients").update(updates).eq("id", req.params.clientId).select().maybeSingle();
  if (error) return jsonError(res, 400, error.message);
  if (!data) return jsonError(res, 404, "Client not found");
  return res.json({ client: data });
});

app.get("/api/clients/:clientId/360", async (req, res) => {
  const clientId = req.params.clientId;
  const { data: client, error: clientError } = await req.db.from("clients").select("*").eq("id", clientId).is("deleted_at", null).maybeSingle();
  if (clientError) return jsonError(res, 400, clientError.message);
  if (!client) return jsonError(res, 404, "Client not found");
  const results = await Promise.all([
    req.db.from("matters").select("id,title,description,practice_area,matter_status,closed_at,created_at,updated_at,assigned_to,created_by,entered_by").eq("client_id", clientId).is("deleted_at", null).order("updated_at", { ascending: false }),
    req.db.from("documents").select("id,name,type,matter_id,storage_path,mime_type,version,status,content_sha256,created_at,updated_at,uploaded_by,created_by,entered_by").eq("client_id", clientId).is("deleted_at", null).order("created_at", { ascending: false }),
    req.db.from("fee_notes").select("id,reference,description,amount,currency,issued_at,due_at,status,matter_id,file_document_id").eq("client_id", clientId).is("deleted_at", null).order("issued_at", { ascending: false }),
    req.db.from("payments").select("id,fee_note_id,amount,currency,paid_at,payment_method,reference,proof_document_id,matter_id").eq("client_id", clientId).is("deleted_at", null).order("paid_at", { ascending: false }),
  ]);
  const failed = results.find((result) => result.error);
  if (failed) return jsonError(res, 400, failed.error.message);
  const [matters, clientDocuments, feeNotes, payments] = results.map((result) => result.data || []);
  const matterIds = matters.map((matter) => matter.id);
  const matterDocumentsResult = matterIds.length
    ? await req.db.from("documents").select("id,name,type,matter_id,storage_path,mime_type,version,status,content_sha256,created_at,updated_at,uploaded_by,created_by,entered_by").in("matter_id", matterIds).is("deleted_at", null).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (matterDocumentsResult.error) return jsonError(res, 400, matterDocumentsResult.error.message);
  const documents = [...new Map([...(clientDocuments || []), ...(matterDocumentsResult.data || [])].map((document) => [document.id, document])).values()];
  const documentIds = documents.map((document) => document.id);
  const relatedIds = [...new Set([clientId, ...matterIds, ...documentIds, ...feeNotes.map((item) => item.id), ...payments.map((item) => item.id)])];
  const emptyResult = { data: [], error: null };
  const [activityResult, notesResult, tasksResult, deadlinesResult, versionsResult, auditResult] = await Promise.all([
    documentIds.length
      ? req.db.from("document_activity").select("id,document_id,actor_id,action,from_status,to_status,occurred_at,details").in("document_id", documentIds).order("occurred_at", { ascending: false })
      : Promise.resolve(emptyResult),
    matterIds.length
      ? req.db.from("matter_notes").select("id,matter_id,content,note_type,created_by,is_private,created_at").in("matter_id", matterIds).is("deleted_at", null).order("created_at", { ascending: false })
      : Promise.resolve(emptyResult),
    matterIds.length
      ? req.db.from("matter_tasks").select("id,matter_id,title,description,status,priority,due_date,assigned_to,created_by,completed_at,created_at,updated_at").in("matter_id", matterIds).is("deleted_at", null).order("created_at", { ascending: false })
      : Promise.resolve(emptyResult),
    matterIds.length
      ? req.db.from("deadlines").select("id,matter_id,title,due_date,status,created_by,created_at").in("matter_id", matterIds).order("due_date")
      : Promise.resolve(emptyResult),
    documentIds.length
      ? req.db.from("document_versions").select("id,document_id,version_number,storage_path,content_sha256,size_bytes,mime_type,uploaded_by,created_at").in("document_id", documentIds).order("version_number", { ascending: false })
      : Promise.resolve(emptyResult),
    req.db.from("audit_logs").select("id,action,performed_by,target_id,resource,details,created_at").in("target_id", relatedIds).order("created_at", { ascending: false }),
  ]);
  const childResults = [activityResult, notesResult, tasksResult, deadlinesResult, versionsResult, auditResult];
  const childFailure = childResults.find((result) => result.error);
  if (childFailure) return jsonError(res, 400, childFailure.error.message);
  const paidByFeeNote = new Map();
  for (const payment of payments) if (payment.fee_note_id) paidByFeeNote.set(payment.fee_note_id, (paidByFeeNote.get(payment.fee_note_id) || 0) + Number(payment.amount));
  const outstandingByCurrency = {};
  for (const fee of feeNotes) {
    if (fee.status === "void") continue;
    outstandingByCurrency[fee.currency] = (outstandingByCurrency[fee.currency] || 0) + Math.max(0, Number(fee.amount) - (paidByFeeNote.get(fee.id) || 0));
  }
  const recentActivity = [
    ...(activityResult.data || []).map((item) => ({ ...item, subject_type: "document" })),
    ...(notesResult.data || []).map((item) => ({ ...item, action: item.note_type, occurred_at: item.created_at, subject_type: "matter" })),
    ...(tasksResult.data || []).map((item) => ({ ...item, action: `task_${item.status}`, occurred_at: item.updated_at || item.created_at, subject_type: "task" })),
    ...(deadlinesResult.data || []).map((item) => ({ ...item, action: `deadline_${item.status}`, occurred_at: item.created_at, subject_type: "deadline" })),
    ...feeNotes.map((item) => ({ id: item.id, action: "fee_note_issued", occurred_at: item.issued_at, subject_type: "billing", details: { reference: item.reference, amount: item.amount, currency: item.currency } })),
    ...payments.map((item) => ({ id: item.id, action: "payment_recorded", occurred_at: item.paid_at, subject_type: "billing", details: { reference: item.reference, amount: item.amount, currency: item.currency } })),
    ...(auditResult.data || []).map((item) => ({ ...item, occurred_at: item.created_at, subject_type: item.resource || "audit" })),
  ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  return res.json({ client, matters, documents, document_versions: versionsResult.data || [], matter_notes: notesResult.data || [], matter_tasks: tasksResult.data || [], deadlines: deadlinesResult.data || [], fee_notes: feeNotes, payments, recent_activity: recentActivity, summary: {
    active_matter_count: matters.filter((matter) => matter.matter_status === "open").length,
    outstanding_by_currency: outstandingByCurrency,
    document_count: documents.length,
  } });
});

app.get("/api/matters", async (req, res) => {
  let query = req.db.from("matters").select("*,clients(id,display_name,legal_name)").is("deleted_at", null).order("updated_at", { ascending: false });
  if (req.query.client_id) query = query.eq("client_id", req.query.client_id);
  if (req.query.practice_area) query = query.eq("practice_area", req.query.practice_area);
  if (req.query.status) query = query.eq("matter_status", req.query.status);
  const { data, error } = await query;
  if (error) return jsonError(res, 400, error.message);
  return res.json({ matters: data || [] });
});

app.post("/api/matters", async (req, res) => {
  const { title, description, client_id, practice_area, assigned_to } = req.body || {};
  if (!title?.trim() || !client_id || !practice_area) return jsonError(res, 400, "title, client_id, and practice_area are required");
  if (practice_area === "needs_review") return jsonError(res, 400, "Choose a practice area before creating a matter");
  if (assigned_to && req.profile.role !== "operations_manager" && req.profile.role !== "managing_partner") return jsonError(res, 403, "Only Operations Managers and Managing Partners can assign matters");
  const { data, error } = await req.db.from("matters").insert({ title: title.trim(), description, client_id, practice_area, assigned_to: assigned_to || null, created_by: req.profile.id, entered_by: req.profile.id }).select().single();
  if (error) return jsonError(res, 400, error.message);
  return res.status(201).json({ matter: data });
});

app.patch("/api/matters/:matterId", async (req, res) => {
  const allowed = ["title", "description", "client_id", "practice_area", "assigned_to"];
  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  updates.updated_at = new Date().toISOString();
  const { data, error } = await req.db.from("matters").update(updates).eq("id", req.params.matterId).eq("matter_status", "open").select().maybeSingle();
  if (error) return jsonError(res, 400, error.message);
  if (!data) return jsonError(res, 404, "Open matter not found or access denied");
  return res.json({ matter: data });
});

app.post("/api/matters/:matterId/close", requireRoles("operations_manager", "managing_partner"), async (req, res) => {
  const { data, error } = await req.db.from("matters").update({ matter_status: "closed", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", req.params.matterId).eq("matter_status", "open").select().maybeSingle();
  if (error) return jsonError(res, 400, error.message);
  if (!data) return jsonError(res, 404, "Open matter not found or access denied");
  return res.json({ matter: data });
});

app.post("/api/matters/:matterId/soft-delete", requireRoles("managing_partner"), async (req, res) => {
  const { error } = await req.db.from("matters").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", req.params.matterId).is("deleted_at", null);
  if (error) return jsonError(res, 400, error.message);
  return res.json({ deleted: true, matter_id: req.params.matterId });
});

const transitions = {
  legal_officer: { draft: ["submitted"] },
  operations_manager: { submitted: ["in_ops_review"], in_ops_review: ["awaiting_partner_approval", "submitted"] },
  managing_partner: { awaiting_partner_approval: ["approved", "in_ops_review"] },
};
app.post("/api/documents/:documentId/transition", async (req, res) => {
  const { to_status } = req.body || {};
  const { data: document, error: loadError } = await req.db.from("documents").select("id,status,matter_id").eq("id", req.params.documentId).maybeSingle();
  if (loadError) return jsonError(res, 400, loadError.message);
  if (!document) return jsonError(res, 404, "Document not found");
  const { data: matter } = document.matter_id ? await req.db.from("matters").select("matter_status").eq("id", document.matter_id).maybeSingle() : { data: null };
  if (matter?.matter_status === "closed") return jsonError(res, 409, "Documents on closed matters are read-only");
  if (!transitions[req.profile.role]?.[document.status]?.includes(to_status)) return jsonError(res, 409, `Transition ${document.status} → ${to_status} is not allowed for ${req.profile.role}`);
  const { data, error } = await req.db.from("documents").update({ status: to_status, updated_at: new Date().toISOString() }).eq("id", document.id).select().single();
  if (error) return jsonError(res, 400, error.message);
  return res.json({ document: data });
});

app.get("/api/documents/:documentId/activity", async (req, res) => {
  const { data, error } = await req.db.from("document_activity").select("id,actor_id,action,from_status,to_status,details,occurred_at")
    .eq("document_id", req.params.documentId).order("occurred_at", { ascending: true });
  if (error) return jsonError(res, 400, error.message);
  return res.json({ activity: data || [] });
});

app.post("/api/documents/:documentId/versions", async (req, res) => {
  const { storage_path, mime_type } = req.body || {};
  if (!storage_path) return jsonError(res, 400, "storage_path is required");
  const { data: document, error: docError } = await req.db.from("documents").select("id,status,matter_id,storage_path,version,deleted_at").eq("id", req.params.documentId).maybeSingle();
  if (docError) return jsonError(res, 400, docError.message);
  if (!document) return jsonError(res, 404, "Document not found");
  if (document.deleted_at) return jsonError(res, 409, "Deleted documents cannot receive new versions");
  if (storage_path.split("/")[0] !== req.profile.id || storage_path.split("/")[1] !== document.id) return jsonError(res, 403, "The uploaded object path does not belong to this user and document");
  if (document.status !== "draft" && !(req.profile.role === "operations_manager" || req.profile.role === "managing_partner")) return jsonError(res, 409, "Only a reviewer may append a version to a closed matter");
  let isClosedMatter = false;
  if (document.matter_id) {
    const { data: matter } = await req.db.from("matters").select("matter_status").eq("id", document.matter_id).maybeSingle();
    isClosedMatter = matter?.matter_status === "closed";
    if (isClosedMatter && !["operations_manager", "managing_partner"].includes(req.profile.role)) return jsonError(res, 409, "Only a reviewer may append a version to a closed matter");
    if (!isClosedMatter && document.status !== "draft") return jsonError(res, 409, "Only draft documents may be revised before approval");
  }
  const storageClient = supabaseAdmin || req.db;
  const { data: blob, error: downloadError } = await storageClient.storage.from("lexora-documents").download(storage_path);
  if (downloadError || !blob) return jsonError(res, 400, downloadError?.message || "Unable to read uploaded object");
  const buffer = Buffer.from(await blob.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const { count, error: countError } = await req.db.from("document_versions").select("id", { count: "exact", head: true }).eq("document_id", document.id);
  if (countError) return jsonError(res, 400, countError.message);
  const recordedBase = document.storage_path ? Number.parseInt(document.version, 10) || 1 : 0;
  const versionNumber = Math.max(count || 0, recordedBase) + 1;
  const { data: version, error: versionError } = await req.db.from("document_versions").insert({
    document_id: document.id, version_number: versionNumber, storage_path,
    content_sha256: sha256, size_bytes: buffer.byteLength, mime_type: mime_type || null, uploaded_by: req.profile.id,
  }).select().single();
  if (versionError) return jsonError(res, 400, versionError.message);
  if (!isClosedMatter) {
    const { error: updateError } = await req.db.from("documents").update({ storage_path, content_sha256: sha256, version: String(versionNumber), mime_type: mime_type || null, updated_at: new Date().toISOString() }).eq("id", document.id);
    if (updateError) return jsonError(res, 400, updateError.message);
  }
  return res.status(201).json({ version, sha256 });
});

app.post("/api/documents/:documentId/soft-delete", requireRoles("managing_partner"), async (req, res) => {
  const { data, error } = await req.db.from("documents").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", req.params.documentId).is("deleted_at", null).select("id,deleted_at").maybeSingle();
  if (error) return jsonError(res, 400, error.message);
  if (!data) return jsonError(res, 404, "Document not found or already deleted");
  return res.json({ document: data });
});

app.post("/api/billing/fee-notes", requireRoles("legal_officer", "operations_manager", "managing_partner"), async (req, res) => {
  const { client_id, matter_id, reference, description, amount, currency, due_at, file_document_id } = req.body || {};
  if (!client_id || !matter_id || !reference || !description || !Number.isFinite(Number(amount))) return jsonError(res, 400, "client_id, matter_id, reference, description, and amount are required");
  const { data, error } = await req.db.from("fee_notes").insert({ client_id, matter_id, reference, description, amount, currency, due_at, file_document_id, created_by: req.profile.id }).select().single();
  if (error) return jsonError(res, 400, error.message);
  return res.status(201).json({ fee_note: data });
});

app.get("/api/billing/records", requireRoles("legal_officer", "operations_manager", "managing_partner"), async (req, res) => {
  const [feeResult, paymentResult] = await Promise.all([
    req.db.from("fee_notes").select("id,client_id,matter_id,reference,description,amount,currency,issued_at,due_at,status,file_document_id,clients(display_name),matters!fee_notes_matter_client_fkey(title)").is("deleted_at", null).order("issued_at", { ascending: false }),
    req.db.from("payments").select("id,client_id,matter_id,fee_note_id,amount,currency,paid_at,payment_method,reference,proof_document_id,clients(display_name),matters!payments_matter_client_fkey(title)").is("deleted_at", null).order("paid_at", { ascending: false }),
  ]);
  if (feeResult.error) return jsonError(res, 400, feeResult.error.message);
  if (paymentResult.error) return jsonError(res, 400, paymentResult.error.message);
  return res.json({ fee_notes: feeResult.data || [], payments: paymentResult.data || [] });
});

app.post("/api/billing/payments", requireRoles("legal_officer", "operations_manager", "managing_partner"), async (req, res) => {
  const { client_id, matter_id, fee_note_id, amount, currency, payment_method, reference, proof_document_id, paid_at } = req.body || {};
  if (!client_id || !matter_id || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return jsonError(res, 400, "client_id, matter_id, and a positive amount are required");
  const { data, error } = await req.db.from("payments").insert({ client_id, matter_id, fee_note_id, amount, currency, payment_method, reference, proof_document_id, paid_at, created_by: req.profile.id }).select().single();
  if (error) return jsonError(res, 400, error.message);
  return res.status(201).json({ payment: data });
});

app.get("/api/billing/clients/:clientId/balance", async (req, res) => {
  const [feeResult, paymentResult] = await Promise.all([
    req.db.from("fee_notes").select("id,amount,currency,status").eq("client_id", req.params.clientId).is("deleted_at", null),
    req.db.from("payments").select("amount,currency,fee_note_id").eq("client_id", req.params.clientId).is("deleted_at", null),
  ]);
  if (feeResult.error) return jsonError(res, 400, feeResult.error.message);
  if (paymentResult.error) return jsonError(res, 400, paymentResult.error.message);
  const fees = feeResult.data || [];
  const payments = paymentResult.data || [];
  const balances = fees.reduce((memo, fee) => {
    if (fee.status === "void") return memo;
    const paid = payments.filter((payment) => payment.fee_note_id === fee.id).reduce((sum, item) => sum + Number(item.amount), 0);
    memo[fee.currency] = (memo[fee.currency] || 0) + Math.max(0, Number(fee.amount) - paid);
    return memo;
  }, {});
  return res.json({ client_id: req.params.clientId, outstanding_by_currency: balances });
});

app.get("/api/retention/review", requireRoles("operations_manager", "managing_partner"), async (req, res) => {
  const { data, error } = await req.db.from("matters_retention_review").select("*").order("minimum_retention_until");
  if (error) return jsonError(res, 400, error.message);
  return res.json({ matters: data || [] });
});

app.get("/api/clients/:clientId/export", requireRoles("managing_partner"), async (req, res) => {
  const { data, error } = await req.db.from("clients").select("*").eq("id", req.params.clientId).maybeSingle();
  if (error) return jsonError(res, 400, error.message);
  if (!data) return jsonError(res, 404, "Client not found");
  const { data: bundle, error: bundleError } = await req.db.rpc("export_client_record", { target_client_id: req.params.clientId });
  if (bundleError) return jsonError(res, 501, "Client export query is not installed yet");
  const documentFiles = await Promise.all((bundle.documents || []).map(async (document) => {
    if (!document.storage_path) return { document_id: document.id, storage_path: null, file_base64: null };
    const storageClient = supabaseAdmin || req.db;
    const { data: blob, error: fileError } = await storageClient.storage.from("lexora-documents").download(document.storage_path);
    if (fileError || !blob) throw new Error(`Could not export document ${document.id}: ${fileError?.message || "object unavailable"}`);
    return { document_id: document.id, storage_path: document.storage_path, file_base64: Buffer.from(await blob.arrayBuffer()).toString("base64") };
  }));
  bundle.document_files = documentFiles;
  res.setHeader("Content-Disposition", `attachment; filename=lexora-client-${req.params.clientId}.json`);
  return res.json(bundle);
});

// Retained administrator endpoint; identity, approval, and role are verified here.
app.patch("/api/admin/users/:userId", requireRoles("managing_partner"), async (req, res) => {
  const allowed = ["role", "status"];
  const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  const validRoles = [...allowedRoles];
  if (updates.role && !validRoles.includes(updates.role)) return jsonError(res, 400, "Invalid role");
  const { data, error } = await (req.adminDb || req.db).from("profiles").update(updates).eq("id", req.params.userId).select().maybeSingle();
  if (error) return jsonError(res, 400, error.message);
  if (!data) return jsonError(res, 404, "Profile not found");
  return res.json({ user: data });
});

app.use((err, _req, res, _next) => {
  console.error("LEXORA API error", err);
  const message = process.env.NODE_ENV === "production"
    ? "Unexpected API error"
    : (err instanceof Error ? err.message : String(err));
  return jsonError(res, 500, message || "Unexpected API error");
});

export default app;
