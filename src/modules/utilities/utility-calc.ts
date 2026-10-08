/**
 * Pure consumption maths — no framework or DB deps, so the part that decides
 * what a tenant used is unit-testable in isolation. Same arrangement as
 * `double-entry.ts` and `work-order-transitions.ts`.
 *
 * Consumption is DERIVED here and never accepted from a client. A back office
 * sends a dial value and a date; everything else is computed.
 */

export interface ConsumptionInput {
  /** False for sewerage and refuse: there is nothing to read. */
  metered: boolean;
  /** The dial value as found. Null/undefined for an unmetered point. */
  reading?: number | null;
  /** The previous reading on this meter, or null if this is the first. */
  previousReading?: number | null;
  /** CT ratio. 1 for every domestic meter. */
  multiplier?: number | null;
  /** The capturer says the meter wrapped. Never inferred. */
  rollover?: boolean;
  /** Digits before the dial wraps. Required to compute a rollover. */
  dialDigits?: number | null;
}

export type ConsumptionResult =
  | { ok: true; consumption: number | null; baseline: boolean }
  | { ok: false; reason: string };

export type ConsumptionError = { ok: false; reason: string };

/**
 * Narrowing helper. `if (!result.ok)` narrows this union fine under the
 * project's `strictNullChecks: true`, but not with it off — which is how a
 * stripped-down tsconfig or a consumer outside this build would see it. The
 * guard costs nothing and holds either way.
 */
export function isConsumptionError(r: ConsumptionResult): r is ConsumptionError {
  return r.ok === false;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * What was used since the previous reading.
 *
 * Returns `consumption: null` in the two cases where the honest answer is "not
 * known yet": an unmetered point, and the first reading on a meter, which
 * establishes a baseline rather than measuring a period. A baseline reported as
 * zero would be indistinguishable from a tenant who used nothing.
 */
export function computeConsumption(input: ConsumptionInput): ConsumptionResult {
  if (!input.metered) {
    if (input.reading !== null && input.reading !== undefined) {
      return { ok: false, reason: 'An unmetered service has no dial value to read' };
    }
    return { ok: true, consumption: null, baseline: false };
  }

  const reading = input.reading;
  if (reading === null || reading === undefined || !Number.isFinite(reading)) {
    return { ok: false, reason: 'A metered point needs a reading' };
  }
  if (reading < 0) return { ok: false, reason: 'A reading cannot be negative' };

  const multiplier = Number(input.multiplier ?? 1);
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return { ok: false, reason: 'Multiplier must be greater than zero' };
  }

  const previous = input.previousReading;
  if (previous === null || previous === undefined) {
    // First reading: a baseline, not a measurement.
    return { ok: true, consumption: null, baseline: true };
  }

  if (input.rollover) {
    // The meter wrapped past its last digit: it ran from `previous` up to the
    // dial's maximum, then from zero to `reading`.
    const digits = input.dialDigits;
    if (!digits || !Number.isFinite(digits) || digits <= 0) {
      return { ok: false, reason: 'A rollover needs the meter’s dial digits to compute the wrap' };
    }
    const ceiling = Math.pow(10, digits);
    if (previous >= ceiling) {
      return { ok: false, reason: 'The previous reading exceeds the dial’s capacity' };
    }
    return { ok: true, consumption: round2((ceiling - previous + reading) * multiplier), baseline: false };
  }

  if (reading < previous) {
    // Deliberately a rejection, not a guess. A lower reading is either a wrap or
    // a typo, and the two are indistinguishable from here — guessing wrong
    // either doubles a bill or hides a leak.
    return {
      ok: false,
      reason: `Reading ${reading} is below the previous reading ${previous}. If the meter rolled over, say so; otherwise correct the figure.`,
    };
  }

  return { ok: true, consumption: round2((reading - previous) * multiplier), baseline: false };
}

/** Cost from consumption, when a tariff is known and no cost was supplied. */
export function deriveCost(
  consumption: number | null,
  tariffRate?: number | null,
  suppliedCost?: number | null,
): number | null {
  if (suppliedCost !== null && suppliedCost !== undefined) return round2(Number(suppliedCost));
  if (consumption === null || tariffRate === null || tariffRate === undefined) return null;
  if (!Number.isFinite(Number(tariffRate))) return null;
  return round2(consumption * Number(tariffRate));
}
