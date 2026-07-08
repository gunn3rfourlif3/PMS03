'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Wallet, TrendingUp, Home } from 'lucide-react';
import { api, auth, isOwner } from '@/lib/api';
import { GlassCard, PageHeader, Metric, Badge, Progress, money } from '@/components/ui';

export default function PortalOverview() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [s, setS] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    if (!isOwner()) { router.replace('/'); return; }
    setReady(true);
    api.portalSummary().then(setS).catch((e) => setErr(e.message));
  }, []);

  if (!ready) return null;

  return (
    <div>
      <PageHeader title={s ? `Welcome, ${s.name}` : 'Owner portal'} subtitle="Your portfolio at a glance" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      {!s ? null : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric label="Properties" value={s.properties} icon={<Building2 size={16} />} />
            <Metric label="Monthly rent" value={money(s.monthlyRent)} icon={<TrendingUp size={16} />} accent />
            <Metric label="Paid to date" value={money(s.paidToDate)} icon={<Wallet size={16} />} tone="success" />
            <Metric label="Awaiting payout" value={money(s.pendingPayout)} icon={<Wallet size={16} />} tone={s.pendingPayout > 0 ? 'danger' : undefined} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-muted">Occupancy</span>
                <span className="font-heading text-lg font-bold text-ink">{s.occupancyPct}%</span>
              </div>
              <Progress value={s.occupancyPct} />
              <div className="mt-2 flex items-center gap-1.5 text-sm text-muted"><Home size={14} /> {s.occupied} of {s.units} units occupied</div>
            </GlassCard>

            <GlassCard>
              <span className="text-sm text-muted">Latest statement</span>
              {s.latestStatement ? (
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <div className="font-heading text-xl font-bold text-ink">{money(s.latestStatement.netPayout)}</div>
                    <div className="text-sm text-muted">for {s.latestStatement.period}</div>
                  </div>
                  <Badge tone={s.latestStatement.status === 'paid_out' ? 'success' : 'brand'}>
                    {s.latestStatement.status === 'paid_out' ? 'Paid out' : 'Awaiting payout'}
                  </Badge>
                </div>
              ) : <div className="mt-2 text-sm text-muted">No statements yet.</div>}
              {!s.bankingOnFile && (
                <div className="mt-3 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">
                  Add your banking details so we can pay you out.
                </div>
              )}
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
