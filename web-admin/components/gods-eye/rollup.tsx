'use client';

/**
 * The portfolio roll-up: one row per property, and the default view.
 *
 * WHY THIS EXISTS. The unit grid paints one tile per unit, which stops working
 * somewhere short of five hundred: at tile size the eye cannot count, hue stops
 * being legible, and a ragged row per property makes the whole thing read as
 * noise. Ten rows can be read. So the page asks two questions in two views —
 * "which property" here, "which unit" in the grid — instead of one view trying
 * to answer both at once.
 *
 * COLOUR. Here hue carries the FAMILY, the same three anchors `state.ts`
 * validated, because four segments on ten rows leaves room to read hue. Inside
 * a property, where tiles are 44px, the same palette has to carry severity
 * instead. That is deliberate: the channel follows the density.
 *
 * Every bar is also a row of numbers to its right, so the segment widths are
 * never the only carrier — the same rule the grid follows with its codes.
 */

import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  FAMILY_LABEL,
  PortfolioUnit,
  STATE_STYLE,
  StateFamily,
  groupByProperty,
} from './state';

/** The fill for each family's segment — the anchor hue from `state.ts`. */
const FAMILY_FILL: Record<StateFamily, string> = {
  money: '#993C1D',
  occupancy: '#185FA5',
  operations: '#534AB7',
  clear: 'var(--line)',
};

/** Worst family first, so the eye reads a row left to right as worst to best. */
const FAMILY_ORDER: readonly StateFamily[] = ['money', 'occupancy', 'operations', 'clear'];

interface Row {
  propertyId: string;
  propertyName: string;
  total: number;
  byFamily: Record<StateFamily, number>;
  arrearsUnits: number;
  outstanding: number;
}

export interface RollupProps {
  units: PortfolioUnit[];
  onOpen: (propertyId: string) => void;
  money: (n: number) => string;
  t: (key: any, vars?: any) => string;
}

export default function Rollup({ units, onOpen, money, t }: RollupProps) {
  const rows = useMemo<Row[]>(() => {
    const out = groupByProperty(units).map((g) => {
      const byFamily: Record<StateFamily, number> = {
        money: 0,
        occupancy: 0,
        operations: 0,
        clear: 0,
      };
      let arrearsUnits = 0;
      let outstanding = 0;
      for (const u of g.units) {
        byFamily[STATE_STYLE[u.state].family] += 1;
        if (u.outstanding > 0) {
          arrearsUnits += 1;
          outstanding += u.outstanding;
        }
      }
      return {
        propertyId: g.propertyId,
        propertyName: g.propertyName,
        total: g.units.length,
        byFamily,
        arrearsUnits,
        outstanding,
      };
    });
    // Most money at risk first: the roll-up is a triage list, not an index.
    return out.sort((a, b) => b.outstanding - a.outstanding || b.total - a.total);
  }, [units]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{t('godsEye.byProperty')}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('godsEye.byPropertyHint')}</p>
      </div>

      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
        {FAMILY_ORDER.map((fam) => (
          <li key={fam} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-[3px]"
              style={{ background: FAMILY_FILL[fam] }}
            />
            {fam === 'clear' ? t('godsEye.nothingOutstanding') : FAMILY_LABEL[fam]}
          </li>
        ))}
      </ul>

      <ul className="flex flex-col">
        {rows.map((r) => (
          <li key={r.propertyId} className="border-t border-[var(--line)]">
            <button
              type="button"
              onClick={() => onOpen(r.propertyId)}
              className="flex w-full flex-wrap items-center gap-x-5 gap-y-3 rounded-lg px-1 py-3 text-left transition hover:bg-[var(--bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
            >
              <span className="w-full min-w-0 sm:w-52 sm:shrink-0">
                <span className="block truncate text-sm font-semibold">{r.propertyName}</span>
                <span className="block text-xs text-[var(--muted)]">
                  {r.total} {t('godsEye.unitsInProperty')}
                </span>
              </span>

              <span className="flex min-w-0 flex-[999_1_16rem] overflow-hidden rounded-md">
                {FAMILY_ORDER.map((fam) =>
                  r.byFamily[fam] > 0 ? (
                    <span
                      key={fam}
                      aria-hidden
                      className="h-6"
                      style={{
                        background: FAMILY_FILL[fam],
                        width: `${(r.byFamily[fam] / r.total) * 100}%`,
                      }}
                    />
                  ) : null,
                )}
              </span>

              <span className="flex-1 text-right sm:w-36 sm:flex-none">
                <span className="block text-sm font-semibold tabular-nums">
                  {r.outstanding > 0 ? money(r.outstanding) : '—'}
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  {r.arrearsUnits} {t('godsEye.inArrears')}
                </span>
              </span>

              <ChevronRight aria-hidden className="shrink-0 text-[var(--muted)]" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
