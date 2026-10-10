'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Badge, BentoTile, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

const tone = (s: string): 'success' | 'brand' | 'muted' | 'danger' =>
  s === 'paid' ? 'success' : s === 'approved' ? 'brand' : s === 'cancelled' ? 'muted' : 'brand';

const STATUSES = ['pending', 'approved', 'paid', 'cancelled'] as const;
const statusLabel = (t: TFunction, st: string): string =>
  (STATUSES as readonly string[]).includes(st) ? t(`partner.commissions.status.${st}` as MessageKey) : st;

export default function PartnerCommissionsPage() {
  const router = useRouter();
  const { t, money, percent } = useLocale();
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
      <PageHeader title={t('partner.commissions.title')} subtitle={t('partner.commissions.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <BentoTile tone="amber" value={money(sum?.pending ?? 0)} label={t('partner.commissions.tile.pending')} />
        <BentoTile tone="green" value={money(sum?.paidMtd ?? 0)} label={t('partner.commissions.tile.paidMtd')} />
        <BentoTile tone="blue" value={money(sum?.paid ?? 0)} label={t('partner.commissions.tile.paid')} />
      </div>

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">{t('partner.commissions.th.period')}</th><th className="px-5 py-3 font-semibold">{t('partner.commissions.th.agency')}</th><th className="px-5 py-3 font-semibold">{t('partner.commissions.th.basisMrr')}</th><th className="px-5 py-3 font-semibold">{t('partner.commissions.th.rate')}</th><th className="px-5 py-3 font-semibold">{t('partner.commissions.th.amount')}</th><th className="px-5 py-3 font-semibold">{t('partner.commissions.th.status')}</th>
            </tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium text-ink">{c.period}</td>
                  <td className="px-5 py-3">{c.agencyName ?? t('common.none')}</td>
                  <td className="px-5 py-3">{money(c.basisMrr)}</td>
                  {/* The rate is the API's own value for this commission row —
                      the page states no rate of its own. */}
                  <td className="px-5 py-3">{percent(Number(c.rate), 0)}</td>
                  <td className="px-5 py-3 font-semibold text-ink">{money(c.amount)}</td>
                  <td className="px-5 py-3"><Badge tone={tone(c.status)}>{statusLabel(t, c.status)}</Badge></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6}><EmptyState>{t('partner.commissions.empty')}</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
