'use client';

/**
 * The halo grid: one tile per unit, coloured by its worst state, grouped by
 * property. Ported from God's Eye View's detection overlay — the point of that
 * feature is that you see every object's state at once without reading a table.
 *
 * SCOPE: ONE PROPERTY. The page hands this the units of the property the
 * operator opened, not the whole portfolio. Five hundred tiles cannot be read —
 * ninety-six can be counted by eye. "Which property" is answered one level up,
 * by `rollup.tsx`.
 *
 * Accessibility is not an afterthought here: 500 coloured squares are useless
 * to a screen reader, so each tile is a real <button> with a sentence-long
 * aria-label, carries a text code as well as a colour, and the whole grid has a
 * table view behind a toggle. Colour is never the only carrier of state.
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/cn';
import {
  FAMILY_LABEL,
  LEGEND_ORDER,
  PortfolioUnit,
  STATE_STYLE,
  StateFamily,
  UnitState,
  describeUnit,
  groupByProperty,
} from './state';
import type { ViewMode } from './view-state';

export interface GridProps {
  units: PortfolioUnit[];
  byState: Record<UnitState, number>;
  selectedId: string | null;
  onSelect: (unit: PortfolioUnit) => void;
  /** Active state filter; null shows everything. */
  filter: UnitState | null;
  onFilter: (state: UnitState | null) => void;
  /**
   * Grid or table. Held by the page rather than here, because it is part of the
   * shareable view state — a link that says "table" has to open as a table.
   */
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
}

/** A legend swatch that doubles as the state filter. */
function LegendItem({
  state,
  count,
  active,
  onClick,
}: {
  state: UnitState;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const s = STATE_STYLE[state];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition',
        active ? 'border-[var(--ink)] font-semibold' : 'border-[var(--line)] hover:border-[var(--muted)]',
        count === 0 && 'opacity-45',
      )}
    >
      <span
        aria-hidden
        className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] text-[8px] font-bold leading-none"
        style={{ background: s.bg, color: s.fg }}
      >
        {s.code}
      </span>
      <span>{s.label}</span>
      <span className="tabular-nums text-[var(--muted)]">{count}</span>
    </button>
  );
}

function Legend({
  byState,
  filter,
  onFilter,
}: Pick<GridProps, 'byState' | 'filter' | 'onFilter'>) {
  const families: StateFamily[] = ['money', 'occupancy', 'operations', 'clear'];
  return (
    <div className="flex flex-col gap-3">
      {families.map((fam) => {
        const states = LEGEND_ORDER.filter((s) => STATE_STYLE[s].family === fam);
        return (
          <div key={fam} className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {FAMILY_LABEL[fam]}
            </span>
            {states.map((s) => (
              <LegendItem
                key={s}
                state={s}
                count={byState[s] ?? 0}
                active={filter === s}
                onClick={() => onFilter(filter === s ? null : s)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * One unit tile. 2px gap between fills so adjacent states never bleed together.
 *
 * NO LABEL ON THE TILE. `unit.label` is the full "Masquerade Heights 1106", and
 * a 44px box cannot hold it — `truncate` needs a width to bite against, and
 * inside a centred grid track there is none, so every tile painted its name
 * across its neighbours and the whole grid became unreadable. Identity is in
 * the tooltip, the aria-label and the detail panel, which is where someone
 * looks when they want to know WHICH unit. The tile answers WHAT KIND, and the
 * code is now centred at a size that can actually be read.
 */
function Tile({
  unit,
  selected,
  onSelect,
}: {
  unit: PortfolioUnit;
  selected: boolean;
  onSelect: () => void;
}) {
  const s = STATE_STYLE[unit.state];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={describeUnit(unit)}
      aria-pressed={selected}
      title={describeUnit(unit)}
      className={cn(
        'grid h-11 w-11 place-items-center rounded-lg text-[11px] font-bold leading-none transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-1',
        selected && 'ring-2 ring-[var(--ink)] ring-offset-1',
      )}
      style={{ background: s.bg, color: s.fg }}
    >
      <span aria-hidden>{s.code}</span>
    </button>
  );
}

/** The table view. Always available, not a fallback — some questions are rows. */
function TableView({
  units,
  onSelect,
}: {
  units: PortfolioUnit[];
  onSelect: (u: PortfolioUnit) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
          <tr>
            <th scope="col" className="py-2 pr-4">Unit</th>
            <th scope="col" className="py-2 pr-4">Property</th>
            <th scope="col" className="py-2 pr-4">State</th>
            <th scope="col" className="py-2 pr-4 text-right">Days late</th>
            <th scope="col" className="py-2 pr-4 text-right">Outstanding</th>
            <th scope="col" className="py-2 pr-4 text-right">Open jobs</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr
              key={u.unitId}
              className="cursor-pointer border-t border-[var(--line)] hover:bg-[var(--bg)]"
              onClick={() => onSelect(u)}
            >
              <td className="py-2 pr-4 font-medium">{u.label}</td>
              <td className="py-2 pr-4 text-[var(--muted)]">{u.propertyName}</td>
              <td className="py-2 pr-4">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: STATE_STYLE[u.state].bg }}
                  />
                  {STATE_STYLE[u.state].label}
                </span>
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {u.maxDaysOverdue > 0 ? u.maxDaysOverdue : '—'}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {u.outstanding > 0 ? u.outstanding.toLocaleString() : '—'}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {u.openTickets > 0 ? u.openTickets : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HaloGrid({
  units,
  byState,
  selectedId,
  onSelect,
  filter,
  onFilter,
  mode,
  onMode,
}: GridProps) {

  const shown = useMemo(
    () => (filter ? units.filter((u) => u.state === filter) : units),
    [units, filter],
  );
  // Worst first in the table; the grid keeps property/label order so a unit
  // stays where the operator last saw it.
  const tableRows = useMemo(
    () => [...shown].sort((a, b) => b.severity - a.severity || a.label.localeCompare(b.label)),
    [shown],
  );
  const groups = useMemo(() => groupByProperty(shown), [shown]);

  return (
    <div className="flex flex-col gap-5">
      <Legend byState={byState} filter={filter} onFilter={onFilter} />

      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
        <p className="text-xs text-[var(--muted)]" role="status">
          {filter
            ? `${shown.length} of ${units.length} units — ${STATE_STYLE[filter].label}`
            : `${units.length} units`}
        </p>
        <div className="flex gap-1 rounded-full border border-[var(--line)] p-0.5">
          {(['grid', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onMode(v)}
              aria-pressed={mode === v}
              className={cn(
                'rounded-full px-3 py-1 text-xs capitalize transition',
                mode === v ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">
          No units in this state.
        </p>
      ) : mode === 'table' ? (
        <TableView units={tableRows} onSelect={onSelect} />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.propertyId} aria-label={g.propertyName}>
              <h3 className="mb-2 text-sm font-semibold">
                {g.propertyName}{' '}
                <span className="font-normal text-[var(--muted)]">({g.units.length})</span>
              </h3>
              <div className="flex flex-wrap gap-0.5">
                {g.units.map((u) => (
                  <Tile
                    key={u.unitId}
                    unit={u}
                    selected={selectedId === u.unitId}
                    onSelect={() => onSelect(u)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
