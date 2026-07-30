'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, BentoTile, EmptyState, money } from '@/components/ui';

const tone = (s: string): 'success' | 'brand' | 'muted' => (s === 'paid' ? 'success' : s === 'void' ? 'muted' : 'brand');
const TIER_LABEL: Record<string, string> = { starter: 'Starter (free)', growth: 'Growth', enterprise: 'Enterprise' };

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

  return (
    <div>
      <PageHeader title="Billing" subtitle="Your plan and monthly subscription invoices" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <BentoTile tone={tier === 'growth' ? 'teal' : tier === 'enterprise' ? 'purple' : 'blue'} value={TIER_LABEL[tier] ?? tier} label="Your plan" />
        <BentoTile tone="blue" value={String(plan?.unitCount ?? 0)} label="Billable units" />
        <BentoTile tone="amber" value={money(plan?.mrr ?? 0)} label="Monthly fee" />
      </div>

      {tier === 'starter' && (
        <GlassCard className="mb-4">
          <p className="text-sm text-muted">You're on the free Starter plan (up to 10 units). Once you pass 10 units you move to Growth at R250/unit/month, billed here.</p>
        </GlassCard>
      )}

      <GlassCard className="!p-0 overflow-hidden">
        <div className="px-5 pt-5 font-heading text-base font-bold text-ink">Invoices</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Period</th><th className="px-5 py-3 font-semibold">Plan</th><th className="px-5 py-3 font-semibold">Units</th><th className="px-5 py-3 font-semibold">Amount</th><th className="px-5 py-3 font-semibold">Due</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium text-ink">{i.period}</td>
                  <td className="px-5 py-3 capitalize">{i.tier}</td>
                  <td className="px-5 py-3">{i.unitCount}</td>
                  <td className="px-5 py-3 font-semibold text-ink">{money(i.amount)}</td>
                  <td className="px-5 py-3 text-muted">{i.dueDate ?? '—'}</td>
                  <td className="px-5 py-3"><Badge tone={tone(i.status)}>{i.status}</Badge></td>
                  <td className="px-5 py-3">{i.status === 'issued' && <Button variant="ghost" loading={busy === i.id} onClick={() => pay(i.id)}><CreditCard size={14} /> Pay</Button>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7}><EmptyState>No subscription invoices yet.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
