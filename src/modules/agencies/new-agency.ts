import {
  MIN_BILLABLE_UNITS, PricedTier, TIER_PRICES, belowMinimum, customPrice,
  customUnitRate, tierForUnits,
} from '@modules/subscriptions/subscription-calc';

/**
 * Validation and pricing for creating a direct-sold agency (gap R-3).
 *
 * Pure — no framework, no DB — because this is where the below-floor rule is
 * enforced, and that rule is a commercial commitment rather than a UI nicety.
 * The controller does the writing; everything that decides is here, and is
 * testable without a database.
 *
 * The operator supplies the portfolio size, never the tier: they know how many
 * units the agency manages, and which band that falls in is arithmetic we
 * already own. A manual tier is accepted for the odd case, but it is an
 * override of a derived answer rather than a free choice.
 */

export interface NewAgencyInput {
  agencyName?: string;
  slug?: string;
  ownerName?: string;
  ownerEmail?: string;
  unitCount?: number | string;
  /** Optional: override the tier the unit count implies. */
  tier?: string;
  priceOverride?: number | string | null;
  priceOverrideReason?: string | null;
  priceOverrideUntil?: string | null;
}

export interface NewAgencyPlan {
  agencyName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  unitCount: number;
  tier: PricedTier;
  mrr: number;
  priceOverride: number | null;
  priceOverrideReason: string | null;
  priceOverrideUntil: string | null;
  /** True when the tier came from the operator rather than from the units. */
  tierOverridden: boolean;
}

export type NewAgencyResult =
  | { ok: true; plan: NewAgencyPlan }
  | { ok: false; error: string; field?: keyof NewAgencyInput };

const TIERS: PricedTier[] = ['custom', 'starter', 'growth', 'scale'];

/**
 * A URL-safe slug. This becomes `<slug>.locare.co.za`, so it has to survive as
 * a DNS label: lowercase, alphanumeric and hyphens, no leading or trailing
 * hyphen, 63 characters at the outside.
 */
