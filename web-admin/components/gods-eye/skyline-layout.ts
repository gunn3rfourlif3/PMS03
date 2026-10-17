/**
 * The skyline's geometry, as pure functions.
 *
 * This file knows nothing about how the scene is drawn. Both renderers — the
 * CSS one and the WebGL one that replaces it — consume the same `Skyline`, so
 * swapping the renderer cannot change what the picture asserts. That boundary
 * is the point: the numbers live here, where they can be tested without a
 * browser, a canvas or a GPU.
 *
 * WHAT EACH CHANNEL CARRIES, and nothing more:
 *   tower height  →  unit count
 *   lit windows   →  each unit's worst state
 *   pool of light →  outstanding, against the worst property in the portfolio
 *
 * POSITION CARRIES NOTHING. There are no coordinates on `Property` and no
 * geocoding anywhere in the product, so the ground plane is a diagram, not a
 * map. Towers are laid out in reading order of the roll-up's triage ranking —
 * most money at risk first — which puts the property that needs attention
 * nearest the camera and makes the arrangement honest: it is a ranking you can
 * state out loud, not a geography someone might believe.
 */

import { PortfolioUnit, groupByProperty } from './state';

export interface SkylineTower {
  propertyId: string;
  propertyName: string;
  /**
   * The property's units, in the order they are drawn as windows.
   *
   * SERVER ORDER, not severity order. Sorting the lit windows together would
   * read better — a block of trouble low in the building — but there is no
   * floor information on a unit, so stacking by severity would invent a claim
   * about WHERE in the building the problem is. Colour carries the state and
   * the pool carries the total; the window's position carries nothing.
   */
  windows: PortfolioUnit[];
  units: number;
  cols: number;
  floors: number;
  outstanding: number;
  arrearsUnits: number;
  /** 0–1: this property's outstanding against the worst property's. */
  risk: number;
  /** Slot on the ground plane, left to right then back to front. */
  col: number;
  row: number;
}

export interface Skyline {
  towers: SkylineTower[];
  /** Properties beyond `limit`, summarised rather than drawn. */
  hidden: number;
  /** Units in those hidden properties. */
  hiddenUnits: number;
  perRow: number;
  maxOutstanding: number;
  totalUnits: number;
}

/**
 * Past this many towers the scene stops being readable — the same wall the
 * unit grid hits at 500 tiles. The rest are counted, not drawn, and the
 * renderer says so rather than quietly dropping them.
 */
export const DEFAULT_TOWER_LIMIT = 16;

/** Facade shape for a property: a little taller than wide, and never zero. */
export function towerShape(units: number): { cols: number; floors: number } {
  const n = Math.max(1, Math.floor(units));
  const cols = Math.min(7, Math.max(1, Math.round(Math.sqrt(n / 2.2))));
  return { cols, floors: Math.max(1, Math.ceil(n / cols)) };
}

/** How many towers stand in one row of the ground plane. */
export function slotsPerRow(count: number): number {
  if (count <= 1) return 1;
  return Math.min(5, Math.max(1, Math.ceil(Math.sqrt(count))));
}

/**
 * Triage order, fully determined: most money at risk first, then most units in
 * arrears, then biggest, then by name and id. Every tie is broken, so the same
 * payload always produces the same skyline — a shared link and a screen
 * recording cannot disagree about which tower is which.
 */
function rank(a: SkylineTower, b: SkylineTower): number {
  return (
    b.outstanding - a.outstanding ||
    b.arrearsUnits - a.arrearsUnits ||
    b.units - a.units ||
    a.propertyName.localeCompare(b.propertyName) ||
    a.propertyId.localeCompare(b.propertyId)
  );
}

export function buildSkyline(
  units: PortfolioUnit[],
  opts?: { limit?: number },
): Skyline {
  const limit = Math.max(1, opts?.limit ?? DEFAULT_TOWER_LIMIT);

  const all: SkylineTower[] = groupByProperty(units).map((g) => {
    let outstanding = 0;
    let arrearsUnits = 0;
    for (const u of g.units) {
      if (u.outstanding > 0) {
        outstanding += u.outstanding;
        arrearsUnits += 1;
      }
    }
    const shape = towerShape(g.units.length);
    return {
      propertyId: g.propertyId,
      propertyName: g.propertyName,
      windows: g.units,
      units: g.units.length,
      cols: shape.cols,
      floors: shape.floors,
      outstanding,
      arrearsUnits,
      risk: 0,
      col: 0,
      row: 0,
    };
  });

  all.sort(rank);

  const shown = all.slice(0, limit);
  const dropped = all.slice(limit);
  const perRow = slotsPerRow(shown.length);

  // Normalised against the worst tower IN THE WHOLE PORTFOLIO, not the worst
  // one drawn, so hiding a tower never brightens the ones that remain.
  const maxOutstanding = all.reduce((m, t) => Math.max(m, t.outstanding), 0);

  const towers = shown.map((t, i) => ({
    ...t,
    risk: maxOutstanding > 0 ? t.outstanding / maxOutstanding : 0,
    col: i % perRow,
    row: Math.floor(i / perRow),
  }));

  return {
    towers,
    hidden: dropped.length,
    hiddenUnits: dropped.reduce((n, t) => n + t.units, 0),
    perRow,
    maxOutstanding,
    totalUnits: units.length,
  };
}

/** The sentence the scene announces to a screen reader. */
export function describeSkyline(s: Skyline): string {
  if (!s.towers.length) return 'No properties to show.';
  const worst = s.towers[0];
  const parts = [
    `${s.towers.length} ${s.towers.length === 1 ? 'property' : 'properties'}, ${s.totalUnits} units`,
    `most at risk: ${worst.propertyName}, ${worst.arrearsUnits} of ${worst.units} units in arrears`,
  ];
  if (s.hidden > 0) {
    parts.push(`${s.hidden} further properties (${s.hiddenUnits} units) not drawn`);
  }
  return `${parts.join('. ')}.`;
}
