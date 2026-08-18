/**
 * Pure DebiCheck mandate logic — ceiling, state machine, collection day.
 * See docs/LOCARE_DEBIT_ORDER_DESIGN.md §4, §5 and §11.6–§11.9.
 *
 * Everything here is deliberately free of I/O: a mistake in the ceiling only
 * shows up as a rejected collection weeks later, against a tenant who did
 * nothing wrong, so it is the last place to rely on integration testing.
 */

export type MandateState =
  | 'drafted' | 'requested' | 'active' | 'amending' | 'suspended'
  | 'cancelled' | 'rejected' | 'expired';

/**
 * §4's state machine, as data. `amending` returns to `active` on
 * re-authentication; collections continue against the OLD ceiling throughout,
 * which is why `amending` is a collectable state.
 *
 * `suspended` is not in §4 as originally drafted. Stitch emits a
 * `PaymentConsentPaused` status (statusReason e.g. `MANDATE_SUSPENDED`) which is
 * neither terminal nor collectable — a real provider state with nowhere to go
 * in the original machine. Mapping it to `active` would submit collections
 * against a suspended mandate; mapping it to `cancelled` would throw away a
 * mandate that can resume. So it is modelled properly.
 */
const TRANSITIONS: Record<MandateState, MandateState[]> = {
  drafted: ['requested', 'cancelled'],
  requested: ['active', 'rejected', 'expired', 'cancelled'],
  active: ['amending', 'suspended', 'cancelled', 'expired'],
  amending: ['active', 'suspended', 'cancelled', 'expired'],
  suspended: ['active', 'cancelled', 'expired'],
  cancelled: [],
  rejected: [],
  expired: [],
};

export function canTransition(from: MandateState, to: MandateState): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** States a collection may be submitted against. */
export function isCollectable(state: MandateState): boolean {
  return state === 'active' || state === 'amending';
}

// ── Ceiling (§5, §5.1, §11.8) ──────────────────────────────────────────────

/** Buffer above the projected final rent. Absorbs rounding and a part-year. */
export const CEILING_BUFFER_PCT = 10;

/**
 * Fallback annual escalation when the lease does not state one.
 *
 * Typical SA residential escalation runs 6–10%. 8% sits mid-range: too low and
 * the ceiling breaches mid-term (the exact failure §5 exists to prevent), too
 * high and the tenant sees an alarming maximum when authenticating at their
 * bank and declines.
 */
export const DEFAULT_ESCALATION_PCT = 8;

export interface CeilingInput {
  /** Rent at the start of the lease, in rands. */
  rentAmount: number;
  /** Lease term in months. A 12-month lease escalates once at renewal, not during. */
  termMonths: number;
  /** Annual escalation from the lease. Omit to use DEFAULT_ESCALATION_PCT. */
  escalationPct?: number | null;
  bufferPct?: number;
}

export interface CeilingResult {
  /** The mandate's maximumCollectionAmount, in rands. */
  ceiling: number;
  /** Projected rent at the final escalation, before the buffer. */
  finalRent: number;
  escalationPct: number;
  /** True when the lease stated no rate and the default was assumed. */
  assumedEscalation: boolean;
  /** Full escalation anniversaries within the term. */
  escalations: number;
}

/**
 * Ceiling = rent at the final escalation of the term, plus a buffer.
 *
 * Not a flat percentage of opening rent: a three-year lease at 8% ends 26%
 * above where it started, so a flat 15% headroom breaches in year two.
 */
export function mandateCeiling(input: CeilingInput): CeilingResult {
  const rent = Math.max(0, Number(input.rentAmount) || 0);
  const term = Math.max(0, Math.floor(Number(input.termMonths) || 0));
  const assumedEscalation = input.escalationPct == null;
  const pct = Math.max(0, Number(input.escalationPct ?? DEFAULT_ESCALATION_PCT) || 0);
  const buffer = input.bufferPct ?? CEILING_BUFFER_PCT;

  // Escalation lands on each 12-month anniversary. A 24-month lease escalates
  // once *within* the term (at month 12); the month-24 escalation belongs to the
  // renewal, which gets its own mandate amendment.
  const escalations = Math.max(0, Math.ceil(term / 12) - 1);
  const finalRent = rent * (1 + pct / 100) ** escalations;
  const ceiling = finalRent * (1 + buffer / 100);

  return {
    ceiling: Math.ceil(ceiling), // round UP: rounding down re-creates the breach
    finalRent: Math.round(finalRent * 100) / 100,
    escalationPct: pct,
    assumedEscalation,
    escalations,
  };
}

/**
 * Would this amount be rejected by the bank against this mandate?
 * Used by the T-3 pre-collection check (§5.5) and before applying an escalation.
 */
export function breachesCeiling(amount: number, ceiling: number): boolean {
  return (Number(amount) || 0) > (Number(ceiling) || 0);
}

// ── Collection day (§11.7) ─────────────────────────────────────────────────

/**
 * DebiCheck takes a day-of-month 1–31. Anything outside that is a rejected
 * mandate, so clamp rather than pass through — and treat "31" on a short month
 * as the bank's problem to adjust, which is what `dayAdjustmentAllowed` is for.
 */
export function collectionDay(preferred?: number | null, leaseRentDueDay = 1): number {
  const raw = Number(preferred ?? leaseRentDueDay);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(31, Math.max(1, Math.floor(raw)));
}
