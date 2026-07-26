'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Check, X } from 'lucide-react';
import { api, auth, thumbUrl } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, EmptyState, Modal, money } from '@/components/ui';

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: '', label: 'All' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
];
const tone = (s: string): 'brand' | 'success' | 'danger' | 'muted' =>
  s === 'accepted' ? 'success' : s === 'rejected' ? 'danger' : 'brand';
const isPdf = (u: string) => /\.pdf($|\?)/i.test(u || '');

export default function PaymentsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<any>(null);
  const [reason, setReason] = useState('');

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); }, []);
  useEffect(() => { if (ready) load(); }, [ready, filter]);

  const load = async () => { setErr(''); try { setRows(await api.listProofs(filter)); } catch (e: any) { setErr(e.message); } };

  const accept = async (id: string) => {
    setBusy(id); setErr('');
    try { await api.acceptProof(id); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };
  const doReject = async () => {
    if (!rejectFor) return;
    setBusy(rejectFor.id); setErr('');
    try { await api.rejectProof(rejectFor.id, reason); setRejectFor(null); setReason(''); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!ready) return null;

  return (
    <div>
      <PageHeader title="Payments" subtitle="Review tenant proof-of-payment submissions (manual EFT)" />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${filter === f.key ? 'bg-ink text-white' : 'text-ink/70 hover:bg-white/50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="grid gap-4">
        {rows.map((p) => (
          <GlassCard key={p.id}>
            <div className="flex flex-wrap items-start gap-4">
              <button onClick={() => setPreview(p.fileUrl)} className="h-24 w-24 flex-none overflow-hidden rounded-xl border border-white/40 bg-white/40">
                {isPdf(p.fileUrl)
                  ? <div className="grid h-full w-full place-items-center text-muted"><FileText size={26} /></div>
                  : <img src={thumbUrl(p.fileUrl)} onError={(e) => { (e.currentTarget as HTMLImageElement).src = p.fileUrl; }} alt="" className="h-full w-full object-cover" />}
              </button>

              <div className="min-w-[200px] flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-base font-bold text-ink">{p.tenantName ?? p.tenantEmail ?? 'Tenant'}</span>
                  <Badge tone={tone(p.status)}>{p.status}</Badge>
                </div>
                <div className="mt-1 text-sm text-muted">
                  Invoice {p.invoicePeriod} · {money(p.invoiceTotal)} · <span className="text-ink/70">{p.invoiceStatus}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span>Paid: <b className="text-ink">{p.amount ? money(p.amount) : '—'}</b></span>
                  <span className="text-muted">Date: {p.paidAt ?? '—'}</span>
                  <span className="text-muted">Ref: {p.reference ?? '—'}</span>
                </div>
                {p.note && <p className="mt-1 text-sm text-ink/80">“{p.note}”</p>}
                {p.reviewNote && <p className="mt-1 text-sm text-danger">Rejected: {p.reviewNote}</p>}
              </div>

              {p.status === 'pending' && (
                <div className="flex gap-2">
                  <Button onClick={() => accept(p.id)} loading={busy === p.id}><Check size={15} /> Accept</Button>
                  <Button variant="ghost" onClick={() => setRejectFor(p)}><X size={15} /> Reject</Button>
                </div>
              )}
            </div>
          </GlassCard>
        ))}
        {rows.length === 0 && <GlassCard><EmptyState>No {filter || ''} proofs of payment.</EmptyState></GlassCard>}
      </div>

      {/* Preview */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title="Proof of payment"
        footer={<>
          {preview && <a className="text-sm text-brand hover:underline" href={preview} target="_blank" rel="noreferrer">Open original</a>}
          <Button variant="ghost" onClick={() => setPreview(null)}>Close</Button>
        </>}>
        {preview && (isPdf(preview)
          ? <object data={preview} type="application/pdf" className="h-[70vh] w-full rounded-xl" />
          : <img src={preview} alt="" className="max-h-[70vh] w-full rounded-xl object-contain" />)}
      </Modal>

      {/* Reject */}
      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title="Reject proof of payment"
        footer={<>
          <Button variant="ghost" onClick={() => setRejectFor(null)}>Cancel</Button>
          <Button onClick={doReject} loading={busy === rejectFor?.id}>Reject &amp; notify</Button>
        </>}>
        <Field label="Reason (sent to the tenant)">
          <textarea className="input min-h-[90px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Amount doesn't match the invoice / reference missing" />
        </Field>
      </Modal>
    </div>
  );
}
