'use client';

/**
 * The agency dashboard.
 *
 * BUILT ON TOKENS, NOT ON A PALETTE. The previous version painted its tiles
 * with hardcoded pastels (#AFA9EC, #9FE1CB, #B5D4F4), which meant two things:
 * no agency's brand could ever reach them — on a white-label product — and the
 * screen could not follow a theme. Everything here reads --card, --ink,
 * --line, --brand, --danger and --accent, so the same markup is a calm light
 * back office for one deployment and a dark console for another, and an
 * agency's own colour actually shows up.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { Button, EmptyState } from '@/components/ui';
import { useLocale } from '@/components/locale-provider';
import { useDeployment } from '@/components/deployment-provider';
import RecordPaymentModal from '@/components/record-payment';

const thisPeriod = () => new Date().toISOString().slice(0, 7);

/** The calendar month before `period` ("2026-10" -> "2026-09"). */
function previousPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

export default function Dashboard() {
  const router = useRouter();
  const { t, tn, money, number } = useLocale();
  // Recording a payment by hand exists only where no gateway is collecting.
  // The API refuses it anyway; this keeps a button that would 403 off screen.
  const { capabilities } = useDeployment();
  const [payFor, setPayFor] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [rentRoll, setRentRoll] = useState<any[]>([]);
  const [arrears, setArrears] = useState<any>(null);
  const [period, setPeriod] = useState(thisPeriod());
  const [collection, setCollection] = useState<any>(null);
  const [previous, setPrevious] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try {
      // The previous period is fetched only to work out the delta. It is
      // allowed to fail on its own — a brand-new agency has no September, and
      // that must not blank the whole dashboard.
      const [rr, ar, col, port, prev] = await Promise.all([
        api.rentRoll(),
        api.arrears(),
        api.collection(period),
        api.portfolioState().catch(() => null),
        api.collection(previousPeriod(period)).catch(() => null),
      ]);
      setRentRoll(rr); setArrears(ar); setCollection(col);
      setPortfolio(port); setPrevious(prev);
    } catch (e: any) { setErr(e.message); }
  }, [period]);

  useEffect(() => {
    if (!auth.get()) { router.replace('/login'); return; }
    setReady(true);
    void load();
  }, [router, load]);

  const runBilling = async () => {
    setBusy(true); setErr('');
    try { await api.runBilling(period, `${period}-07`); setTimeout(() => void load(), 1200); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ready) return null;

  const rate = collection ? Number(collection.collectionRate) : 0;
  const collected = collection ? Number(collection.collected) : 0;
  const billed = collection ? Number(collection.billed) : 0;
  const stillOut = Math.max(0, billed - collected);
  const overdueUnits = rentRoll.filter((r) => Number(r.outstanding) > 0).length;

  const prevCollected = previous ? Number(previous.collected) : 0;
  const delta = prevCollected > 0 ? ((collected - prevCollected) / prevCollected) * 100 : null;

  const summary = portfolio?.summary;
  const expiring = summary?.byState?.lease_expiring ?? null;

  // Worst first: the dashboard's job is triage, so the rows with money against
  // them lead. The old one listed in whatever order the query returned.
  const worstFirst = [...rentRoll]
    .sort((a, b) => Number(b.outstanding) - Number(a.outstanding))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            aria-label={t('dashboard.period')}
            className="input w-36"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            onBlur={() => void load()}
          />
          <Button onClick={() => void load()} aria-label={t('dashboard.refresh')}>
            <RefreshCw size={16} />
          </Button>
          <Button variant="primary" onClick={() => void runBilling()} disabled={busy}>
            {t('dashboard.runBilling')}
          </Button>
        </div>
      </div>

      {err && <div className="rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {/* Hero: the month, once and large, with the rate beside it. */}
      <div className="flex flex-wrap gap-4">
        <section className="glass min-w-0 flex-[999_1_26rem] p-6">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
            {t('dashboard.collectedFor', { period })}
          </span>
          <div className="tabular mt-3 text-[44px] font-bold leading-none tracking-tight text-ink">
            {money(collected)}
          </div>

          {delta !== null && (
            <span
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--brand) 16%, transparent)',
                color: 'var(--brand)',
              }}
            >
              <TrendingUp size={12} aria-hidden style={{ transform: delta < 0 ? 'scaleY(-1)' : undefined }} />
              {t('dashboard.deltaOnPrevious', {
                pct: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`,
                period: previousPeriod(period),
              })}
            </span>
          )}

          <p className="mt-2 text-sm text-muted">
            {t('dashboard.ofBilled', { amount: money(billed) })}
            {stillOut > 0 && ` · ${t('dashboard.stillOut', { amount: money(stillOut) })}`}
          </p>
        </section>

        <section className="glass grid min-w-0 flex-[1_1_16rem] place-items-center p-6">
          <Ring value={rate} />
        </section>
      </div>

      {/* Four figures. Occupancy, expiring and open jobs come from
          /reporting/portfolio-state, which already computes them. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t('dashboard.outstandingTotal')} value={money(arrears ? arrears.total : 0)}
          note={tn('dashboard.arrears', overdueUnits)} tone="var(--danger)" />
        <Stat label={t('dashboard.occupancy')}
          value={summary ? `${Math.round(summary.occupancyRate)}%` : '—'}
          note={summary ? t('dashboard.occupiedOf', { occupied: number(summary.occupied), total: number(summary.units) }) : ''} />
        <Stat label={t('dashboard.expiringSoon')}
          value={expiring === null ? '—' : number(expiring)}
          note={t('dashboard.leasesToRenew')} tone="var(--accent)" />
        <Stat label={t('dashboard.openJobs')}
          value={summary ? number(summary.openTickets) : '—'}
          note={t('dashboard.activeLeasesNote', { count: number(rentRoll.length) })} />
      </div>

      {arrears && (
        <section className="glass p-6">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-heading text-base font-bold text-ink">{t('dashboard.outstandingByAge')}</h2>
            <span className="tabular text-sm text-muted">{money(arrears.total)}</span>
          </div>
          <AgeingRows arrears={arrears} />
        </section>
      )}

      <section className="glass overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-3 p-6 pb-4">
          <h2 className="font-heading text-base font-bold text-ink">{t('dashboard.worstFirst')}</h2>
          <a href="/leases" className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
            {t('dashboard.allLeases', { count: number(rentRoll.length) })}
          </a>
        </div>
        {worstFirst.length === 0 ? (
          <div className="p-6 pt-0"><EmptyState>{t('dashboard.noLeases')}</EmptyState></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-muted"
                  style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}>
                  <th scope="col" className="px-6 py-3 font-semibold">{t('dashboard.th.unit')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('dashboard.th.tenant')}</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">{t('dashboard.th.rent')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('dashboard.th.status')}</th>
                  <th scope="col" className="px-6 py-3 text-right font-semibold">{t('dashboard.th.outstanding')}</th>
                  {capabilities.manualPayments && <th scope="col" className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {worstFirst.map((r) => (
                  <tr key={r.lease_id} className="border-t border-line">
                    <td className="px-6 py-4 font-medium text-ink">{r.unit}</td>
                    <td className="px-4 py-4 text-muted">{r.tenant ?? '—'}</td>
                    <td className="tabular px-4 py-4 text-right">{money(Number(r.rent_amount))}</td>
                    <td className="px-4 py-4"><StatusPill status={r.status} /></td>
                    <td className="tabular px-6 py-4 text-right font-bold"
                      style={{ color: Number(r.outstanding) > 0 ? 'var(--danger)' : 'var(--muted)' }}>
                      {Number(r.outstanding) > 0 ? money(Number(r.outstanding)) : '—'}
                    </td>
                    {capabilities.manualPayments && (
                      <td className="px-4 py-4 text-right">
                        {Number(r.outstanding) > 0 && (
                          <Button variant="ghost" onClick={() => setPayFor(r)}>
                            {t('payment.record')}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RecordPaymentModal
        row={payFor}
        onClose={() => setPayFor(null)}
        onRecorded={() => { setPayFor(null); void load(); }}
      />
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="glass p-5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">{label}</span>
      <div className="tabular mt-3 text-2xl font-bold leading-none" style={{ color: tone ?? 'var(--ink)' }}>{value}</div>
      {note && <div className="mt-2 text-xs text-muted">{note}</div>}
    </div>
  );
}

/** The collection ring. Stroke is the agency's colour, track is the surface. */
function Ring({ value }: { value: number }) {
  const { t } = useLocale();
  const pct = Math.max(0, Math.min(100, value));
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: 168, height: 168 }}>
      <svg width="168" height="168" viewBox="0 0 120 120" role="img"
        aria-label={t('dashboard.collectionRateIs', { pct: `${pct.toFixed(1)}%` })}>
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="12"
          stroke="color-mix(in srgb, var(--ink) 12%, transparent)" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="12" strokeLinecap="round"
          stroke="var(--brand)" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[30px] font-bold leading-none tracking-tight text-ink">{pct.toFixed(1)}%</span>
        <span className="mt-1 text-[11px] text-muted">{t('dashboard.collected')}</span>
      </div>
    </div>
  );
}

/**
 * Ageing as rows, not columns. Five vertical bars made the reader compare
 * heights across a baseline; a row per band puts the band, the bar, the amount
 * and the unit count on one line, which is the order the question is asked in.
 *
 * Fills come from tokens so the ramp survives a theme change: the oldest band
 * is --danger in both, and --muted and --accent flip with the surface.
 */
function AgeingRows({ arrears }: { arrears: any }) {
  const { t, money } = useLocale();
  const data = [
    { key: 'dashboard.aging.notYetDue', value: Number(arrears.notYetDue), fill: 'color-mix(in srgb, var(--muted) 45%, transparent)' },
    { key: 'dashboard.aging.0-30', value: Number(arrears['0-30']), fill: 'var(--muted)' },
    { key: 'dashboard.aging.31-60', value: Number(arrears['31-60']), fill: 'var(--accent)' },
    { key: 'dashboard.aging.61-90', value: Number(arrears['61-90']), fill: 'color-mix(in srgb, var(--accent) 45%, var(--danger))' },
    { key: 'dashboard.aging.90plus', value: Number(arrears['90+']), fill: 'var(--danger)' },
  ] as const;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => (
        <div key={d.key} className="flex items-center gap-4">
          <span className="w-28 shrink-0 text-xs text-ink">{t(d.key)}</span>
          <span className="h-3 min-w-0 flex-[999_1_6rem] rounded-full"
            style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}>
            <span aria-hidden className="block h-3 rounded-full"
              style={{ width: `${Math.max(1, (d.value / max) * 100)}%`, background: d.fill }} />
          </span>
          <span className="tabular w-28 shrink-0 text-right text-sm font-medium text-ink">
            {d.value > 0 ? money(d.value) : t('common.none')}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useLocale();
  const active = status === 'active';
  return (
    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={active
        ? { background: 'color-mix(in srgb, var(--ink) 7%, transparent)', color: 'var(--muted)' }
        : { background: 'var(--dangerbg)', color: 'var(--danger)' }}>
      {active ? t('dashboard.status.active') : status}
    </span>
  );
}
