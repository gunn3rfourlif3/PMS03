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
 * COLOUR. The skyline's palette, not a summary of it: each bar is that
 * property's windows laid end to end, every unit in its own state colour from
 * `state.ts` (amber arrears, blue occupancy, violet operations), grouped by
 * family and worst first within each. Switching between the two views keeps
 * every colour meaning the same thing. Family is still readable — the three
 * hue ranges do not overlap — and severity now shows inside it.
 *
 * Every bar is also a row of numbers to its right, so the segment widths are
 * never the only carrier — the same rule the grid follows with its codes.
 */

import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  familyLabel,
  stateLabel,
  LEGEND_ORDER,
  familySwatch,
  PortfolioUnit,
  STATE_STYLE,
  StateFamily,
  groupByProperty,
} from './state';

/** Worst family first, so the eye reads a row left to right as worst to best. */
const FAMILY_ORDER: readonly StateFamily[] = ['money', 'occupancy', 'operations', 'clear'];

type UnitState = keyof typeof STATE_STYLE;

/** Segment order: by family, then worst state first inside it (LEGEND_ORDER is severity-ranked). */
const SEGMENT_ORDER: readonly UnitState[] = FAMILY_ORDER.flatMap((fam) =>
  LEGEND_ORDER.filter((st) => STATE_STYLE[st].family === fam),
);

/**
 * A window's colour, as the skyline lights it: a problem in its state colour,
 * a clear unit as an unlit slab (the page's own line colour, so it sits right
 * on the light theme as well as the dark one).
 */
const fill = (st: UnitState) => (STATE_STYLE[st].family === 'clear' ? 'var(--line)' : STATE_STYLE[st].bg);


interface Row {
  propertyId: string;
  propertyName: string;
  total: number;
  byFamily: Record<StateFamily, number>;
  byState: Partial<Record<UnitState, number>>;
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
      const byState: Partial<Record<UnitState, number>> = {};
      let arrearsUnits = 0;
      let outstanding = 0;
      for (const u of g.units) {
        byFamily[STATE_STYLE[u.state].family] += 1;
        byState[u.state] = (byState[u.state] ?? 0) + 1;
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
        byState,
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
              className="h-3 w-5 shrink-0 rounded-[3px]"
              style={{ background: familySwatch(fam) }}
            />
            {fam === 'clear' ? t('godsEye.nothingOutstanding') : familyLabel(t, fam)}
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

              <span className="flex min-w-0 flex-[999_1_16rem] gap-px overflow-hidden rounded-md">
                {SEGMENT_ORDER.map((st) => {
                  const n = r.byState[st] ?? 0;
                  return n > 0 ? (
                    <span
                      key={st}
                      aria-hidden
                      title={`${stateLabel(t, st)}: ${n}`}
                      className="h-6 min-w-[3px]"
                      style={{
                        background: fill(st),
                        width: `${(n / r.total) * 100}%`,
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
                      }}
                    />
                  ) : null;
                })}
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
