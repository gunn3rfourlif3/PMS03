/**
 * The god's-eye view's state vocabulary, colours and codes.
 *
 * ⚠️ STRUCTURAL MIRROR of `src/modules/reporting/portfolio-state.ts`. web-admin
 * has no path to `../src` (see tsconfig `paths`), and the same precedent was set
 * by `components/assistant/signals.ts`. The two files move together: if a state
 * is added, renamed or re-ranked server-side, change it here in the same commit.
 *
 * COLOUR. Three families, so hue says what KIND of problem it is and lightness
 * says how bad, which is what lets a 500-tile grid be scanned at all:
 *   money (arrears)      amber → deep red
 *   occupancy (lease)    pale → strong blue
 *   operations (work)    pale → strong violet
 * The three family anchors (#993C1D, #378ADD, #534AB7) pass the categorical
 * checks — lightness band, chroma floor, deutan/tritan separation, normal-vision
 * separation and 3:1 against the surface. Do not substitute a hue without
 * re-running that check: the first attempt put amber next to coral, which reads
 * as one colour to a deutan viewer (ΔE 1.0).
 *
 * `ok` is deliberately the palest thing on the page. Most units are fine and
 * should recede; the eye is meant to find the problems, not the calm.
 *
 * NEVER COLOUR ALONE. Every tile also carries `code` and an aria-label naming
 * the state, so the grid survives colour blindness, greyscale print and
 * forced-colors mode.
 */

export type UnitState =
  | 'arrears_90_plus'
  | 'arrears_61_90'
  | 'lease_expired'
  | 'vacant'
  | 'arrears_31_60'
  | 'maintenance_urgent'
  | 'lease_expiring'
  | 'arrears_0_30'
  | 'maintenance_open'
  | 'inspection_overdue'
  | 'offline'
  | 'ok';

export type UnitFlag =
  | 'arrears'
  | 'vacant'
  | 'lease_expiring'
  | 'lease_expired'
  | 'maintenance_open'
  | 'maintenance_urgent'
  | 'inspection_overdue'
  | 'inspection_never'
  | 'offline'
  | 'under_maintenance';

export type StateFamily = 'money' | 'occupancy' | 'operations' | 'clear';

export interface StateStyle {
  /** Tile fill. */
  bg: string;
  /** Text on that fill — checked for legibility at tile size. */
  fg: string;
  /** Two characters at most: the secondary encoding on the tile itself. */
  code: string;
  /**
   * English label. Not an i18n key yet — label, colour and code are one triple
   * that must not drift, so they live together here. See the open item.
   */
  label: string;
  family: StateFamily;
}

export const STATE_STYLE: Record<UnitState, StateStyle> = {
  // money — amber to deep red
  arrears_0_30:       { bg: '#FAC775', fg: '#412402', code: '30',  label: 'Arrears 0–30 days',    family: 'money' },
  arrears_31_60:      { bg: '#D85A30', fg: '#FFFFFF', code: '60',  label: 'Arrears 31–60 days',   family: 'money' },
  arrears_61_90:      { bg: '#993C1D', fg: '#FFFFFF', code: '90',  label: 'Arrears 61–90 days',   family: 'money' },
  arrears_90_plus:    { bg: '#5E2411', fg: '#FFFFFF', code: '90+', label: 'Arrears over 90 days', family: 'money' },
  // occupancy — pale to strong blue
  lease_expiring:     { bg: '#B5D4F4', fg: '#042C53', code: 'Ex',  label: 'Lease expiring',       family: 'occupancy' },
  vacant:             { bg: '#378ADD', fg: '#FFFFFF', code: 'V',   label: 'Vacant',               family: 'occupancy' },
  lease_expired:      { bg: '#185FA5', fg: '#FFFFFF', code: 'XX',  label: 'Lease expired',        family: 'occupancy' },
  // operations — pale to strong violet, with offline deliberately outside it
  inspection_overdue: { bg: '#CECBF6', fg: '#26215C', code: 'In',  label: 'Inspection overdue',   family: 'operations' },
  maintenance_open:   { bg: '#AFA9EC', fg: '#26215C', code: 'M',   label: 'Maintenance open',     family: 'operations' },
  maintenance_urgent: { bg: '#534AB7', fg: '#FFFFFF', code: 'M!',  label: 'Maintenance urgent',   family: 'operations' },
  offline:            { bg: '#9CA3AF', fg: '#16181D', code: '—',   label: 'Offline',              family: 'operations' },
  // clear
  ok:                 { bg: '#E1F5EE', fg: '#04342C', code: '',    label: 'Nothing outstanding',  family: 'clear' },
};

