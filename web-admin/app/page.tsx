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

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
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
  const { t, tn, money, number, locale } = useLocale();
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

  // The period is a 'YYYY-MM' string; render it as a month in the reader's own
  // locale rather than showing them the key.
  const periodLabel = (() => {
    const [y, m] = period.split('-').map(Number);
    if (!y || !m) return period;
    return new Date(Date.UTC(y, m - 1, 1))
      .toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  })();
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'dashboard.greetingMorning'
    : hour < 18 ? 'dashboard.greetingAfternoon'
    : 'dashboard.greetingEvening');

  // Worst first: the dashboard's job is triage, so the rows with money against
  // them lead. The old one listed in whatever order the query returned.
  const worstFirst = [...rentRoll]
    .sort((a, b) => Number(b.outstanding) - Number(a.outstanding))
    .slice(0, 6);

  // Bars under the tiles: each a ratio the tile's own figure is measured against.
  const pct = (n: number, d: number) => (d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0);
  const outstandingTotal = arrears ? Number(arrears.total) : 0;
  const leases = rentRoll.length;
  const occupied = summary ? Number(summary.occupied) : 0;
  const units = summary ? Number(summary.units) : 0;

  return (
    <div className="flex flex-col">
      {/* Header: the month, a greeting, the controls. Sample: 24px below. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">{periodLabel}</p>
          <h1 className="mt-1.5 font-heading text-[28px] leading-[1.08] text-ink">{greeting}</h1>
          <p className="mt-1.5 text-[15px] text-muted">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            aria-label={t('dashboard.period')}
            className="input !w-32"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            onBlur={() => void load()}
          />
          <Button variant="ghost" onClick={() => void load()} aria-label={t('dashboard.refresh')}>
            <RefreshCw size={15} />
          </Button>
          <Button variant="primary" onClick={() => void runBilling()} disabled={busy}>
            {t('dashboard.runBilling')}
          </Button>
        </div>
      </div>

      {err && <div className="mb-3.5 rounded-xl bg-dangerbg px-3 py-2 text-sm text-danger">{err}</div>}

      {/* Four tiles. Sample: 14px gap, 14px below. */}
      <div className="mb-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={t('dashboard.collectedFor', { period })}
          value={money(collected)}
          note={delta !== null
            ? <><span style={{ color: 'var(--success)', fontWeight: 700 }}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%</span>{' '}
                {t('dashboard.deltaOnPrevious', { pct: '', period: previousPeriod(period) }).trim()}</>
            : t('dashboard.ofBilled', { amount: money(billed) })}
          fill={pct(collected, billed)}
        />
        <Tile
          label={t('dashboard.outstandingTotal')}
          value={money(outstandingTotal)}
          note={tn('dashboard.arrears', overdueUnits)}
          fill={pct(outstandingTotal, Math.max(billed, outstandingTotal))}
          tone="warn"
        />
        <Tile
          label={t('dashboard.expiringSoon')}
          value={expiring === null ? '—' : number(expiring)}
          note={t('dashboard.leasesToRenew')}
          fill={pct(Number(expiring ?? 0), leases)}
        />
        <Tile
          label={t('dashboard.openJobs')}
          value={summary ? number(summary.openTickets) : '—'}
          note={t('dashboard.activeLeasesNote', { count: number(leases) })}
          fill={pct(summary ? Number(summary.openTickets) : 0, leases)}
        />
      </div>

      {/* Rent roll beside the rail. Sample: 1.55fr / 1fr, 14px gap. */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <section className="glass min-w-0 p-5">
          <div className="mb-3.5 flex items-center justify-between gap-3.5">
            <h2 className="font-heading text-[17px] tracking-[-0.02em] text-ink">{t('dashboard.rentRoll')}</h2>
            <a href="/leases" className="btn btn-ghost !h-8 !px-3.5 !text-[12.5px]">
              {t('dashboard.allLeases', { count: number(leases) })}
            </a>
          </div>
          {worstFirst.length === 0 ? (
            <EmptyState>{t('dashboard.noLeases')}</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse tabular-nums">
                <thead>
                  <tr>
                    <th scope="col" className="dash-th">{t('dashboard.th.unit')}</th>
                    <th scope="col" className="dash-th">{t('dashboard.th.tenant')}</th>
                    <th scope="col" className="dash-th text-right">{t('dashboard.th.rent')}</th>
                    <th scope="col" className="dash-th text-right">{t('dashboard.th.outstanding')}</th>
                    <th scope="col" className="dash-th text-right">{t('dashboard.th.status')}</th>
                    {capabilities.manualPayments && <th scope="col" className="dash-th" />}
                  </tr>
                </thead>
                <tbody>
                  {worstFirst.map((r) => {
                    const owing = Number(r.outstanding) > 0;
                    return (
                      <tr key={r.lease_id} className="dash-tr">
                        <td className="dash-td">
                          <b className="font-bold text-ink">{r.unit}</b>
                          {/* The property under the unit, as in the sample — but not
                              where the unit label already starts with it. */}
                          {r.property_name && !String(r.unit).startsWith(r.property_name) && (
                            <small className="block text-[12px] text-muted">{r.property_name}</small>
                          )}
                        </td>
                        <td className="dash-td">{r.tenant_name || '—'}</td>
                        <td className="dash-td dash-num">{number(Number(r.rent_amount))}</td>
                        <td className="dash-td dash-num">{owing ? number(Number(r.outstanding)) : '—'}</td>
                        <td className="dash-td text-right">
                          <span className={owing ? 'dash-pill dash-pill-warn' : 'dash-pill dash-pill-ok'}>
                            {owing ? t('dashboard.status.owing') : t('dashboard.status.paid')}
                          </span>
                        </td>
                        {capabilities.manualPayments && (
                          <td className="dash-td text-right">
                            {owing && (
                              <Button variant="ghost" onClick={() => setPayFor(r)}>{t('payment.record')}</Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-3.5">
          <section className="glass p-5">
            <h2 className="mb-3.5 font-heading text-[17px] tracking-[-0.02em] text-ink">{t('dashboard.occupancy')}</h2>
            <div className="flex items-center gap-[18px]">
              <OccupancyRing pctValue={summary ? Number(summary.occupancyRate) : 0} />
              <div className="text-[13.5px]">
                <p><b className="dash-fig">{number(occupied)}</b> {t('dashboard.occupiedLabel')}</p>
                <p className="mt-1"><b className="dash-fig">{number(Math.max(0, units - occupied))}</b> {t('dashboard.vacantLabel')}</p>
                <p className="mt-2 text-[12.5px] text-muted">
                  {summary ? t('dashboard.occupiedOf', { occupied: number(occupied), total: number(units) }) : '—'}
                </p>
              </div>
            </div>
          </section>

          {arrears && (
            <section className="glass p-5">
              <div className="mb-3.5 flex items-baseline justify-between gap-3">
                <h2 className="font-heading text-[17px] tracking-[-0.02em] text-ink">{t('dashboard.outstandingByAge')}</h2>
                <span className="dash-fig text-[13px]">{money(outstandingTotal)}</span>
              </div>
              <AgeingRows arrears={arrears} />
            </section>
          )}
        </aside>
      </div>

      <RecordPaymentModal
        row={payFor}
        onClose={() => setPayFor(null)}
        onRecorded={() => { setPayFor(null); void load(); }}
      />
    </div>
  );
}

/** Sample tile: micro-label, 30px figure, one-line note, ratio bar. */
function Tile({ label, value, note, fill, tone }: {
  label: string; value: string; note?: React.ReactNode; fill: number; tone?: 'warn';
}) {
  return (
    <div className="glass p-5">
      <p className="eyebrow mb-2.5">{label}</p>
      <div className="dash-fig text-[30px] leading-[1.05] tracking-[-0.035em]">{value}</div>
      {note && <div className="mt-1.5 text-[12.5px] text-muted">{note}</div>}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}>
        <i className="block h-full rounded-full" style={{
          width: `${fill}%`,
          background: tone === 'warn'
            ? '#C8873F'
            : 'linear-gradient(90deg, color-mix(in srgb, var(--brand) 70%, white), var(--brand))',
        }} />
      </div>
    </div>
  );
}

/** Sample ring: 104px, 78px centre, the figure inside. */
function OccupancyRing({ pctValue }: { pctValue: number }) {
  const p = Math.max(0, Math.min(100, pctValue));
  return (
    <div className="grid h-[104px] w-[104px] flex-none place-items-center rounded-full"
      style={{ background: `conic-gradient(var(--brand) 0 ${p}%, color-mix(in srgb, var(--ink) 7%, transparent) 0)` }}>
      <span className="dash-fig grid h-[78px] w-[78px] place-items-center rounded-full text-[20px]"
        style={{ background: 'var(--card)' }}>
        {Math.round(p)}%
      </span>
    </div>
  );
}

/**
 * Ageing as rows: band, bar, amount on one line, which is the order the
 * question is asked in. Sample: 13px rows, 7px track, 11px gap.
 */
function AgeingRows({ arrears }: { arrears: any }) {
  const { t, money } = useLocale();
  const data = [
    { key: 'dashboard.aging.notYetDue', value: Number(arrears.notYetDue), fill: 'var(--success)' },
    { key: 'dashboard.aging.0-30', value: Number(arrears['0-30']), fill: 'var(--brand)' },
    { key: 'dashboard.aging.31-60', value: Number(arrears['31-60']), fill: '#C8873F' },
    { key: 'dashboard.aging.61-90', value: Number(arrears['61-90']), fill: 'color-mix(in srgb, #C8873F 50%, var(--danger))' },
    { key: 'dashboard.aging.90plus', value: Number(arrears['90+']), fill: 'var(--danger)' },
  ] as const;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-[11px]">
      {data.map((d) => (
        <div key={d.key} className="grid grid-cols-[84px_1fr_auto] items-center gap-3 text-[13px]">
          <span className="text-muted">{t(d.key)}</span>
          <span className="h-[7px] overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--ink) 7%, transparent)' }}>
            <i className="block h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: d.fill }} />
          </span>
          <b className="dash-fig text-[13px] font-bold">{d.value > 0 ? money(d.value) : '—'}</b>
        </div>
      ))}
    </div>
  );
}
