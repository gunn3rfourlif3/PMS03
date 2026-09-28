/**
 * Assistant signals — LOCARE_ASSISTANT_DESIGN.md §6.
 *
 * Pure functions over data the partner pages already hold. No fetching, no
 * inference, no model, and deliberately no import from `src/` — the entities
 * there pull in TypeORM, which has no business in a client bundle. The input
 * types below are structural copies of the fields the pages already have.
 *
 * Every signal returns `null` when it has nothing to say. Rendering "no issues
 * found" is the panel's business, and the answer is: render nothing.
 */

export type Signal = {
  /** Stable key — the panel dedupes and caps on this. */
  id: string;
  /** One sentence, stating a number the screen can already prove. */
  text: string;
  /** Where the signal is resolved, in one click. */
  href: string;
};

/**
 * Mirrors OPEN_STAGES in `src/modules/partners/pipeline.ts`. Duplicated rather
 * than imported for the bundle reason above; if the funnel changes, both move.
 */
export const OPEN_STAGES = ['lead', 'contacted', 'demo', 'trial', 'proposal'] as const;
export type OpenStage = (typeof OPEN_STAGES)[number];

/** A deal has gone quiet after this many days without a stage change. */
export const STALE_DEAL_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

function isOpen(stage: string): boolean {
  return (OPEN_STAGES as readonly string[]).includes(stage);
}

function toTime(value: Date | string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export type DealLike = {
  stage: string;
  /** `stage_changed_at`. A deal with no timestamp is not evidence of staleness. */
  stageChangedAt?: Date | string | number | null;
};

/**
 * Open deals whose stage has not moved in STALE_DEAL_DAYS.
 *
 * Counts deals, not days: the panel says how many are quiet, the pipeline board
 * says which. `now` is injected so this stays a pure function.
 */
export function staleDealsSignal(deals: DealLike[], now: number = Date.now()): Signal | null {
  const cutoff = now - STALE_DEAL_DAYS * DAY_MS;
  const stale = (deals ?? []).filter((d) => {
    if (!d || !isOpen(d.stage)) return false;
    const t = toTime(d.stageChangedAt);
    return t !== null && t < cutoff;
  }).length;

  if (stale < 1) return null;
  return {
    id: 'stale-deals',
    text: stale === 1
      ? '1 deal has not moved in two weeks'
      : `${stale} deals have not moved in two weeks`,
    href: '/partner/pipeline',
  };
}

/**
 * At the open-lead cap. Mirrors `isAtOpenLeadCap` — the cap is passed in by the
 * page, which knows it; this file never reads process.env and never states the
 * number as a rule, only as the count the screen already shows.
 */
export function openLeadCapSignal(openCount: number, cap: number): Signal | null {
  const open = Number(openCount) || 0;
  const limit = Number(cap);
  if (!Number.isFinite(limit) || limit <= 0) return null;
  if (open < limit) return null;
  return {
    id: 'open-lead-cap',
    text: 'You cannot register new leads until some of your open ones close',
    href: '/partner/pipeline',
  };
}

/** The fields the banking page collects, all of them required for a payout. */
export const BANKING_FIELDS = ['bankName', 'accountHolder', 'accountNumber', 'branchCode', 'accountType'] as const;

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/**
 * Banking details missing or incomplete.
 *
 * The stored account number is masked back to the page as `accountNumberLast4`,
 * so a saved account reads as blank on `accountNumber` — treat either as proof
 * it is on file, or this nags a partner who is already done.
 */
export function bankingSignal(banking: Record<string, unknown> | null | undefined): Signal | null {
  const b = banking ?? {};
  const missing = BANKING_FIELDS.some((f) => {
    if (f === 'accountNumber') return isBlank(b.accountNumber) && isBlank(b.accountNumberLast4);
    return isBlank(b[f]);
  });
  if (!missing) return null;
  return {
    id: 'banking-missing',
    text: 'Payouts cannot run until your banking details are complete',
    href: '/partner/banking',
  };
}

/**
 * Unread product updates.
 *
 * `href` has no default on purpose. The changelog is served at `/admin/changelog`,
 * which is not a partner route, so there is currently nowhere partner-side for
 * this to land. Until one exists, the caller has nothing to pass and this signal
 * should not render — a prompt that cannot be acted on in one click should not
 * exist (design §6).
 */
export function unreadChangelogSignal(unread: number, href: string): Signal | null {
  const n = Number(unread) || 0;
  if (n < 1 || isBlank(href)) return null;
  return {
    id: 'unread-changelog',
    text: n === 1 ? '1 update you have not read' : `${n} updates you have not read`,
    href,
  };
}
