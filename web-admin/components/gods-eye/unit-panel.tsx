'use client';

/**
 * Click-to-drill panel. God's Eye View's click-to-track shows an object's trail
 * and metadata the moment you lock onto it; this is the same move over a unit —
 * select a tile and every fact behind its colour is on screen, with no further
 * fetch, because `/reporting/portfolio-state` already carried it.
 *
 * It states only what the payload holds. It does not name the tenant: the
 * endpoint returns `tenantId` and nothing more, and putting a person's name on
 * a wall-sized portfolio screen is a POPIA question, not a layout one. Drilling
 * to a named individual belongs on the existing authorised screens, which carry
 * the audit trail. See the open item in the design note.
 */

import React from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PortfolioUnit, STATE_STYLE, flagLabel, stateLabel } from './state';
import { useLocale } from '@/components/locale-provider';

/** A server status code in the reader's language; the code itself when there is no label for it. */
const tOr = (t: (k: any, v?: any) => string, key: string, fallback: string) => {
  const r = t(key);
  return r === key ? fallback : r;
};

/** Whole days from `from` to `to` ('YYYY-MM-DD'); mirrors the server helper. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-xs text-[var(--muted)]">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--line)] pt-3">
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h4>
      <dl>{children}</dl>
    </section>
  );
}

export default function UnitPanel({
  unit,
  asOf,
  money,
  onClose,
}: {
  unit: PortfolioUnit;
  /** The date the state was judged against, so "days left" is not clock-dependent. */
  asOf: string;
  money: (n: number) => string;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const s = STATE_STYLE[unit.state];
  const daysToEnd = unit.leaseEndDate ? daysBetween(asOf, unit.leaseEndDate) : null;
  const sinceInspection = unit.lastInspectionOn
    ? daysBetween(unit.lastInspectionOn, asOf)
    : null;

  return (
    <aside
      aria-label={`${unit.propertyName} ${unit.label}`}
      className="flex w-full flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 lg:w-[320px] lg:shrink-0"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">{unit.propertyName}</p>
          <h3 className="font-heading text-lg font-bold leading-tight">{unit.label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('godsEye.panel.close')}
          className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
        >
          <X size={16} />
        </button>
      </header>

      {/* The painted state, named in words — the tile's colour is never the only
          place this appears. */}
      <p
        className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
        style={{ background: s.bg, color: s.fg }}
      >
        {s.code && <span aria-hidden>{s.code}</span>}
        {stateLabel(t, unit.state)}
      </p>

      {unit.flags.length > 1 && (
        <ul className="flex flex-wrap gap-1.5">
          {unit.flags.map((f) => (
            <li
              key={f}
              className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
            >
              {flagLabel(t, f)}
            </li>
          ))}
        </ul>
      )}

      <Section title={t('godsEye.panel.occupancy')}>
        <Row label={t('godsEye.panel.unitStatus')} value={tOr(t, `properties.status.${unit.unitStatus}`, unit.unitStatus)} />
        <Row label={t('godsEye.panel.let')} value={unit.occupied ? t('godsEye.panel.yes') : t('godsEye.panel.no')} />
        {unit.leaseStatus && <Row label={t('godsEye.panel.lease')} value={tOr(t, `leases.status.${unit.leaseStatus}`, unit.leaseStatus)} />}
        {unit.leaseEndDate && (
          <Row
            label={t('godsEye.panel.leaseEnds')}
            value={
              <span className={cn(daysToEnd !== null && daysToEnd < 0 && 'text-[var(--danger)]')}>
                {unit.leaseEndDate}
                {daysToEnd !== null && (
                  <span className="ml-1 font-normal text-[var(--muted)]">
                    ({daysToEnd < 0 ? t('godsEye.panel.daysAgo', { days: -daysToEnd }) : t('godsEye.panel.inDays', { days: daysToEnd })})
                  </span>
                )}
              </span>
            }
          />
        )}
        {unit.rentAmount > 0 && <Row label={t('godsEye.panel.rent')} value={money(unit.rentAmount)} />}
      </Section>

      <Section title={t('godsEye.family.money')}>
        <Row
          label={t('godsEye.th.outstanding')}
          value={unit.outstanding > 0 ? money(unit.outstanding) : t('godsEye.panel.nothingOwing')}
        />
        {unit.maxDaysOverdue > 0 && (
          <>
            <Row label={t('godsEye.panel.oldestUnpaid')} value={t('godsEye.panel.daysPastDue', { days: unit.maxDaysOverdue })} />
            {unit.arrearsBucket && <Row label={t('godsEye.panel.agingBucket')} value={t('godsEye.panel.bucketDays', { bucket: unit.arrearsBucket })} />}
          </>
        )}
      </Section>

      <Section title={t('godsEye.panel.work')}>
        <Row label={t('godsEye.th.openJobs')} value={unit.openTickets || t('godsEye.panel.none')} />
        {unit.urgentTickets > 0 && <Row label={t('godsEye.panel.ofThoseUrgent')} value={unit.urgentTickets} />}
        <Row
          label={t('godsEye.panel.lastInspection')}
          value={
            unit.lastInspectionOn ? (
              <span>
                {unit.lastInspectionOn}
                <span className="ml-1 font-normal text-[var(--muted)]">
                  ({t('godsEye.panel.daysAgo', { days: sinceInspection ?? 0 })})
                </span>
              </span>
            ) : (
              t('godsEye.panel.never')
            )
          }
        />
      </Section>

      {/* Section links, not record links. No back-office page reads an id from
          the query string yet, so a deep link would 404 the operator's trust
          rather than save them a click. Making these land on the record is the
          follow-up item. */}
      <nav className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3 text-xs">
        <Link href="/leases" className="rounded-full border border-[var(--line)] px-3 py-1 hover:border-[var(--ink)]">
          {t('nav.leases')}
        </Link>
        <Link href="/payments" className="rounded-full border border-[var(--line)] px-3 py-1 hover:border-[var(--ink)]">
          {t('nav.payments')}
        </Link>
        <Link href="/inspections" className="rounded-full border border-[var(--line)] px-3 py-1 hover:border-[var(--ink)]">
          {t('nav.inspections')}
        </Link>
      </nav>
    </aside>
  );
}
