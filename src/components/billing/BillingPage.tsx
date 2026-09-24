import { FormEvent, useEffect, useState } from "react";
import { CreditCard, FileText, Plus, ReceiptText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Choice = { id: string; display_name?: string; title?: string };
type FeeNote = { id: string; client_id: string; matter_id: string; reference: string; description: string; amount: number; currency: string; issued_at: string; status: string; clients?: { display_name: string } | null; matters?: { title: string } | null };
type Payment = { id: string; amount: number; currency: string; paid_at: string; reference: string | null; fee_note_id: string | null; proof_document_id: string | null; clients?: { display_name: string } | null; matters?: { title: string } | null };

export function BillingPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Choice[]>([]);
  const [matters, setMatters] = useState<Choice[]>([]);
  const [fees, setFees] = useState<FeeNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const request = async (path: string, init: RequestInit = {}) => {
    const { data } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
    const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}`, ...init.headers } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed");
    return body;
  };

  const refresh = async () => {
    const [billing, clientRows, matterRows] = await Promise.all([
      request("/api/billing/records"), request("/api/clients"), request("/api/matters"),
    ]);
    setFees(billing.fee_notes || []); setPayments(billing.payments || []);
    setClients(clientRows.clients || []); setMatters(matterRows.matters || []);
  };
  useEffect(() => { if (user) refresh().catch((reason: Error) => setError(reason.message)); }, [user?.id]);

  const createFee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/billing/fee-notes", { method: "POST", body: JSON.stringify({
        client_id: form.get("client_id"), matter_id: form.get("matter_id"), reference: form.get("reference"),
        description: form.get("description"), amount: Number(form.get("amount")), currency: form.get("currency"),
        due_at: form.get("due_at") || null, file_document_id: form.get("file_document_id") || null,
      }) });
      setShowFeeForm(false); await refresh();
    } catch (reason) { setError((reason as Error).message); }
  };
  const recordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/billing/payments", { method: "POST", body: JSON.stringify({
        client_id: form.get("client_id"), matter_id: form.get("matter_id"), fee_note_id: form.get("fee_note_id") || null,
        amount: Number(form.get("amount")), currency: form.get("currency"), reference: form.get("reference") || null,
        payment_method: form.get("payment_method") || null, proof_document_id: form.get("proof_document_id") || null,
      }) });
      setShowPaymentForm(false); await refresh();
    } catch (reason) { setError((reason as Error).message); }
  };

  const paidByFee = new Map<string, number>();
  payments.forEach((payment) => { const fee = fees.find((item) => item.id === payment.fee_note_id); if (fee) paidByFee.set(fee.id, (paidByFee.get(fee.id) || 0) + Number(payment.amount)); });
  const outstanding = fees.reduce((sum, fee) => sum + (fee.status === "void" ? 0 : Math.max(0, Number(fee.amount) - (paidByFee.get(fee.id) || 0))), 0);

  return <main className="space-y-6">
    <header className="flex flex-wrap items-end justify-end gap-4">
      <div className="flex gap-2"><button onClick={() => { setShowFeeForm((value) => !value); setShowPaymentForm(false); }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Fee note</button><button onClick={() => { setShowPaymentForm((value) => !value); setShowFeeForm(false); }} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" />Record payment</button></div>
    </header>
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-3"><Summary icon={CreditCard} label="Outstanding" value={`NGN ${outstanding.toLocaleString()}`} /><Summary icon={ReceiptText} label="Fee notes" value={String(fees.length)} /><Summary icon={FileText} label="Payments recorded" value={String(payments.length)} /></div>
    {showFeeForm && <form onSubmit={createFee} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
      <select required name="client_id" className="search-input"><option value="">Choose client</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select>
      <select required name="matter_id" className="search-input"><option value="">Choose matter</option>{matters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
      <Input required name="reference" placeholder="Fee note reference" /><Input required name="description" placeholder="Description" />
      <Input required min="0" step="0.01" type="number" name="amount" placeholder="Amount" /><select name="currency" className="search-input"><option>NGN</option><option>USD</option><option>GBP</option><option>EUR</option></select>
      <Input type="date" name="due_at" /><Input name="file_document_id" placeholder="Attached document ID (optional)" />
      <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save fee note</button>
    </form>}
    {showPaymentForm && <form onSubmit={recordPayment} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
      <select required name="client_id" className="search-input"><option value="">Choose client</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select>
      <select required name="matter_id" className="search-input"><option value="">Choose matter</option>{matters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
      <select name="fee_note_id" className="search-input"><option value="">Unallocated payment</option>{fees.map((fee) => <option key={fee.id} value={fee.id}>{fee.reference}</option>)}</select>
      <Input required min="0.01" step="0.01" type="number" name="amount" placeholder="Amount" /><select name="currency" className="search-input"><option>NGN</option><option>USD</option><option>GBP</option><option>EUR</option></select>
      <Input name="payment_method" placeholder="Payment method" /><Input name="reference" placeholder="Payment reference" /><Input name="proof_document_id" placeholder="Proof document ID (optional)" />
      <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save payment</button>
    </form>}
    <div className="grid gap-5 xl:grid-cols-2"><section className="rounded-xl border border-border bg-card p-4"><h2 className="mb-3 text-lg font-semibold">Fee notes</h2>{fees.map((fee) => <div key={fee.id} className="flex justify-between gap-3 border-t border-border py-3"><div><p className="text-sm font-semibold">{fee.reference} · {fee.description}</p><p className="text-xs text-muted-foreground">{fee.clients?.display_name} · {fee.matters?.title} · {fee.issued_at}</p></div><div className="text-right"><p className="text-sm font-semibold">{fee.currency} {Number(fee.amount).toLocaleString()}</p><Badge variant="outline">{fee.status}</Badge></div></div>)}{fees.length === 0 && <Empty />}</section>
      <section className="rounded-xl border border-border bg-card p-4"><h2 className="mb-3 text-lg font-semibold">Payments and proof</h2>{payments.map((payment) => <div key={payment.id} className="flex justify-between gap-3 border-t border-border py-3"><div><p className="text-sm font-semibold">{payment.reference || "Payment received"}</p><p className="text-xs text-muted-foreground">{payment.clients?.display_name} · {payment.matters?.title} · {new Date(payment.paid_at).toLocaleDateString()}</p></div><div className="text-right"><p className="text-sm font-semibold">{payment.currency} {Number(payment.amount).toLocaleString()}</p><p className="text-xs text-muted-foreground">{payment.proof_document_id ? "Proof on file" : "No proof linked"}</p></div></div>)}{payments.length === 0 && <Empty />}</section></div>
  </main>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof CreditCard; label: string; value: string }) { return <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><p className="mt-3 text-2xl font-semibold">{value}</p></div>; }
function Empty() { return <p className="border-t border-border py-4 text-sm text-muted-foreground">Nothing recorded yet.</p>; }
