'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { GlassCard, PageHeader, Button, Badge, BentoTile, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import type { MessageKey, TFunction } from '@shared/i18n';

const tone = (s: string): 'success' | 'brand' | 'muted' => (s === 'paid' ? 'success' : s === 'void' ? 'muted' : 'brand');
const TIERS = ['custom', 'starter', 'growth', 'scale', 'enterprise'] as const;
/* A tier the API adds later renders as itself, as the old
   `TIER_LABEL[tier] ?? tier` did. */
const tierLabel = (t: TFunction, tier: string): string =>
  (TIERS as readonly string[]).includes(tier) ? t(`billing.tier.${tier}` as MessageKey) : tier;

const STATUSES = ['issued', 'paid', 'void'] as const;
const statusLabel = (t: TFunction, st: string): string =>
  (STATUSES as readonly string[]).includes(st) ? t(`billing.status.${st}` as MessageKey) : st;

const band = (t: TFunction, b?: { minUnits: number; maxUnits: number | null }) =>
  !b ? '' : b.maxUnits === null
    ? t('billing.band.plus', { min: b.minUnits })
    : t('billing.band.range', { min: b.minUnits, max: b.maxUnits });

export default function BillingPage() {
  const router = useRouter();
  const { t, tn, money, date } = useLocale();
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
      else { setErr(t('billing.paymentStarted', { ref: r.providerRef })); await load(); }
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!ready) return null;
  const tier = plan?.tier ?? 'starter';

  const entryBand = (plan?.ladder ?? [])[0];
  // Billing refuses to invoice an agency charged for units it does not have
  // until a price is agreed (SubscriptionBillingService.generate). Showing a
  // figure we will not charge would contradict the paragraph under the tile.
  const awaitingAgreedPrice =
    !!plan && tier === 'custom' && !plan.overridden &&
    !!plan.custom && (plan.unitCount ?? 0) > 0 && (plan.unitCount ?? 0) < plan.custom.minUnits;

  return (
    <div>
      <PageHeader title={t('billing.title')} subtitle={t('billing.subtitle')} />
      {err && <div className="mb-4 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <BentoTile tone={tier === 'growth' ? 'teal' : tier === 'enterprise' ? 'purple' : 'blue'} value={tierLabel(t, tier)} label={t('billing.tile.yourPlan')} />
        <BentoTile tone="blue"
          value={String(plan?.custom?.billableUnits ?? plan?.unitCount ?? 0)}
          label={plan?.custom && plan.custom.billableUnits !== plan.unitCount
            ? t('billing.tile.billableUnitsMin', { min: plan.custom.minUnits })
            : t('billing.tile.billableUnits')} />
        <BentoTile tone="amber"
          value={awaitingAgreedPrice ? t('billing.byArrangement') : money(plan?.payable ?? plan?.mrr ?? 0)}
          label={plan?.overridden ? t('billing.tile.monthlyFeeAgreed') : t('billing.tile.monthlyFee')} />
      </div>

      {plan && tier !== 'enterprise' && (
        <GlassCard className="mb-4">
          <p className="text-sm text-muted">
            {(() => {
              const units = plan.unitCount ?? 0;
              const current = (plan.ladder ?? []).find((b: any) => b.tier === tier);
              const next = plan.nextBand;
              const entry = (plan.ladder ?? [])[0];

              // Custom is priced per unit, not by band, so the ladder copy does
              // not apply. Show the arithmetic: rate, units charged, total.
              if (tier === 'custom' && plan.custom) {
                const { unitRate, billableUnits, minUnits } = plan.custom;
                if (plan.overridden) {
                  return t('billing.custom.agreed', {
                    amount: money(plan.payable),
                    units: tn('billing.units', units),
                    band: band(t, entry),
                  });
                }
                if (awaitingAgreedPrice) {
                  return t('billing.custom.belowMin', { units: tn('billing.units', units), min: minUnits });
                }
                const line = t('billing.custom.line', {
                  tier: tierLabel(t, 'custom'),
                  billable: billableUnits,
                  rate: money(unitRate),
                  total: money(plan.payable ?? plan.mrr),
                });
                return entry
                  ? `${line} ${t('billing.moveUp', { min: entry.minUnits, tier: tierLabel(t, entry.tier), price: money(entry.price) })}`
                  : line;
              }

              const now = plan.overridden
                ? t('billing.now.agreed', { tier: tierLabel(t, tier), band: band(t, current), amount: money(plan.payable) })
                : t('billing.now.published', { tier: tierLabel(t, tier), band: band(t, current), amount: money(plan.payable ?? plan.mrr) });

              return next
                ? `${now} ${t('billing.moveUp', { min: next.minUnits, tier: tierLabel(t, next.tier), price: money(next.price) })}`
                : `${now} ${t('billing.largestBand')}`;
            })()}
          </p>
        </GlassCard>
      )}

      {plan?.payTo && rows.some((i) => i.status !== 'paid' && i.status !== 'void') && (
        <GlassCard className="mb-4">
          <div className="font-heading text-base font-bold text-ink">{t('billing.eft.title')}</div>
          <p className="mt-1 text-sm text-muted">
            {t('billing.eft.blurb')}{' '}
            {/* The emphasis used to sit on a clause inside this paragraph. A
                clause split across JSX cannot be reordered by a translator, so
                it is now its own whole sentence and the emphasis covers it. */}
            <span className="font-medium text-ink">{t('billing.eft.quoteReference')}</span>
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">{t('billing.eft.bank')}</dt><dd className="font-medium text-ink">{plan.payTo.bank}</dd></div>
            <div><dt className="text-muted">{t('billing.eft.accountName')}</dt><dd className="font-medium text-ink">{plan.payTo.accountName}</dd></div>
            <div><dt className="text-muted">{t('billing.eft.accountNumber')}</dt><dd className="font-medium text-ink tabular-nums">{plan.payTo.accountNumber}</dd></div>
            <div><dt className="text-muted">{t('billing.eft.branchCode')}</dt><dd className="font-medium text-ink tabular-nums">{plan.payTo.branchCode}</dd></div>
            {plan.payTo.swift && (
              <div><dt className="text-muted">{t('billing.eft.swift')}</dt><dd className="font-medium text-ink">{plan.payTo.swift}</dd></div>
            )}
          </dl>
          <p className="mt-3 text-xs text-muted">{t('billing.eft.footnote')}</p>
        </GlassCard>
      )}

      <GlassCard className="!p-0 overflow-hidden">
        <div className="px-5 pt-5 font-heading text-base font-bold text-ink">{t('billing.invoices')}</div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">{t('billing.th.period')}</th><th className="px-5 py-3 font-semibold">{t('billing.th.plan')}</th><th className="px-5 py-3 font-semibold">{t('billing.th.units')}</th><th className="px-5 py-3 font-semibold">{t('billing.th.amount')}</th><th className="px-5 py-3 font-semibold">{t('billing.th.due')}</th><th className="px-5 py-3 font-semibold">{t('billing.th.eftReference')}</th><th className="px-5 py-3 font-semibold">{t('billing.th.status')}</th><th className="px-5 py-3"></th>
            </tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t border-line hover:bg-black/[0.02]">
                  <td className="px-5 py-3 font-medium text-ink">{i.period}</td>
                  <td className="px-5 py-3">{tierLabel(t, i.tier)}</td>
                  <td className="px-5 py-3">{i.unitCount}</td>
                  <td className="px-5 py-3 font-semibold text-ink">{money(i.amount)}</td>
                  <td className="px-5 py-3 text-muted">{i.dueDate ? date(i.dueDate) : t('common.none')}</td>
                  <td className="px-5 py-3 font-mono text-xs text-ink">{i.payReference ?? t('common.none')}</td>
                  <td className="px-5 py-3"><Badge tone={tone(i.status)}>{statusLabel(t, i.status)}</Badge></td>
                  <td className="px-5 py-3">{i.status === 'issued' && <Button variant="ghost" loading={busy === i.id} onClick={() => pay(i.id)}><CreditCard size={14} /> {t('billing.pay')}</Button>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8}><EmptyState>{t('billing.empty')}</EmptyState></td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
