/**
 * Bank-statement matching — the mode A rent path
 * (docs/LOCARE_ONSITE_DEMO_BUILD_PLAN.md Day 5).
 *
 * With no published address there is no card and no instant EFT, so rent
 * arrives the way it already does for most agencies: a tenant pays by ordinary
 * EFT and someone reconciles the bank statement. This matches statement lines to
 * open invoices.
 *
 * Pure, with no DB or framework deps, because the one thing that must never
 * happen here is a wrong match. Money allocated to the wrong tenant's invoice is
 * discovered weeks later by the tenant who was wrongly chased, and the ledger is
 * what this product is selling.
 *
 * THE RULE: match only what is certain, and list everything else for a human.
 * An ambiguous line is never allocated to a best guess — ambiguity is reported
 * as ambiguity. A reconciliation screen with twelve unmatched lines is honest
 * work; a screen with zero unmatched lines and two wrong ones is a disaster that
 * looks like success.
 */
import { payerReference, beneficiaryReference } from './stitch-refs';

export interface StatementLine {
  /** Caller's own id for the line, so a result can be tied back to it. */
  id: string;
  /** Posting date, ISO (YYYY-MM-DD). */
  date: string;
  /** Free text as the bank supplies it. */
  description?: string;
  /** The payer/beneficiary reference field, where the bank separates it. */
  reference?: string;
  /** Rands. Credits are positive; debits are ignored as not-rent. */
  amount: number;
}

export interface OpenInvoice {
  id: string;
  tenantId?: string | null;
  /** Rands still owing on this invoice. */
  outstanding: number;
  dueDate: string;
}

export type MatchBasis = 'reference' | 'amount_and_date';

export type NoMatchReason =
  | 'not_a_credit'
  | 'no_candidate'
  | 'ambiguous_amount'
  | 'invoice_already_matched';

export interface Matched {
  line: StatementLine;
  invoice: OpenInvoice;
  basis: MatchBasis;
  amount: number;
}

export interface Unmatched {
  line: StatementLine;
  reason: NoMatchReason;
  /** Populated for `ambiguous_amount`, so the human sees what to choose between. */
  candidates?: string[];
}

export interface StatementMatchResult {
  matched: Matched[];
  unmatched: Unmatched[];
}

/** How far either side of a due date an amount-only match may sit. */
export const AMOUNT_MATCH_WINDOW_DAYS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Strip everything a bank might insert, so references compare on content. */
const normalise = (s: string | undefined | null): string =>
  (s ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const sameMoney = (a: number, b: number) => Math.abs(round2(a) - round2(b)) < 0.005;

/**
 * Match a statement against the open invoices.
 *
 * Two passes, strongest evidence first, because a reference is a statement of
 * intent by the payer and an amount is a coincidence waiting to happen:
 *
 *  1. REFERENCE. The line's text contains the payer or beneficiary reference
 *     derived for an invoice. Unambiguous by construction.
 *  2. AMOUNT AND DATE. Exactly one unmatched invoice is outstanding for this
 *     exact amount within the window. EXACTLY ONE — two candidates is
 *     `ambiguous_amount`, never the nearer one.
 *
 * An invoice is claimed at most once per run, so two identical payments cannot
 * both land on it.
 */
export function matchStatement(
  lines: StatementLine[],
  invoices: OpenInvoice[],
  opts?: { windowDays?: number },
): StatementMatchResult {
  const windowDays = opts?.windowDays ?? AMOUNT_MATCH_WINDOW_DAYS;
  const matched: Matched[] = [];
  const unmatched: Unmatched[] = [];
  const claimed = new Set<string>();

  const open = (invoices ?? []).filter((i) => i && Number(i.outstanding) > 0);

  // Precompute both references per invoice once.
  const refs = new Map<string, string[]>();
  for (const inv of open) {
    refs.set(inv.id, [
      normalise(payerReference(inv.id)),
      normalise(beneficiaryReference(inv.id)),
      normalise(inv.id),
    ].filter(Boolean));
  }

  const credits = (lines ?? []).filter((l) => {
    if (!l) return false;
    if (!(Number(l.amount) > 0)) {
      // A debit on the agency's account is not rent arriving.
      unmatched.push({ line: l, reason: 'not_a_credit' });
      return false;
    }
    return true;
  });

  // ---- pass 1: reference ----
  const leftover: StatementLine[] = [];
  for (const line of credits) {
    const hay = normalise(`${line.reference ?? ''}${line.description ?? ''}`);
    const hit = open.find((inv) => {
      const candidates = refs.get(inv.id) ?? [];
      return candidates.some((r) => r.length >= 6 && hay.includes(r));
    });
    if (!hit) { leftover.push(line); continue; }
    if (claimed.has(hit.id)) {
      // Two lines both quoting one invoice's reference. The second is a real
      // event — an overpayment, a duplicate EFT — and a human decides which.
      unmatched.push({ line, reason: 'invoice_already_matched' });
      continue;
    }
    claimed.add(hit.id);
    matched.push({ line, invoice: hit, basis: 'reference', amount: round2(Number(line.amount)) });
  }

  // ---- pass 2: amount and date ----
  for (const line of leftover) {
    const lineMs = Date.parse(`${line.date}T00:00:00Z`);
    const candidates = open.filter((inv) => {
      if (claimed.has(inv.id)) return false;
      if (!sameMoney(Number(inv.outstanding), Number(line.amount))) return false;
      const dueMs = Date.parse(`${inv.dueDate}T00:00:00Z`);
      if (!Number.isFinite(dueMs) || !Number.isFinite(lineMs)) return false;
      return Math.abs(lineMs - dueMs) <= windowDays * DAY_MS;
    });

    if (candidates.length === 1) {
      claimed.add(candidates[0].id);
      matched.push({
        line, invoice: candidates[0], basis: 'amount_and_date', amount: round2(Number(line.amount)),
      });
    } else if (candidates.length > 1) {
      // The case that matters. Two tenants on the same rent is ordinary in a
      // block of flats, so this is common rather than exotic — and allocating to
      // whichever sorted first would be a silent, confident error.
      unmatched.push({ line, reason: 'ambiguous_amount', candidates: candidates.map((c) => c.id) });
    } else {
      unmatched.push({ line, reason: 'no_candidate' });
    }
  }

  return { matched, unmatched };
}

/** For the screen: a reconciliation is worth showing as a proportion. */
export function matchSummary(result: StatementMatchResult): {
  lines: number; matched: number; unmatched: number; matchedAmount: number; matchedPct: number | null;
} {
  const m = result.matched.length;
  const u = result.unmatched.length;
  const total = m + u;
  return {
    lines: total,
    matched: m,
    unmatched: u,
    matchedAmount: round2(result.matched.reduce((s, x) => s + x.amount, 0)),
    matchedPct: total === 0 ? null : Math.round((m / total) * 100),
  };
}
