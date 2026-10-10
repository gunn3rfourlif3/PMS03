'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, BentoTile, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';

export default function PartnerOverview() {
  const router = useRouter();
  const { t, money, dateTime } = useLocale();
  // Was a module-level `toLocaleString('en-ZA', …)`; it needs the locale, so it
  // moved inside the component.
  const when = (d?: string) => (d ? dateTime(d) : '');
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
      <PageHeader title={t('partner.title')} subtitle={t('partner.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoTile tone="teal" value={money(ov?.pipelineValue ?? 0)} label={t('partner.tile.pipelineValue')} />
        <BentoTile tone="blue" value={String(ov?.agenciesSigned ?? 0)} label={t('partner.tile.agenciesSigned')} chip={ov?.referredMrr ? t('partner.mrrChip', { amount: money(ov.referredMrr) }) : undefined} />
        <BentoTile tone="purple" value={String(ov?.activeDeals ?? 0)} label={t('partner.tile.activeDeals')} />
        <BentoTile tone="amber" value={String(ov?.demosThisWeek ?? 0)} label={t('partner.tile.demosThisWeek')} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoTile tone="green" value={money(ov?.commissionMtd ?? 0)} label={t('partner.tile.commissionMtd')} />
        <BentoTile tone="amber" value={money(ov?.commissionPending ?? 0)} label={t('partner.tile.pending')} />
        <BentoTile tone="blue" value={money(ov?.commissionPaid ?? 0)} label={t('partner.tile.paid')} />
        <div className="flex min-h-[104px] flex-col justify-between rounded-3xl border border-line bg-card p-5">
          <Trophy size={20} className="text-brand" />
          <div>
            <div className="font-heading text-2xl font-bold text-ink">{rank ? t('partner.rank', { pos: rank.pos }) : t('common.none')}</div>
            <div className="mt-1 text-xs font-medium text-muted">{rank ? t('partner.rankOf', { total: rank.total }) : t('partner.leaderboardRank')}</div>
          </div>
        </div>
      </div>

      <GlassCard className="mt-3">
        <div className="mb-3 font-heading text-base font-bold text-ink">{t('partner.recentActivity')}</div>
        <div className="divide-y divide-line text-sm">
          {acts.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2.5">
              <span className="text-ink">{a.summary || a.type}</span>
              <span className="text-xs text-muted">{when(a.createdAt)}</span>
            </div>
          ))}
          {acts.length === 0 && <EmptyState>{t('partner.noActivityYet')}</EmptyState>}
        </div>
      </GlassCard>
    </div>
  );
}
