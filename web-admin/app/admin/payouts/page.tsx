'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, RefreshCw, ShieldAlert, AlertTriangle, Landmark } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Field, Badge, Modal, EmptyState, Metric, money } from '@/components/ui';

/**
 * The monthly payout run (docs/LOCARE_COMMISSION_STRUCTURE.md §4.1) and the
 * self-dealing review queue (§7.4).
 *
 * Deliberately one page: both are things you look at once a month, in the same
 * sitting, before money leaves. Splitting them makes it easy to pay a run
 * without having glanced at the flags.
 */

const REASON: Record<string, string> = {
  floor_met: 'Above the floor',
  quarterly_sweep: 'Released by the quarterly sweep',
  below_floor: 'Below the floor — rolls over',
  nothing_due: 'Nothing due',
};

export default function AdminPayoutsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState<any>(null);
  const [flags, setFlags] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [payFor, setPayFor] = useState<any>(null);
  const [ref, setRef] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const [r, f] = await Promise.all([api.payoutRun(), api.selfDealingReport()]);
      setRun(r);
      setFlags(f);
    } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => { if (!auth.get()) { router.replace('/login'); return; } setReady(true); }, [router]);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const doPay = async () => {
    if (!payFor) return;
    setBusy(payFor.partnerId); setErr('');
    try { await api.payPartnerPayout(payFor.partnerId, ref); setPayFor(null); setRef(''); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!ready) return null;

  const lines: any[] = run?.lines ?? [];
  const payable = lines.filter((l) => l.payable && !l.blocked);
  const held = lines.filter((l) => !l.payable || l.blocked);
  const blocking = flags.filter((f) => f.blocking);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Payout run" subtitle="Approved commissions grouped by partner, ready to pay" />
        <Button variant="ghost" onClick={load}><RefreshCw size={16} /> Refresh</Button>
      </div>
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Payable now" value={money(run?.payableTotal ?? 0)} />
        <Metric label="Held" value={money(run?.heldTotal ?? 0)} />
        <Metric label="Floor" value={money(run?.floor ?? 0)} />
      </div>

      {run?.quarterEnd && (
        <div className="mb-5 flex items-start gap-2 rounded-xl bg-brand/10 px-4 py-3 text-sm text-ink">
          <Landmark size={16} className="mt-0.5 shrink-0 text-brand" />
          <span>
            <strong>Quarterly sweep.</strong> Every non-zero balance is released this run,
            regardless of the {money(run.floor)} floor — nobody waits more than a quarter.
          </span>
        </div>
      )}

      {blocking.length > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-xl bg-dangerbg px-4 py-3 text-sm text-danger">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            {blocking.length} referral{blocking.length > 1 ? 's are' : ' is'} withheld for self-dealing.
            Commission is not accruing on {blocking.length > 1 ? 'them' : 'it'} — see below before paying.
          </span>
        </div>
      )}

      <GlassCard className="!p-0 mb-8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Partner</th>
              <th className="px-5 py-3 font-semibold">Periods</th>
              <th className="px-5 py-3 font-semibold">Amount</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {[...payable, ...held].map((l) => (
                <tr key={l.partnerId} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium text-ink">{l.partnerName}</td>
                  <td className="px-5 py-3 text-muted">
                    {l.periods.join(', ')}
                    <span className="ml-1 text-xs">({l.commissionIds.length})</span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-ink">{money(l.total)}</td>
                  <td className="px-5 py-3">
                    {l.blocked
                      ? <Badge tone="danger">{l.blocked}</Badge>
                      : <Badge tone={l.payable ? 'success' : 'muted'}>{REASON[l.reason] ?? l.reason}</Badge>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {l.payable && !l.blocked && (
                      <Button variant="ghost" onClick={() => { setPayFor(l); setRef(''); }}>
                        <Banknote size={14} /> Mark paid
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={5}><EmptyState>Nothing approved and unpaid. Approve commissions first.</EmptyState></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <PageHeader title="Self-dealing review" subtitle="Partner and agency pairs that look like the same person" />
      <GlassCard className="!p-0 mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Partner</th>
              <th className="px-5 py-3 font-semibold">Agency</th>
              <th className="px-5 py-3 font-semibold">Signals</th>
              <th className="px-5 py-3 font-semibold">Effect</th>
            </tr></thead>
            <tbody>
              {flags.map((f) => (
                <tr key={`${f.partnerId}:${f.vendorId}`} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium text-ink">{f.partnerName}</td>
                  <td className="px-5 py-3">{f.agencyName}</td>
                  <td className="px-5 py-3">
                    <ul className="space-y-1 text-muted">
                      {f.reasons.map((r: string) => (
                        <li key={r} className="flex items-start gap-1.5">
                          <AlertTriangle size={13} className="mt-0.5 shrink-0 opacity-60" />{r}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-5 py-3">
                    {f.blocking
                      ? <Badge tone="danger">Commission withheld</Badge>
                      : <Badge tone="muted">Flagged for review</Badge>}
                  </td>
                </tr>
              ))}
              {flags.length === 0 && (
                <tr><td colSpan={4}><EmptyState>No partner resembles an agency they referred.</EmptyState></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">
        An exact match between a partner&apos;s contact email and an owner of the referred agency
        is treated as conclusive and withholds commission automatically. Everything else —
        a shared mail domain, a shared phone, a similar name — is a prompt to look, not a
        verdict; it withholds nothing on its own.
      </p>

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title="Record payout"
        footer={<><Button variant="ghost" onClick={() => setPayFor(null)}>Cancel</Button><Button onClick={doPay} loading={busy === payFor?.partnerId}>Mark paid</Button></>}>
        <p className="mb-1 text-sm text-ink">
          <strong>{payFor?.partnerName}</strong> · {money(payFor?.total ?? 0)}
        </p>
        <p className="mb-3 text-sm text-muted">
          Marks {payFor?.commissionIds?.length} commission{payFor?.commissionIds?.length === 1 ? '' : 's'} paid
          ({payFor?.periods?.join(', ')}). Do this after the EFT has gone out — it records the payment, it does not make one.
        </p>
        <Field label="Payment reference (EFT)">
          <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="EFT-2026-08-001" />
        </Field>
      </Modal>
    </div>
  );
}
