'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Banknote, X } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, Modal, EmptyState, money } from '@/components/ui';

const FILTERS = ['issued', 'paid', 'void', 'all'];
const tone = (s: string): 'success' | 'brand' | 'muted' => (s === 'paid' ? 'success' : s === 'void' ? 'muted' : 'brand');

export default function AdminBillingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState('issued');
  const [rows, setRows] = useState<any[]>([]);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [payFor, setPayFor] = useState<any>(null);
  const [ref, setRef] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try { setRows(await api.adminSubInvoices(filter)); } catch (e: any) { setErr(e.message); }
  }, [filter]);

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); }, [router]);
  useEffect(() => { if (ready) load(); }, [ready, filter, load]);

  const run = async () => {
    setBusy('run'); setErr('');
    try { const r = await api.runSubInvoices(period); await load(); alert(`Generated ${r.generated} invoices for ${r.period}`); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };
  const voidInv = async (id: string) => {
    setBusy(id); setErr('');
    try { await api.voidSubInvoice(id); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };
  const doPay = async () => {
    if (!payFor) return;
    setBusy(payFor.id); setErr('');
    try { await api.markSubInvoicePaid(payFor.id, ref); setPayFor(null); setRef(''); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!ready) return null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Subscription billing" subtitle="Generate and reconcile agency subscription invoices" />
        <div className="flex items-end gap-2">
          <div className="w-32"><Field label="Period"><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field></div>
          <Button onClick={run} loading={busy === 'run'}><Play size={16} /> Generate</Button>
        </div>
      </div>
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition ${filter === f ? 'bg-ink text-white' : 'text-ink/70 hover:bg-black/5'}`}>{f}</button>
        ))}
      </div>

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Period</th><th className="px-5 py-3 font-semibold">Agency</th><th className="px-5 py-3 font-semibold">Plan</th><th className="px-5 py-3 font-semibold">Units</th><th className="px-5 py-3 font-semibold">Amount</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium text-ink">{i.period}</td>
                  <td className="px-5 py-3">{i.agencyName ?? '—'}</td>
                  <td className="px-5 py-3 capitalize">{i.tier}</td>
                  <td className="px-5 py-3">{i.unitCount}</td>
                  <td className="px-5 py-3 font-semibold text-ink">{money(i.amount)}</td>
                  <td className="px-5 py-3"><Badge tone={tone(i.status)}>{i.status}</Badge></td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {i.status === 'issued' && <Button variant="ghost" onClick={() => { setPayFor(i); setRef(''); }}><Banknote size={14} /> Mark paid</Button>}
                      {i.status === 'issued' && <Button variant="ghost" loading={busy === i.id} onClick={() => voidInv(i.id)}><X size={14} /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7}><EmptyState>No {filter === 'all' ? '' : filter} invoices.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title="Mark invoice paid"
        footer={<><Button variant="ghost" onClick={() => setPayFor(null)}>Cancel</Button><Button onClick={doPay} loading={busy === payFor?.id}>Mark paid</Button></>}>
        <p className="mb-3 text-sm text-muted">{payFor?.agencyName} · {money(payFor?.amount ?? 0)} · {payFor?.period}</p>
        <Field label="Payment reference"><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="EFT / gateway ref" /></Field>
      </Modal>
    </div>
  );
}
