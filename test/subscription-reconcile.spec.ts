import { SubscriptionBillingService } from '@modules/subscriptions/subscription-billing.service';

/**
 * #182 — gateway webhook auto-reconciliation of platform-subscription invoices.
 * The service is exercised with a fake DataSource so we assert the branching
 * (match / no-match / idempotent / failed) and that a paid UPDATE only fires
 * when it should.
 */
type Row = { id: string; status: string };

function makeService(selectRows: Row[]) {
  const updates: Array<{ sql: string; params: unknown[] }> = [];
  const ds: any = {
    query: jest.fn(async (sql: string, params: unknown[]) => {
      if (/^\s*SELECT id, status FROM subscription_invoices/.test(sql)) return selectRows;
      updates.push({ sql, params });
      return [];
    }),
  };
  const svc = new SubscriptionBillingService(ds, {} as any);
  return { svc, updates };
}

describe('SubscriptionBillingService.reconcileByGatewayRef', () => {
  it('returns false and does nothing when no invoice owns the ref', async () => {
    const { svc, updates } = makeService([]);
    await expect(svc.reconcileByGatewayRef('ik_unknown', true)).resolves.toBe(false);
    expect(updates).toHaveLength(0);
  });

  it('marks an issued invoice paid on a successful callback', async () => {
    const { svc, updates } = makeService([{ id: 'inv-1', status: 'issued' }]);
    await expect(svc.reconcileByGatewayRef('ik_sub_inv-1', true)).resolves.toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0].sql).toMatch(/status = 'paid'/);
    expect(updates[0].params).toEqual(['inv-1', 'ik_sub_inv-1']);
  });

  it('is idempotent — an already-paid invoice is a no-op but still owns the ref', async () => {
    const { svc, updates } = makeService([{ id: 'inv-1', status: 'paid' }]);
    await expect(svc.reconcileByGatewayRef('ik_sub_inv-1', true)).resolves.toBe(true);
    expect(updates).toHaveLength(0);
  });

  it('does not mark paid on a failed callback, but claims the ref', async () => {
    const { svc, updates } = makeService([{ id: 'inv-1', status: 'issued' }]);
    await expect(svc.reconcileByGatewayRef('ik_sub_inv-1', false)).resolves.toBe(true);
    expect(updates).toHaveLength(0);
  });
});
