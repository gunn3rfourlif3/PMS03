'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Badge, BentoTile, EmptyState, money } from '@/components/ui';

const tone = (s: string): 'success' | 'brand' | 'muted' | 'danger' =>
  s === 'paid' ? 'success' : s === 'approved' ? 'brand' : s === 'cancelled' ? 'muted' : 'brand';

export default function PartnerCommissionsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [sum, setSum] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    (async () => {
      try {
        const [c, s] = await Promise.all([api.partnerCommissions(), api.partnerCommissionSummary()]);
        setRows(c); setSum(s);
      } catch (e: any) { setErr(e.message); }
    })();
    // eslint-disable-next-line
  }, []);

  if (!ready) return null;

  return (
    <div>
      <PageHeader title="Commissions" subtitle="Recurring commission on your referred agencies' subscriptions" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <BentoTile tone="amber" value={money(sum?.pending ?? 0)} label="Pending" />
        <BentoTile tone="green" value={money(sum?.paidMtd ?? 0)} label="Paid this month" />
        <BentoTile tone="blue" value={money(sum?.paid ?? 0)} label="Paid to date" />
      </div>

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Period</th><th className="px-5 py-3 font-semibold">Agency</th><th className="px-5 py-3 font-semibold">Basis MRR</th><th className="px-5 py-3 font-semibold">Rate</th><th className="px-5 py-3 font-semibold">Amount</th><th className="px-5 py-3 font-semibold">Status</th>
            </tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium text-ink">{c.period}</td>
                  <td className="px-5 py-3">{c.agencyName ?? '—'}</td>
                  <td className="px-5 py-3">{money(c.basisMrr)}</td>
                  <td className="px-5 py-3">{Math.round(Number(c.rate) * 100)}%</td>
                  <td className="px-5 py-3 font-semibold text-ink">{money(c.amount)}</td>
                  <td className="px-5 py-3"><Badge tone={tone(c.status)}>{c.status}</Badge></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6}><EmptyState>No commissions yet — they accrue monthly on paid agencies.</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