export function slugify(raw: string): string {
  return (raw ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

/** Deliberately permissive: the shapes a real address takes, not RFC 5322. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Labels the platform's own hosts use. An agency slug colliding with one would
 * make `app.locare.co.za` ambiguous, so they are refused. Mirrors APP_LABELS in
 * `hosts/host-name.ts`, plus the names we would want later.
 */
const RESERVED = new Set([
  'app', 'api', 'www', 'tenant', 'landlord', 'rentals', 'admin', 'mail',
  'locare', 'platform', 'demo', 'test', 'staging', 'static', 'assets', 'cdn',
]);

/** What a tier costs at a given portfolio size. Only `custom` varies with units. */
export function priceAtTier(tier: PricedTier, unitCount: number): number {
  return tier === 'custom' ? customPrice(unitCount) : Number(TIER_PRICES[tier] ?? 0);
}

/** A yyyy-mm-dd string that is today or later, or null when blank. */
function futureDate(raw: string | null | undefined, today: Date): { ok: boolean; value: string | null } {
  const s = (raw ?? '').trim();
  if (!s) return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, value: null };
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return { ok: false, value: null };
  const floor = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return d.getTime() >= floor ? { ok: true, value: s } : { ok: false, value: null };
}

export function planNewAgency(input: NewAgencyInput, today = new Date()): NewAgencyResult {
  const agencyName = (input.agencyName ?? '').trim().replace(/\s+/g, ' ');
  if (!agencyName) return { ok: false, error: 'The agency needs a name.', field: 'agencyName' };
  if (agencyName.length > 120) {
    return { ok: false, error: 'That name is too long — 120 characters at most.', field: 'agencyName' };
  }

  const slug = slugify(input.slug?.trim() || agencyName);
  if (!slug) {
    return {
      ok: false,
      field: 'slug',
      error: 'That name has no letters or digits to build a web address from — type one in.',
    };
  }
  if (RESERVED.has(slug)) {
    return { ok: false, error: `"${slug}" is reserved for Locare's own hosts. Choose another.`, field: 'slug' };
  }

  const ownerEmail = (input.ownerEmail ?? '').trim().toLowerCase();
  if (!ownerEmail) {
    return { ok: false, error: "The owner's email address is required — it is how they sign in.", field: 'ownerEmail' };
  }
  if (!EMAIL.test(ownerEmail)) {
    return { ok: false, error: `"${ownerEmail}" is not an email address.`, field: 'ownerEmail' };
  }

  const ownerName = (input.ownerName ?? '').trim().replace(/\s+/g, ' ') || 'Owner';

  const rawUnits = Number(input.unitCount);
  if (!Number.isFinite(rawUnits) || rawUnits < 0) {
    return { ok: false, error: 'Enter how many units the agency manages.', field: 'unitCount' };
  }
  const unitCount = Math.floor(rawUnits);
  if (unitCount === 0) {
    // Zero prices at zero, so an agency created this way would bill nothing and
    // nothing would ever say so. Make it a deliberate number instead.
    return {
      ok: false,
      field: 'unitCount',
      error: 'Enter how many units the agency manages — it sets the tier and the price.',
    };
  }
  if (unitCount > 100000) {
    return { ok: false, error: 'That unit count looks like a typo. Check it before saving.', field: 'unitCount' };
  }

  const derived = tierForUnits(unitCount);
  let tier = derived.tier;
  let tierOverridden = false;
  const wanted = (input.tier ?? '').trim().toLowerCase();
  if (wanted) {
    if (!TIERS.includes(wanted as PricedTier)) {
      return { ok: false, error: `"${input.tier}" is not a tier.`, field: 'tier' };
    }
    tier = wanted as PricedTier;
    tierOverridden = tier !== derived.tier;
  }
  // The price follows the tier actually being stored, so an overridden tier
  // bills at that tier rather than at the one the units implied.
  const mrr = tierOverridden ? priceAtTier(tier, unitCount) : derived.mrr;

  const override = input.priceOverride === '' || input.priceOverride == null
    ? null
    : Number(input.priceOverride);
  const reason = (input.priceOverrideReason ?? '').trim() || null;
  const until = futureDate(input.priceOverrideUntil, today);

  if (override != null && (!Number.isFinite(override) || override < 0)) {
    return { ok: false, error: 'The agreed price must be a number.', field: 'priceOverride' };
  }
  if (!until.ok) {
    return {
      ok: false,
      field: 'priceOverrideUntil',
      error: 'The override end date must be a real date, today or later.',
    };
  }

  // ── The below-floor rule ────────────────────────────────────────────────
  // An agency under the billable minimum cannot be created without a dated,
  // reasoned override. The billing guard refuses these portfolios anyway; the
  // difference is that it refuses them weeks later, at invoice time, in front
  // of whoever runs billing rather than whoever made the sale.
  if (belowMinimum(unitCount)) {
    if (override == null) {
      return {
        ok: false,
        field: 'priceOverride',
        error: `${unitCount} units is below the ${MIN_BILLABLE_UNITS}-unit minimum. `
          + `They would be billed for ${MIN_BILLABLE_UNITS} at R${customUnitRate()}/unit. `
          + 'Record the agreed price, a reason and an end date to create them anyway.',
      };
    }
    if (!reason) {
      return {
        ok: false,
        field: 'priceOverrideReason',
        error: 'A below-minimum price needs a reason — whoever reviews this in six months will not remember.',
      };
    }
    if (!until.value) {
      return {
        ok: false,
        field: 'priceOverrideUntil',
        error: 'A below-minimum price needs an end date. Open-ended discounts are how a floor stops being a floor.',
      };
    }
  }

  if (override != null && !reason) {
    return { ok: false, error: 'A negotiated price needs a reason.', field: 'priceOverrideReason' };
  }

  return {
    ok: true,
    plan: {
      agencyName, slug, ownerName, ownerEmail, unitCount, tier, mrr,
      priceOverride: override, priceOverrideReason: reason, priceOverrideUntil: until.value,
      tierOverridden,
    },
  };
}
