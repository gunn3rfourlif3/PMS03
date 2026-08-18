import {
  checkCollection, runPreCollectionCheck, CollectionCandidate,
} from '../src/modules/debicheck/precollection-check';

const ready = (over: Partial<CollectionCandidate> = {}): CollectionCandidate => ({
  leaseId: 'lease-1',
  mandateId: 'm-1',
  mandateState: 'active',
  ceiling: 12831,
  amountDue: 10000,
  vendorStatus: 'active',
  ...over,
});

describe('pre-collection check (§5.5)', () => {
  it('passes a healthy collection', () => {
    const r = checkCollection(ready());
    expect(r.ok).toBe(true);
    expect(r.issue).toBeUndefined();
  });

  // The §5 failure mode: looks fine until the bank rejects it, then the tenant
  // appears to be in arrears through no fault of their own.
  it('catches an escalation that breaches the ceiling', () => {
    const r = checkCollection(ready({ amountDue: 13000 }));
    expect(r.issue).toBe('ceiling_breach');
    expect(r.actionable).toBe(true);
    expect(r.detail).toContain('13000');
    expect(r.detail).toContain('12831');
  });

  it('treats exactly the ceiling as collectable', () => {
    expect(checkCollection(ready({ amountDue: 12831 })).ok).toBe(true);
  });

  it('flags a lease with no mandate', () => {
    const r = checkCollection(ready({ mandateId: undefined, mandateState: undefined }));
    expect(r.issue).toBe('no_mandate');
    expect(r.actionable).toBe(true);
  });

  it.each(['requested', 'drafted', 'cancelled', 'suspended', 'expired', 'rejected'] as const)(
    'refuses to collect against a %s mandate', (state) => {
      const r = checkCollection(ready({ mandateState: state }));
      expect(r.issue).toBe('mandate_not_collectable');
      expect(r.detail).toContain(state);
    },
  );

  // Collections continue at the old ceiling while re-authentication is out (§4).
  it('still collects while a mandate is amending', () => {
    expect(checkCollection(ready({ mandateState: 'amending' })).ok).toBe(true);
  });

  it.each(['not_registered', 'applied', 'suspended'] as const)(
    'blocks every lease when the agency is %s', (vendorStatus) => {
      const r = checkCollection(ready({ vendorStatus }));
      expect(r.issue).toBe('vendor_not_registered');
      // Not actionable per-lease: the agency fixes this once, centrally.
      expect(r.actionable).toBe(false);
    },
  );

  // Ordering matters: an unregistered agency must not generate one "fix this
  // mandate" task per lease, or the real problem is buried.
  it('reports the agency problem, not a mandate problem, when both apply', () => {
    const r = checkCollection(ready({ vendorStatus: 'applied', mandateState: 'cancelled' }));
    expect(r.issue).toBe('vendor_not_registered');
  });

  it('does not flag a zero-amount collection as a mandate fault', () => {
    const r = checkCollection(ready({ amountDue: 0 }));
    expect(r.issue).toBe('nothing_due');
    expect(r.actionable).toBe(false);
  });
});

describe('run summary', () => {
  const summary = runPreCollectionCheck([
    ready({ leaseId: 'ok-1' }),
    ready({ leaseId: 'ok-2' }),
    ready({ leaseId: 'breach', amountDue: 99999 }),
    ready({ leaseId: 'none', mandateId: undefined, mandateState: undefined }),
    ready({ leaseId: 'zero', amountDue: 0 }),
  ]);

  it('counts ready and blocked', () => {
    expect(summary.total).toBe(5);
    expect(summary.ready).toBe(2);
    expect(summary.blocked).toBe(3);
  });

  it('separates what staff can actually fix from what they cannot', () => {
    expect(summary.actionable.map((r) => r.leaseId)).toEqual(['breach', 'none']);
    expect(summary.actionable).toHaveLength(2); // 'zero' is excluded
  });

  it('puts ceiling breaches first — they fail silently until the bank rejects', () => {
    expect(summary.actionable[0].issue).toBe('ceiling_breach');
  });

  it('tallies by issue for the back-office queue', () => {
    expect(summary.byIssue).toEqual({ ceiling_breach: 1, no_mandate: 1, nothing_due: 1 });
  });

  it('handles an empty run', () => {
    const empty = runPreCollectionCheck([]);
    expect(empty.total).toBe(0);
    expect(empty.actionable).toEqual([]);
  });
});
