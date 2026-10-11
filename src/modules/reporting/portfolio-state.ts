/**
 * Pure state derivation for the god's-eye portfolio view (no DB).
 *
 * `ReportingService.portfolioState()` returns one row per unit; this file turns
 * each row into the single colour the view paints that unit, plus every flag
 * worth a badge. Kept pure so the rules are testable without a database, and so
 * the API and the front end cannot drift on what "in arrears" means.
 *
 * SCOPE: the query runs through the request's RLS-scoped manager, so a view is
 * always ONE agency's portfolio. There is deliberately no cross-vendor rollup —
 * that would mean querying as the owner role, which the platform forbids.
 *
 * THRESHOLDS: the lease-expiry window and the inspection interval below are
 * thresholds belonging to THIS VIEW, not product policy. They are parameters
 * with documented defaults; nothing else in the platform reads them.
 */

import { AgingBucket, agingBucket } from './reporting-calc';

/** Lease end inside this many days counts as expiring. View threshold only. */
export const LEASE_EXPIRY_WINDOW_DAYS = 90;

/** No completed inspection in this many days counts as overdue. View threshold only. */
export const INSPECTION_INTERVAL_DAYS = 365;

/** Invoice statuses that represent money still owed. Matches `arrearsAging()`. */
export const UNPAID_INVOICE_STATUSES = ['issued', 'partly_paid', 'overdue'] as const;

/** Lease statuses that mean a unit is let. */
export const LIVE_LEASE_STATUSES = ['active', 'ending'] as const;

/** Ticket statuses that mean work is still outstanding. */
export const OPEN_TICKET_STATUSES = ['open', 'assigned'] as const;

/**
 * The one state a unit is painted with. Ordered worst-first in SEVERITY below;
 * a unit can satisfy several conditions at once, and the worst wins the colour
 * while the rest survive as flags.
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

/** Everything true of a unit at once, for badges and filtering. */
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

/**
 * Severity score per state, 0-100. Used for the "worst first" sort and for
 * choosing the painted colour when a unit has several problems.
 *
 * The ordering is a judgement call and is written down here rather than being
 * implied by if/else order: 90+ arrears and a holdover lease outrank a vacancy,
 * because both are money already lost rather than money not yet earned; an
 * overdue inspection outranks nothing much, because it is a paperwork gap.
 */
export const SEVERITY: Record<UnitState, number> = {
  arrears_90_plus: 100,
  arrears_61_90: 88,
  lease_expired: 80,
  vacant: 72,
  arrears_31_60: 64,
  maintenance_urgent: 56,
  lease_expiring: 44,
  arrears_0_30: 36,
  maintenance_open: 28,
  inspection_overdue: 18,
  offline: 10,
  ok: 0,
};

/** One unit as the SQL returns it, after numeric coercion. */
export interface PortfolioUnitRow {
  unitId: string;
  propertyId: string;
  propertyName: string;
  label: string;
  /** `UnitStatus` from the units table. */
  unitStatus: string;
  leaseId: string | null;
  leaseStatus: string | null;
  /** 'YYYY-MM-DD' or null. */
  leaseEndDate: string | null;
  tenantId: string | null;
  rentAmount: number;
  /** Value of unpaid invoices. Overstates `partly_paid` — see portfolioState(). */
  outstanding: number;
  /** Days past due on the oldest unpaid invoice; 0 when nothing is late. */
  maxDaysOverdue: number;
  openTickets: number;
  urgentTickets: number;
  /** 'YYYY-MM-DD' of the last completed inspection, or null if never. */
  lastInspectionOn: string | null;
}

/** A unit with its derived state, ready to paint. */
export interface PortfolioUnit extends PortfolioUnitRow {
  state: UnitState;
  severity: number;
  flags: UnitFlag[];
  /** Aging bucket of the oldest unpaid invoice, or null when nothing is late. */
  arrearsBucket: AgingBucket | null;
  occupied: boolean;
}

export interface DeriveOptions {
  leaseExpiryWindowDays?: number;
  inspectionIntervalDays?: number;
}

/** Whole days from `from` to `to`, both 'YYYY-MM-DD'. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Derive the painted state and the full flag set for one unit.
 *
 * `today` is passed in rather than read from the clock so the rules are
 * testable and so a recorded scene can be replayed against a fixed date.
 */
