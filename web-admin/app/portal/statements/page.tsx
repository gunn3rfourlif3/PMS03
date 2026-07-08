'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth, isOwner } from '@/lib/api';
import { GlassCard, PageHeader, Badge, EmptyState, money } from '@/components/ui';

export default function PortalStatements() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    if (!isOwner()) { router.replace('/'); return; }
    setReady(true);
    api.portalStatements().then(setRows).catch((e) => setErr(e.message));
  }, []);

  if (!ready) return null;

  return (
    <div>
      <PageHeader title="Statements" subtitle="Monthly collections, fees and payouts" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      <GlassCard className="!p-0 overflow-hidden">
        <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_1.1fr] gap-3 border-b border-white/40 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
          <span>Period</span><span className="text-right">Collected</span><span className="text-right">Fee</span><span className="text-right">Net payout</span><span className="text-right">Status</span>
        </div>
        <div className="divide-y divide-white/40">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-2 gap-2 px-5 py-4 sm:grid-cols-[1fr_1fr_1fr_1fr_1.1fr] sm:gap-3">
              <span className="font-medium text-ink">{r.period}</span>
              <span className="text-right text-ink/80">{money(r.grossCollected)}</span>
              <span className="text-right text-muted">-{money(r.managementFee)}</span>
              <span className="text-right font-semibold text-ink">{money(r.netPayout)}</span>
              <span className="col-span-2 flex justify-start sm:col-span-1 sm:justify-end">
                <Badge tone={r.status === 'paid_out' ? 'success' : 'brand'}>
                  {r.status === 'paid_out' ? `Paid ${r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-ZA') : ''}` : 'Awaiting payout'}
                </Badge>
              </span>
            </div>
          ))}
          {rows.length === 0 && <EmptyState>No statements yet.</EmptyState>}
        </div>
      </GlassCard>
    </div>
  );
}
