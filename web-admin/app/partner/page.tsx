'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, BentoTile, EmptyState, money } from '@/components/ui';

const when = (d?: string) => (d ? new Date(d).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function PartnerOverview() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [ov, setOv] = useState<any>(null);
  const [rank, setRank] = useState<{ pos: number; total: number } | null>(null);
  const [acts, setActs] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    (async () => {
      try {
        const [o, me, board, a, cs] = await Promise.all([
          api.partnerOverview(), api.partnerMe(), api.partnerLeaderboard(), api.partnerActivities(), api.partnerCommissionSummary().catch(() => null),
        ]);
        setOv({ ...o, commissionMtd: cs?.paidMtd ?? 0, commissionPending: cs?.pending ?? 0, commissionPaid: cs?.paid ?? 0 });
        setActs(a.slice(0, 6));
        const idx = (board as any[]).findIndex((r) => r.partnerId === me.id);
        if (idx >= 0) setRank({ pos: idx + 1, total: board.length });
      } catch (e: any) { setErr(e.message); }
    })();
    // eslint-disable-next-line
  }, []);

  if (!ready) return null;

  return (
    <div>
      <PageHeader title="Partner overview" subtitle="Your software-sales pipeline, agencies and commission" />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoTile tone="teal" value={money(ov?.pipelineValue ?? 0)} label="Pipeline value" />
        <BentoTile tone="blue" value={String(ov?.agenciesSigned ?? 0)} label="Agencies signed" chip={ov?.referredMrr ? `${money(ov.referredMrr)} MRR` : undefined} />
        <BentoTile tone="purple" value={String(ov?.activeDeals ?? 0)} label="Active deals" />
        <BentoTile tone="amber" value={String(ov?.demosThisWeek ?? 0)} label="Demos this week" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoTile tone="green" value={money(ov?.commissionMtd ?? 0)} label="Commission MTD" />
        <BentoTile tone="amber" value={money(ov?.commissionPending ?? 0)} label="Pending" />
        <BentoTile tone="blue" value={money(ov?.commissionPaid ?? 0)} label="Paid" />
        <div className="flex min-h-[104px] flex-col justify-between rounded-3xl border border-line bg-card p-5">
          <Trophy size={20} className="text-brand" />
          <div>
            <div className="font-heading text-2xl font-bold text-ink">{rank ? `#${rank.pos}` : '—'}</div>
            <div className="mt-1 text-xs font-medium text-muted">{rank ? `of ${rank.total} partners` : 'Leaderboard rank'}</div>
          </div>
        </div>
      </div>

      <GlassCard className="mt-3">
        <div className="mb-3 font-heading text-base font-bold text-ink">Recent activity</div>
        <div className="divide-y divide-line text-sm">
          {acts.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2.5">
              <span className="text-ink">{a.summary || a.type}</span>
              <span className="text-xs text-muted">{when(a.createdAt)}</span>
            </div>
          ))}
          {acts.length === 0 && <EmptyState>No activity yet — add a deal to get started.</EmptyState>}
        </div>
      </GlassCard>
    </div>
  );
}