export function deriveUnitState(
  row: PortfolioUnitRow,
  today: string,
  opts: DeriveOptions = {},
): PortfolioUnit {
  const expiryWindow = opts.leaseExpiryWindowDays ?? LEASE_EXPIRY_WINDOW_DAYS;
  const inspectionInterval = opts.inspectionIntervalDays ?? INSPECTION_INTERVAL_DAYS;

  const hasLiveLease =
    row.leaseStatus !== null &&
    (LIVE_LEASE_STATUSES as readonly string[]).includes(row.leaseStatus);
  const occupied = hasLiveLease && row.unitStatus !== 'vacant';

  const flags: UnitFlag[] = [];
  const candidates: UnitState[] = [];

  // --- Arrears. Only meaningful against a lease; days overdue drives the bucket.
  const arrearsBucket =
    row.maxDaysOverdue > 0 && row.outstanding > 0 ? agingBucket(row.maxDaysOverdue) : null;
  if (arrearsBucket) {
    flags.push('arrears');
    candidates.push(
      arrearsBucket === '90+'
        ? 'arrears_90_plus'
        : arrearsBucket === '61-90'
          ? 'arrears_61_90'
          : arrearsBucket === '31-60'
            ? 'arrears_31_60'
            : 'arrears_0_30',
    );
  }

  // --- Occupancy. A vacant unit cannot also be expiring, so these are exclusive.
  if (!occupied) {
    if (row.unitStatus === 'offline') {
      flags.push('offline');
      candidates.push('offline');
    } else if (row.unitStatus === 'maintenance') {
      // Deliberately out of service for work, not an empty unit nobody noticed.
      flags.push('under_maintenance');
      candidates.push('maintenance_open');
    } else {
      flags.push('vacant');
      candidates.push('vacant');
    }
  } else if (row.leaseEndDate) {
    const daysToEnd = daysBetween(today, row.leaseEndDate);
    if (daysToEnd < 0) {
      // A live lease past its end date is a holdover: the agency is housing a
      // tenant on an agreement that has run out. Worth shouting about.
      flags.push('lease_expired');
      candidates.push('lease_expired');
    } else if (daysToEnd <= expiryWindow) {
      flags.push('lease_expiring');
      candidates.push('lease_expiring');
    }
  }

  // --- Maintenance.
  if (row.urgentTickets > 0) {
    flags.push('maintenance_urgent', 'maintenance_open');
    candidates.push('maintenance_urgent');
  } else if (row.openTickets > 0) {
    flags.push('maintenance_open');
    candidates.push('maintenance_open');
  }

  // --- Inspections. Never inspected is flagged separately from gone stale:
  // one is a gap in the record, the other is a cadence that slipped.
  if (!row.lastInspectionOn) {
    flags.push('inspection_never', 'inspection_overdue');
    candidates.push('inspection_overdue');
  } else if (daysBetween(row.lastInspectionOn, today) > inspectionInterval) {
    flags.push('inspection_overdue');
    candidates.push('inspection_overdue');
  }

  const state = candidates.reduce<UnitState>(
    (worst, c) => (SEVERITY[c] > SEVERITY[worst] ? c : worst),
    'ok',
  );

  return {
    ...row,
    state,
    severity: SEVERITY[state],
    flags: [...new Set(flags)],
    arrearsBucket,
    occupied,
  };
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
  /** Count per state, every state present as a key so the legend never shifts. */
  byState: Record<UnitState, number>;
}

/** Roll a derived unit list up into the figures the view's header shows. */
export function summarisePortfolio(units: PortfolioUnit[]): PortfolioSummary {
  const byState = Object.fromEntries(
    (Object.keys(SEVERITY) as UnitState[]).map((s) => [s, 0]),
  ) as Record<UnitState, number>;

  let occupied = 0;
  let unitsInArrears = 0;
  let arrearsOutstanding = 0;
  let openTickets = 0;
  const properties = new Set<string>();

  for (const u of units) {
    byState[u.state] += 1;
    properties.add(u.propertyId);
    if (u.occupied) occupied += 1;
    if (u.arrearsBucket) {
      unitsInArrears += 1;
      arrearsOutstanding += u.outstanding;
    }
    openTickets += u.openTickets;
  }

  const total = units.length;
  return {
    units: total,
    properties: properties.size,
    occupied,
    vacant: total - occupied,
    occupancyRate: total === 0 ? 0 : Math.round((occupied / total) * 10000) / 100,
    unitsInArrears,
    arrearsOutstanding: Math.round(arrearsOutstanding * 100) / 100,
    openTickets,
    byState,
  };
}
