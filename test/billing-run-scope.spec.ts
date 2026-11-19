import { BillingProcessor } from '../src/modules/billing/billing.processor';

/**
 * A bill run started from an agency's back office must bill that agency only.
 * The worklist function is cross-agency by design, so the scoping happens in
 * the worker — this pins it.
 */
describe('rent-invoice run scoping', () => {
  const rows = [
    { vendor_id: 'A', lease_id: 'a1', tenant_id: 't1', rent_amount: '100' },
    { vendor_id: 'A', lease_id: 'a2', tenant_id: 't2', rent_amount: '200' },
    { vendor_id: 'B', lease_id: 'b1', tenant_id: 't3', rent_amount: '300' },
  ];
  const make = () => {
    const billed: Array<{ vendor: string; lease: string; period: string }> = [];
    let vendor = '';
    const dataSource = { query: jest.fn().mockResolvedValue(rows) };
    const tenantRunner = { runInVendorContext: async (v: string, fn: () => Promise<void>) => { vendor = v; await fn(); } };
    const invoices = { generateRentInvoice: jest.fn(async (i: any) => { billed.push({ vendor, lease: i.leaseId, period: i.period }); }) };
    const p = new BillingProcessor(dataSource as any, tenantRunner as any, invoices as any, {} as any);
    return { p, billed, dataSource };
  };

  it('a run naming an agency bills only that agency', async () => {
    const { p, billed } = make();
    await p.process({ name: 'generate-rent-invoices', data: { period: '2027-01', dueDate: '2027-01-07', vendorId: 'A' } } as any);
    expect(billed.map((b) => b.lease)).toEqual(['a1', 'a2']);
    expect(new Set(billed.map((b) => b.vendor))).toEqual(new Set(['A']));
  });

  it('the monthly schedule (no agency) bills every agency', async () => {
    const { p, billed } = make();
    await p.process({ name: 'generate-rent-invoices', data: { period: '2027-01' } } as any);
    expect(billed.map((b) => b.lease)).toEqual(['a1', 'a2', 'b1']);
  });

  it('the monthly schedule carries no period and bills the month it fires in', async () => {
    const { p, billed, dataSource } = make();
    await p.process({ name: 'generate-rent-invoices', data: {} } as any);
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [month]);
    expect(billed[0].period).toBe(month);
  });
});
