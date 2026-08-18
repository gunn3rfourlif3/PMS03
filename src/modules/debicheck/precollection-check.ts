import { MandateState, isCollectable, breachesCeiling } from './mandate-calc';

/**
 * The T-3 pre-collection check (docs/LOCARE_DEBIT_ORDER_DESIGN.md §5.5).
 *
 * Run three days before each collection date, this answers one question per
 * lease: would submitting this collection fail, and if so why?
 *
 * The whole point is timing. A dead or breaching mandate found three days out
 * is an admin task someone can fix. Found on the day, it is a failed
 * collection, a tenant who looks like they are in arrears through no fault of
 * their own, and dunning firing at them for it (§5).
 *
 * Pure so the decision table is testable without a database or a gateway —
 * every branch here corresponds to a real rejection at the bank.
 */

export type PreCollectionIssue =
  | 'no_mandate'
  | 'mandate_not_collectable'
  | 'ceiling_breach'
  | 'vendor_not_registered'
  | 'nothing_due';

/** §7.1 registration state machine. Only `active` may submit collections. */
export type VendorDebiCheckStatus = 'not_registered' | 'applied' | 'active' | 'suspended';

export interface CollectionCandidate {
  leaseId: string;
  mandateId?: string;
  mandateState?: MandateState;
  /** The mandate's maximumCollectionAmount. */
  ceiling?: number;
  /** What we intend to collect. */
  amountDue: number;
  vendorStatus: VendorDebiCheckStatus;
}

export interface PreCollectionResult {
  leaseId: string;
  mandateId?: string;
  ok: boolean;
  issue?: PreCollectionIssue;
  detail: string;
  /** Actionable by the agency before the collection date, vs. informational. */
  actionable: boolean;
}

const DETAIL: Record<PreCollectionIssue, string> = {
  no_mandate: 'No debit order mandate on this lease',
  mandate_not_collectable: 'Mandate is not in a collectable state',
  ceiling_breach: 'Amount due exceeds the mandate maximum — the bank will reject this',
  vendor_not_registered: 'Agency is not registered for DebiCheck collections',
  nothing_due: 'Nothing to collect',
};

export function checkCollection(c: CollectionCandidate): PreCollectionResult {
  const base = { leaseId: c.leaseId, mandateId: c.mandateId };

  // Ordered by what a human should act on first. Vendor registration comes
  // before anything mandate-level: if the agency cannot collect at all, a
  // per-lease mandate problem is noise, and flagging every lease would bury it.
  if (c.vendorStatus !== 'active') {
    return { ...base, ok: false, issue: 'vendor_not_registered', detail: DETAIL.vendor_not_registered, actionable: false };
  }
  if ((Number(c.amountDue) || 0) <= 0) {
    return { ...base, ok: false, issue: 'nothing_due', detail: DETAIL.nothing_due, actionable: false };
  }
  if (!c.mandateId || !c.mandateState) {
    return { ...base, ok: false, issue: 'no_mandate', detail: DETAIL.no_mandate, actionable: true };
  }
  if (!isCollectable(c.mandateState)) {
    return {
      ...base, ok: false, issue: 'mandate_not_collectable',
      detail: `${DETAIL.mandate_not_collectable} (${c.mandateState})`, actionable: true,
    };
  }
  if (breachesCeiling(c.amountDue, c.ceiling ?? 0)) {
    return {
      ...base, ok: false, issue: 'ceiling_breach',
      detail: `${DETAIL.ceiling_breach} (due ${c.amountDue}, max ${c.ceiling ?? 0})`, actionable: true,
    };
  }
  return { ...base, ok: true, detail: 'Ready to collect', actionable: false };
}

export interface PreCollectionSummary {
  total: number;
  ready: number;
  blocked: number;
  /** Blocked AND fixable before the collection date — what staff must work. */
  actionable: PreCollectionResult[];
  byIssue: Partial<Record<PreCollectionIssue, number>>;
  results: PreCollectionResult[];
}

export function runPreCollectionCheck(candidates: CollectionCandidate[]): PreCollectionSummary {
  const results = candidates.map(checkCollection);
  const byIssue: Partial<Record<PreCollectionIssue, number>> = {};
  for (const r of results) if (r.issue) byIssue[r.issue] = (byIssue[r.issue] ?? 0) + 1;

  return {
    total: results.length,
    ready: results.filter((r) => r.ok).length,
    blocked: results.filter((r) => !r.ok).length,
    // Ceiling breaches first: they are the §5 failure mode, and unlike a missing
    // mandate they look fine right up until the bank rejects them.
    actionable: results
      .filter((r) => !r.ok && r.actionable)
      .sort((a, b) => Number(b.issue === 'ceiling_breach') - Number(a.issue === 'ceiling_breach')),
    byIssue,
    results,
  };
}
