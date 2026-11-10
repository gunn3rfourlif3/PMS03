import { DataSource, EntityManager } from 'typeorm';
import { dataSourceOptions } from '../src/common/database/data-source';
import { TenantContextService } from '../src/common/tenancy/tenant-context.service';
import { ReportingService } from '../src/modules/reporting/reporting.service';

/**
 * A part-paid invoice must read the same on every screen.
 *
 * THE BUG. The rent roll, the arrears ageing and the god's-eye portfolio state
 * each summed the FULL total of every unpaid invoice, while the record-payment
 * modal subtracted what had already been allocated. Record R5,000 against a
 * R12,000 invoice and the rent roll still said R12,000 — so staff taking cash
 * in the sealed on-site mode, the one mode where part-payments are routine,
 * could bank the same rent twice.
 *
 * Nothing caught it because every reporting spec was a pure-function test and
 * the SQL had no coverage at all. Hence this suite: it builds one lease with
 * one part-paid invoice and asserts all four read the same number.
 *
 * WHY IT MATTERS MORE THAN AN ORDINARY REGRESSION. This ships to a sealed
 * machine in a client's building with no remote access and no way to push a
 * fix. A wrong number there is a site visit, or a client reconciling by hand.
 */

const dbDescribe = process.env.DB_AVAILABLE === '1' ? describe : describe.skip;

const TAG = `outstanding-check-${Date.now()}`;
const INVOICE_TOTAL = 12_000;
const PAID = 5_000;
const STILL_OWED = INVOICE_TOTAL - PAID;

let owner: DataSource | null = null;
let vendorId = '';
let leaseId = '';
let invoiceId = '';

/**
 * Run `fn` with the tenant context the app's interceptor would have set.
 *
 * The `set_config` below mirrors production, but note it does NOT scope these
 * queries: this suite connects as the table owner, and Postgres exempts the
 * owner from RLS. Per-lease assertions are therefore safe, and any assertion on
 * a vendor-wide total must be written as a delta. See the ageing test.
 *
 * Everything runs in a transaction that is rolled back, so tests may insert
 * freely and leave nothing behind.
 */
async function asTenant<T>(fn: (reporting: ReportingService, m: EntityManager) => Promise<T>): Promise<T> {
  if (!owner) throw new Error('No DataSource — this suite should have been skipped.');
  const tenant = new TenantContextService();
  const reporting = new ReportingService(tenant);
  const q = owner.createQueryRunner();
  await q.connect();
  await q.startTransaction();
  try {
    await q.query(`SELECT set_config('app.current_vendor_id', $1, true)`, [vendorId]);
    return await tenant.run(
      { vendorId, userId: null, roles: ['vendor_owner'], manager: q.manager },
      () => fn(reporting, q.manager),
    );
  } finally {
    await q.rollbackTransaction();
    await q.release();
  }
}

beforeAll(async () => {
  if (process.env.DB_AVAILABLE !== '1') return;
  owner = await new DataSource({ ...dataSourceOptions, logging: false }).initialize();

  const [v] = await owner.query(`INSERT INTO vendors (name) VALUES ($1) RETURNING id`, [TAG]);
  vendorId = v.id;

  const [prop] = await owner.query(
    `INSERT INTO properties (vendor_id, name) VALUES ($1, $2) RETURNING id`,
    [vendorId, `${TAG} building`],
  );
  const [unit] = await owner.query(
    `INSERT INTO units (vendor_id, property_id, label, status) VALUES ($1, $2, $3, 'occupied') RETURNING id`,
    [vendorId, prop.id, `${TAG}-01`],
  );
  const [lease] = await owner.query(
    `INSERT INTO leases (vendor_id, unit_id, status, start_date, rent_amount)
     VALUES ($1, $2, 'active', CURRENT_DATE - 400, $3) RETURNING id`,
    [vendorId, unit.id, INVOICE_TOTAL],
  );
  leaseId = lease.id;

  // One invoice, 45 days overdue so it lands in a known ageing bucket.
  const [inv] = await owner.query(
    `INSERT INTO invoices (vendor_id, lease_id, period, due_date, status, total)
     VALUES ($1, $2, $3, CURRENT_DATE - 45, 'partly_paid', $4) RETURNING id`,
    [vendorId, leaseId, '2099-01', INVOICE_TOTAL],
  );
  invoiceId = inv.id;

  // Part payment, allocated to that invoice exactly as the gateway and the
  // manual-capture path both write it.
  await owner.query(
    `INSERT INTO payments (vendor_id, amount, method, gateway_ref, status, received_at, allocation)
     VALUES ($1, $2, 'cash', $3, 'succeeded', now(), $4::jsonb)`,
    [vendorId, PAID, `${TAG}-pay`, JSON.stringify([{ invoiceId, amount: PAID }])],
  );
}, 60_000);