/**
 * Legend order: worst first, grouped by family. Mirrors the server's SEVERITY
 * ranking, and the legend is built from this array so a state can never be
 * painted on the grid without appearing in the legend.
 */
export const LEGEND_ORDER: readonly UnitState[] = [
  'arrears_90_plus',
  'arrears_61_90',
  'lease_expired',
  'vacant',
  'arrears_31_60',
  'maintenance_urgent',
  'lease_expiring',
  'arrears_0_30',
  'maintenance_open',
  'inspection_overdue',
  'offline',
  'ok',
];

export const FAMILY_LABEL: Record<StateFamily, string> = {
  money: 'Money',
  occupancy: 'Occupancy',
  operations: 'Operations',
  clear: 'Clear',
};

export const FLAG_LABEL: Record<UnitFlag, string> = {
  arrears: 'In arrears',
  vacant: 'Vacant',
  lease_expiring: 'Lease expiring',
  lease_expired: 'Lease expired',
  maintenance_open: 'Maintenance open',
  maintenance_urgent: 'Urgent maintenance',
  inspection_overdue: 'Inspection overdue',
  inspection_never: 'Never inspected',
  offline: 'Offline',
  under_maintenance: 'Out of service for work',
};

/** One unit as `/reporting/portfolio-state` returns it. */
export interface PortfolioUnit {
  unitId: string;
  propertyId: string;
  propertyName: string;
  label: string;
  unitStatus: string;
  leaseId: string | null;
  leaseStatus: string | null;
  leaseEndDate: string | null;
  tenantId: string | null;
  rentAmount: number;
  outstanding: number;
  maxDaysOverdue: number;
  openTickets: number;
  urgentTickets: number;
  lastInspectionOn: string | null;
  state: UnitState;
  severity: number;
  flags: UnitFlag[];
  arrearsBucket: '0-30' | '31-60' | '61-90' | '90+' | null;
  occupied: boolean;
}

export interface PortfolioSummary {
  units: number;
  properties: number;
  occupied: number;
  vacant: number;
  occupancyRate: number;
  unitsInArrears: number;
  arrearsOutstanding: number;
  openTickets: number;
  byState: Record<UnitState, number>;
}

export interface PortfolioState {
  asOf: string;
  summary: PortfolioSummary;
  units: PortfolioUnit[];
}

/** The full sentence a tile announces to a screen reader. */
export function describeUnit(u: PortfolioUnit): string {
  const parts = [`${u.propertyName} ${u.label}`, STATE_STYLE[u.state].label];
  const extra = u.flags.filter((f) => FLAG_LABEL[f] !== STATE_STYLE[u.state].label);
  if (extra.length) parts.push(extra.map((f) => FLAG_LABEL[f]).join(', '));
  return parts.join(' — ');
}

/** Group units by property, preserving the server's name/label ordering. */
export function groupByProperty(
  units: PortfolioUnit[],
): Array<{ propertyId: string; propertyName: string; units: PortfolioUnit[] }> {
  const out: Array<{ propertyId: string; propertyName: string; units: PortfolioUnit[] }> = [];
  const index = new Map<string, number>();
  for (const u of units) {
    let at = index.get(u.propertyId);
    if (at === undefined) {
      at = out.length;
      index.set(u.propertyId, at);
      out.push({ propertyId: u.propertyId, propertyName: u.propertyName, units: [] });
    }
    out[at].units.push(u);
  }
  return out;
}
