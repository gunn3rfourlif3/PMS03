'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Wallet, TrendingUp, Home } from 'lucide-react';
import { api, auth, isOwner } from '@/lib/api';
import { GlassCard, PageHeader, Metric, Badge, Progress } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';

export default function PortalOverview() {
  const router = useRouter();
  const { t, money, percent } = useLocale();
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
      <PageHeader title={s ? t('portal.welcome', { name: s.name }) : t('portal.titleFallback')} subtitle={t('portal.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}
      {!s ? null : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric label={t('portal.metric.properties')} value={s.properties} icon={<Building2 size={16} />} />
            <Metric label={t('portal.metric.monthlyRent')} value={money(s.monthlyRent)} icon={<TrendingUp size={16} />} accent />
            <Metric label={t('portal.metric.paidToDate')} value={money(s.paidToDate)} icon={<Wallet size={16} />} tone="success" />
            <Metric label={t('portal.metric.awaitingPayout')} value={money(s.pendingPayout)} icon={<Wallet size={16} />} tone={s.pendingPayout > 0 ? 'danger' : undefined} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-muted">{t('portal.occupancy')}</span>
                <span className="font-heading text-lg font-bold text-ink">{percent(s.occupancyPct / 100, 0)}</span>
              </div>
              <Progress value={s.occupancyPct} />
              <div className="mt-2 flex items-center gap-1.5 text-sm text-muted"><Home size={14} /> {t('portal.unitsOccupied', { occupied: s.occupied, units: s.units })}</div>
            </GlassCard>

            <GlassCard>
              <span className="text-sm text-muted">{t('portal.latestStatement')}</span>
              {s.latestStatement ? (
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <div className="font-heading text-xl font-bold text-ink">{money(s.latestStatement.netPayout)}</div>
                    <div className="text-sm text-muted">{t('portal.forPeriod', { period: s.latestStatement.period })}</div>
                  </div>
                  <Badge tone={s.latestStatement.status === 'paid_out' ? 'success' : 'brand'}>
                    {s.latestStatement.status === 'paid_out' ? t('portal.paidOut') : t('portal.awaitingPayout')}
                  </Badge>
                </div>
              ) : <div className="mt-2 text-sm text-muted">{t('portal.noStatements')}</div>}
              {!s.bankingOnFile && (
                <div className="mt-3 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">
                  {t('portal.addBanking')}
                </div>
              )}
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