afterAll(async () => {
  if (owner?.isInitialized && vendorId) {
    await owner.query(`DELETE FROM payments   WHERE vendor_id = $1`, [vendorId]);
    await owner.query(`DELETE FROM invoices   WHERE vendor_id = $1`, [vendorId]);
    await owner.query(`DELETE FROM leases     WHERE vendor_id = $1`, [vendorId]);
    await owner.query(`DELETE FROM units      WHERE vendor_id = $1`, [vendorId]);
    await owner.query(`DELETE FROM properties WHERE vendor_id = $1`, [vendorId]);
    await owner.query(`DELETE FROM vendors    WHERE id = $1`, [vendorId]);
  }
  if (owner?.isInitialized) await owner.destroy();
});

dbDescribe('a part-paid invoice reads the same everywhere', () => {
  it('rent roll shows what is still owed, not the invoice total', async () => {
    const rows = await asTenant((r) => r.rentRoll() as Promise<Array<Record<string, unknown>>>);
    const mine = rows.filter((r) => String(r.lease_id) === leaseId);
    expect(mine).toHaveLength(1);
    // The bug's signature: this read 12000 before the fix.
    expect(Number(mine[0].outstanding)).toBe(STILL_OWED);
  });

  /**
   * A DELTA, not an absolute, and the reason is worth keeping.
   *
   * `arrearsAging()` has no lease filter, and this suite connects as the
   * database owner, which Postgres exempts from its own RLS policies — so the
   * `app.current_vendor_id` set in `asTenant` does not scope anything here.
   * The figures therefore cover every vendor in the database, which on a
   * seeded demo machine is a whole agency's twelve months of invoices.
   *
   * An absolute assertion claims the fixture is the only thing in its bucket
   * in the entire database. That is true on an empty database and false
   * everywhere else: this test first read 17,925 against an expected 7,000.
   * Measuring the change the fixture causes proves the same thing and is
   * indifferent to what else is there.
   */
  it('arrears ageing buckets the net figure, and still reconciles', async () => {
    const GROSS = 20_000;
    const PART_PAID = 13_000;
    const NET = GROSS - PART_PAID;

    const { before, after } = await asTenant(async (r, m) => {
      const before = await r.arrearsAging();

      // Another invoice in the same 31-60 bucket, mostly but not fully paid.
      const [inv] = await m.query(
        `INSERT INTO invoices (vendor_id, lease_id, period, due_date, status, total)
         VALUES ($1, $2, '2099-09', CURRENT_DATE - 45, 'partly_paid', $3) RETURNING id`,
        [vendorId, leaseId, GROSS],
      );
      await m.query(
        `INSERT INTO payments (vendor_id, amount, method, gateway_ref, status, received_at, allocation)
         VALUES ($1, $2, 'cash', $3, 'succeeded', now(), $4::jsonb)`,
        [vendorId, PART_PAID, `${TAG}-pay-aging`,
         JSON.stringify([{ invoiceId: inv.id, amount: PART_PAID }])],
      );

      return { before, after: await r.arrearsAging() };
    });

    // The bug's signature: these rose by GROSS before the fix.
    expect(after['31-60'] - before['31-60']).toBeCloseTo(NET, 2);
    expect(after.total - before.total).toBeCloseTo(NET, 2);

    // And the buckets still add up, on both sides of the change.
    for (const aging of [before, after]) {
      const sum =
        aging.notYetDue + aging['0-30'] + aging['31-60'] + aging['61-90'] + aging['90+'];
      expect(sum).toBeCloseTo(aging.total, 2);
      expect(aging.arrears).toBeCloseTo(aging.total - aging.notYetDue, 2);
    }
  });

  it('portfolio state shows the same figure as the rent roll', async () => {
    const state = await asTenant((r) => r.portfolioState());
    const unit = state.units.find((u) => u.leaseId === leaseId);
    expect(unit).toBeDefined();
    expect(unit!.outstanding).toBe(STILL_OWED);
  });

  it('a voided invoice is owed by nobody', async () => {
    const before = await asTenant((r) => r.rentRoll() as Promise<Array<Record<string, unknown>>>);
    const was = Number(before.find((r) => String(r.lease_id) === leaseId)!.outstanding);

    const after = await asTenant(async (r, m) => {
      await m.query(
        `INSERT INTO invoices (vendor_id, lease_id, period, due_date, status, total)
         VALUES ($1, $2, '2099-02', CURRENT_DATE - 10, 'void', 9999)`,
        [vendorId, leaseId],
      );
      const rows = (await r.rentRoll()) as Array<Record<string, unknown>>;
      return Number(rows.find((x) => String(x.lease_id) === leaseId)!.outstanding);
    });

    // `status <> 'paid'` counted void and draft invoices too.
    expect(after).toBe(was);
  });

  it('settling the rest brings it to zero', async () => {
    const left = await asTenant(async (r, m) => {
      await m.query(
        `INSERT INTO payments (vendor_id, amount, method, gateway_ref, status, received_at, allocation)
         VALUES ($1, $2, 'cash', $3, 'succeeded', now(), $4::jsonb)`,
        [vendorId, STILL_OWED, `${TAG}-pay-2`, JSON.stringify([{ invoiceId, amount: STILL_OWED }])],
      );
      const rows = (await r.rentRoll()) as Array<Record<string, unknown>>;
      return Number(rows.find((x) => String(x.lease_id) === leaseId)!.outstanding);
    });
    expect(left).toBe(0);
  });

  /**
   * The second bug, and the one that reached money.
   *
   * `collectionSummary`, `incomeStatement` and the owner-statement payout all
   * joined on `allocation->0` — the first invoice a payment touched — and then
   * summed the payment's WHOLE amount against that invoice's period. A payment
   * settling two months therefore counted twice over: in full, in the wrong
   * month. Collected passed billed, the rate went over 100%, and the dashboard
   * ring clamped it to a tidy "100.0%" that looked like good news.
   */
  it('a payment split across two periods is counted once in each', async () => {
    const JAN = 4_000;
    const FEB = 6_000;

    const { jan, feb } = await asTenant(async (r, m) => {
      const [a] = await m.query(
        `INSERT INTO invoices (vendor_id, lease_id, period, due_date, status, total)
         VALUES ($1, $2, '2098-01', CURRENT_DATE - 60, 'issued', $3) RETURNING id`,
        [vendorId, leaseId, JAN],
      );
      const [b] = await m.query(
        `INSERT INTO invoices (vendor_id, lease_id, period, due_date, status, total)
         VALUES ($1, $2, '2098-02', CURRENT_DATE - 30, 'issued', $3) RETURNING id`,
        [vendorId, leaseId, FEB],
      );
      // ONE payment settling both months.
      await m.query(
        `INSERT INTO payments (vendor_id, amount, method, gateway_ref, status, received_at, allocation)
         VALUES ($1, $2, 'eft', $3, 'succeeded', now(), $4::jsonb)`,
        [vendorId, JAN + FEB, `${TAG}-pay-split`,
         JSON.stringify([
           { invoiceId: a.id, amount: JAN },
           { invoiceId: b.id, amount: FEB },
         ])],
      );
      return {
        jan: await r.collectionSummary('2098-01'),
        feb: await r.collectionSummary('2098-02'),
      };
    });

    // Before the fix January collected the whole 10,000 and February nothing.
    expect(jan.collected).toBeCloseTo(JAN, 2);
    expect(feb.collected).toBeCloseTo(FEB, 2);

    // And the rate it feeds the ring can no longer exceed 100.
    expect(jan.collectionRate).toBeCloseTo(100, 2);
    expect(feb.collectionRate).toBeCloseTo(100, 2);
  });

  it('a pending payment does not reduce what is owed', async () => {
    const left = await asTenant(async (r, m) => {
      await m.query(
        `INSERT INTO payments (vendor_id, amount, method, gateway_ref, status, allocation)
         VALUES ($1, 4000, 'eft', $2, 'pending', $3::jsonb)`,
        [vendorId, `${TAG}-pay-3`, JSON.stringify([{ invoiceId, amount: 4000 }])],
      );
      const rows = (await r.rentRoll()) as Array<Record<string, unknown>>;
      return Number(rows.find((x) => String(x.lease_id) === leaseId)!.outstanding);
    });
    expect(left).toBe(STILL_OWED);
  });
});
