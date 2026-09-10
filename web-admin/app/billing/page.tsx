'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, BentoTile, EmptyState, money } from '@/components/ui';

const tone = (s: string): 'success' | 'brand' | 'muted' => (s === 'paid' ? 'success' : s === 'void' ? 'muted' : 'brand');
const TIER_LABEL: Record<string, string> = { starter: 'Starter', growth: 'Growth', scale: 'Scale', enterprise: 'Enterprise' };

const band = (b?: { minUnits: number; maxUnits: number | null }) =>
  !b ? '' : b.maxUnits === null ? `${b.minUnits}+ units` : `${b.minUnits}–${b.maxUnits} units`;

export default function BillingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const [p, inv] = await Promise.all([api.subscription(), api.subscriptionInvoices()]);
      setPlan(p); setRows(inv);
    } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true); load();
    // eslint-disable-next-line
  }, []);

  const pay = async (id: string) => {
    setBusy(id); setErr('');
    try {
      const r = await api.subscriptionCheckout(id);
      if (r.redirectUrl) window.location.href = r.redirectUrl;
      else { setErr('Payment started — reference ' + r.providerRef); await load(); }
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!ready) return null;
  const tier = plan?.tier ?? 'starter';

  // Below the published entry point with nothing negotiated, there is no figure
  // to show. `payable` still carries the ladder's answer, but billing refuses to
  // raise that invoice (see SubscriptionBillingService.generate), so quoting it
  // here would promise a customer a price we will not charge — and would
  // contradict the paragraph directly beneath this tile.
  const entryBand = (plan?.ladder ?? [])[0];
  const noPublishedPrice =
    !!plan && tier !== 'enterprise' && !plan.overridden &&
    !!entryBand && (plan.unitCount ?? 0) > 0 && (plan.unitCount ?? 0) < entryBand.minUnits;

  return (
    <div>
      <PageHeader title="Billing" subtitle="Your plan and monthly subscription invoices" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <BentoTile tone={tier === 'growth' ? 'teal' : tier === 'enterprise' ? 'purple' : 'blue'} value={TIER_LABEL[tier] ?? tier} label="Your plan" />
        <BentoTile tone="blue" value={String(plan?.unitCount ?? 0)} label="Billable units" />
        <BentoTile tone="amber"
          value={noPublishedPrice ? 'By arrangement' : money(plan?.payable ?? plan?.mrr ?? 0)}
          label={plan?.overridden ? 'Monthly fee (agreed)' : 'Monthly fee'} />
      </div>

      {plan && tier !== 'enterprise' && (
        <GlassCard className="mb-4">
          <p className="text-sm text-muted">
            {(() => {
              const units = plan.unitCount ?? 0;
              const current = (plan.ladder ?? []).find((b: any) => b.tier === tier);
              const next = plan.nextBand;
              const entry = (plan.ladder ?? [])[0];

              // Below the published entry point there is no cheaper tier — the
              // price is negotiated, so quoting the ladder here would be wrong.
              if (entry && units < entry.minUnits) {
                return plan.overridden
                  ? `You're on an agreed price of ${money(plan.payable)} a month for ${units} unit${units === 1 ? '' : 's'}. Published pricing starts at ${band(entry)}.`
                  : `You have ${units} unit${units === 1 ? '' : 's'}. Published pricing starts at ${band(entry)} — smaller portfolios are priced individually, so talk to us before your first invoice.`;
              }

              const now = plan.overridden
                ? `You're on ${TIER_LABEL[tier] ?? tier} (${band(current)}) at an agreed price of ${money(plan.payable)} a month.`
                : `You're on ${TIER_LABEL[tier] ?? tier} — ${band(current)} at ${money(plan.payable ?? plan.mrr)} a month, billed here.`;

              return next
                ? `${now} At ${next.minUnits} units you move to ${TIER_LABEL[next.tier] ?? next.tier} at ${money(next.price)} a month.`
                : `${now} This is the largest published band.`;
            })()}
          </p>
        </GlassCard>
      )}

      {plan?.payTo && rows.some((i) => i.status !== 'paid' && i.status !== 'void') && (
        <GlassCard className="mb-4">
          <div className="font-heading text-base font-bold text-ink">Paying by EFT</div>
          <p className="mt-1 text-sm text-muted">
            Card and instant EFT are handled by the Pay button below. To pay by ordinary bank
            transfer, use these details and <span className="font-medium text-ink">quote the
            reference for the invoice you are paying</span> — it is how we match your payment.
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Bank</dt><dd className="font-medium text-ink">{plan.payTo.bank}</dd></div>
            <div><dt className="text-muted">Account name</dt><dd className="font-medium text-ink">{plan.payTo.accountName}</dd></div>
            <div><dt className="text-muted">Account number</dt><dd className="font-medium text-ink tabular-nums">{plan.payTo.accountNumber}</dd></div>
            <div><dt className="text-muted">Branch code</dt><dd className="font-medium text-ink tabular-nums">{plan.payTo.branchCode}</dd></div>
            {plan.payTo.swift && (
              <div><dt className="text-muted">SWIFT</dt><dd className="font-medium text-ink">{plan.payTo.swift}</dd></div>
            )}
          </dl>
          <p className="mt-3 text-xs text-muted">
            An EFT is reconciled by hand, so allow a working day after payment before the invoice
            shows as paid.
          </p>
        </GlassCard>
      )}

      <GlassCard className="!p-0 overflow-hidden">
        <div className="px-5 pt-5 font-heading text-base font-bold text-ink">Invoices</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Period</th><th className="px-5 py-3 font-semibold">Plan</th><th className="px-5 py-3 font-semibold">Units</th><th className="px-5 py-3 font-semibold">Amount</th><th className="px-5 py-3 font-semibold">Due</th><th className="px-5 py-3 font-semibold">EFT reference</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium text-ink">{i.period}</td>
                  <td className="px-5 py-3 capitalize">{i.tier}</td>
                  <td className="px-5 py-3">{i.unitCount}</td>
                  <td className="px-5 py-3 font-semibold text-ink">{money(i.amount)}</td>
                  <td className="px-5 py-3 text-muted">{i.dueDate ?? '—'}</td>
                  <td className="px-5 py-3 font-mono text-xs text-ink">{i.payReference ?? '—'}</td>
                  <td className="px-5 py-3"><Badge tone={tone(i.status)}>{i.status}</Badge></td>
                  <td className="px-5 py-3">{i.status === 'issued' && <Button variant="ghost" loading={busy === i.id} onClick={() => pay(i.id)}><CreditCard size={14} /> Pay</Button>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8}><EmptyState>No subscription invoices yet.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
