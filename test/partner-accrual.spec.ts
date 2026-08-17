import { DataSource, QueryRunner } from 'typeorm';
import { dataSourceOptions } from '../src/common/database/data-source';
import { PartnerCommissionsService } from '../src/modules/partners/commissions.service';

/**
 * Accrual is cash-collected (docs/LOCARE_COMMISSION_STRUCTURE.md §4). The rule
 * lives in one SQL statement, so these run against a real database — asserting
 * it any other way would only be testing a mock.
 *
 * Skips visibly without Postgres; see test/global-setup.js.
 */

const dbDescribe = process.env.DB_AVAILABLE === '1' ? describe : describe.skip;

let ds: DataSource | null = null;

beforeAll(async () => {
  if (process.env.DB_AVAILABLE !== '1') return;
  ds = await new DataSource({ ...dataSourceOptions, logging: false }).initialize();
}, 30_000);

afterAll(async () => { if (ds?.isInitialized) await ds.destroy(); });

const uniq = () => Math.random().toString(36).slice(2, 10);
const PERIOD = '2026-07';

/**
 * The service takes an injected DataSource. Inside a rolled-back transaction we
 * need every statement on the *same* connection, so it is handed a stand-in
 * that proxies `query` to the transaction's QueryRunner.
 */
function serviceOn(q: QueryRunner): PartnerCommissionsService {
  const proxy = { query: (sql: string, params?: unknown[]) => q.query(sql, params) } as unknown as DataSource;
  return new PartnerCommissionsService(proxy);
}

async function inRollback(fn: (q: QueryRunner) => Promise<void>): Promise<void> {
  if (!ds) throw new Error('No DataSource — this suite should have been skipped.');
  const q = ds.createQueryRunner();
  await q.connect();
  await q.startTransaction();
  try { await fn(q); } finally { await q.rollbackTransaction(); await q.release(); }
}

/** Partner on 8% lifetime, plus a referred agency whose subscription started long ago. */
async function seed(
  q: QueryRunner,
  opts: { subStatus?: string; rate?: number; months?: number | null; startedAt?: string } = {},
) {
  const [p] = await q.query(
    `INSERT INTO partners (name, contact_email, ref_code, status, commission_rate, commission_months)
     VALUES ('Accrual Test Partner', $1, $2, 'active', $3, $4) RETURNING id`,
    [`p_${uniq()}@test.invalid`, `ACC_${uniq()}`, opts.rate ?? 0.08, opts.months ?? null],
  );
  const [v] = await q.query(
    `INSERT INTO vendors (name, type, default_currency, status)
     VALUES ($1, 'agency', 'ZAR', 'active') RETURNING id`,
    [`Accrual Agency ${uniq()}`],
  );
  // Fixed default rather than a relative date: a term-boundary assertion has to
  // be anchored, or it silently changes meaning as the calendar moves.
  await q.query(
    `INSERT INTO vendor_subscriptions (vendor_id, tier, status, mrr, referred_by_partner_id, started_at)
     VALUES ($1, 'growth', $2, 2660, $3, $4::timestamptz)`,
    [v.id, opts.subStatus ?? 'active', p.id, opts.startedAt ?? '2026-05-01'],
  );
  return { partnerId: p.id as string, vendorId: v.id as string };
}

/**
 * `subscription_invoices` is UNIQUE(vendor_id, period), so a vendor has at most
 * one invoice per billing period — `period` is a parameter here, not a constant.
 */
const invoice = (
  q: QueryRunner, vendorId: string, amount: number, status: string, paidAt: string | null,
  period: string = PERIOD,
) =>
  q.query(
    `INSERT INTO subscription_invoices (vendor_id, period, tier, unit_count, amount, status, paid_at)
     VALUES ($1, $2, 'growth', 12, $3, $4, $5)`,
    [vendorId, period, amount, status, paidAt],
  );

const commissionFor = async (q: QueryRunner, partnerId: string) => {
  const [c] = await q.query(
    `SELECT basis_mrr, amount, rate, status FROM partner_commissions WHERE partner_id = $1 AND period = $2`,
    [partnerId, PERIOD],
  );
  return c as { basis_mrr: string; amount: string; rate: string; status: string } | undefined;
};

dbDescribe('accrual is on cash collected, not billed (§4)', () => {
  it('accrues on an invoice paid within the period', async () => {
    await inRollback(async (q) => {
      const { partnerId, vendorId } = await seed(q);
      await invoice(q, vendorId, 2660, 'paid', `${PERIOD}-14T10:00:00Z`);

      await serviceOn(q).accrue(PERIOD);

      const c = await commissionFor(q, partnerId);
      expect(Number(c?.basis_mrr)).toBe(2660);
      expect(Number(c?.amount)).toBe(212.8); // 8% of collected
      expect(c?.status).toBe('pending');
    });
  }, 30_000);

  // The defect this change fixes: MRR is set, but no money arrived.
  it('accrues nothing on an unpaid invoice, even with MRR on the subscription', async () => {
    await inRollback(async (q) => {
      const { partnerId, vendorId } = await seed(q);
      await invoice(q, vendorId, 2660, 'issued', null);

      const r = await serviceOn(q).accrue(PERIOD);

      expect(r.accrued).toBe(0);
      expect(await commissionFor(q, partnerId)).toBeUndefined();
    });
  }, 30_000);

  it('accrues nothing for a trialing subscription', async () => {
    await inRollback(async (q) => {
      const { partnerId, vendorId } = await seed(q, { subStatus: 'trialing' });
      await invoice(q, vendorId, 2660, 'paid', `${PERIOD}-14T10:00:00Z`);

      await serviceOn(q).accrue(PERIOD);

      expect(await commissionFor(q, partnerId)).toBeUndefined();
    });
  }, 30_000);

  it('earns in the month the money landed, not the month billed', async () => {
    await inRollback(async (q) => {
      const { partnerId, vendorId } = await seed(q);
      // Invoice is for July; settled in August.
      await invoice(q, vendorId, 2660, 'paid', '2026-08-03T09:00:00Z');

      await serviceOn(q).accrue(PERIOD);
      expect(await commissionFor(q, partnerId)).toBeUndefined();

      await serviceOn(q).accrue('2026-08');
      const [c] = await q.query(
        `SELECT amount FROM partner_commissions WHERE partner_id = $1 AND period = '2026-08'`, [partnerId],
      );
      expect(Number(c?.amount)).toBe(212.8);
    });
  }, 30_000);

  // An agency in arrears settles June and July together in July. Both land in
  // the same month, so both earn in that month — the point of a cash basis.
  it('sums several periods settled in the same month', async () => {
    await inRollback(async (q) => {
      const { partnerId, vendorId } = await seed(q);
      await invoice(q, vendorId, 1000, 'paid', `${PERIOD}-05T10:00:00Z`, '2026-06');
      await invoice(q, vendorId, 2660, 'paid', `${PERIOD}-20T10:00:00Z`, PERIOD);

      await serviceOn(q).accrue(PERIOD);

      const c = await commissionFor(q, partnerId);
      expect(Number(c?.basis_mrr)).toBe(3660);
      expect(Number(c?.amount)).toBe(292.8);
    });
  }, 30_000);

  it('is idempotent — re-running does not double up', async () => {
    await inRollback(async (q) => {
      const { partnerId, vendorId } = await seed(q);
      await invoice(q, vendorId, 2660, 'paid', `${PERIOD}-14T10:00:00Z`);

      await serviceOn(q).accrue(PERIOD);
      await serviceOn(q).accrue(PERIOD);

      const [{ n }] = await q.query(
        `SELECT COUNT(*)::int AS n FROM partner_commissions WHERE partner_id = $1 AND period = $2`,
        [partnerId, PERIOD],
      );
      expect(n).toBe(1);
    });
  }, 30_000);

  /**
   * The 24-month Introducer window, pinned at its boundary rather than
   * approximated. `monthsElapsed` counts whole calendar months, so a
   * subscription starting in month 0 earns for elapsed 0..23 and stops at 24.
   * Anchored to fixed dates: "two years ago" against a July period gives 23,
   * which is still inside the term — the kind of off-by-one that makes a
   * relative-date test assert the opposite of what it claims.
   */
  it.each([
    ['2024-08-01', 23, true],  // last month that still earns
    ['2024-07-01', 24, false], // first month past the term
    ['2023-01-01', 42, false],
  ])('Introducer started %s → %i months elapsed, earns: %s', async (startedAt, _elapsed, earns) => {
    await inRollback(async (q) => {
      const { partnerId, vendorId } = await seed(q, { months: 24, startedAt });
      await invoice(q, vendorId, 2660, 'paid', `${PERIOD}-14T10:00:00Z`);

      await serviceOn(q).accrue(PERIOD);

      const c = await commissionFor(q, partnerId);
      if (earns) expect(Number(c?.amount)).toBe(212.8);
      else expect(c).toBeUndefined();
    });
  }, 30_000);

  it('withholds when the partner owns the referred agency (§7.4)', async () => {
    await inRollback(async (q) => {
      const email = `selfdeal_${uniq()}@test.invalid`;
      const [p] = await q.query(
        `INSERT INTO partners (name, contact_email, ref_code, status, commission_rate, commission_months)
         VALUES ('Self Dealer', $1, $2, 'active', 0.26, NULL) RETURNING id`,
        [email, `SD_${uniq()}`],
      );
      const [v] = await q.query(
        `INSERT INTO vendors (name, type, default_currency, status)
         VALUES ($1, 'agency', 'ZAR', 'active') RETURNING id`, [`Own Agency ${uniq()}`],
      );
      const [u] = await q.query(`INSERT INTO users (name, email) VALUES ('Self Dealer', $1) RETURNING id`, [email]);
      await q.query(
        `INSERT INTO memberships (vendor_id, user_id, role, scope) VALUES ($1, $2, 'vendor_owner', '{}')`,
        [v.id, u.id],
      );
      await q.query(
        `INSERT INTO vendor_subscriptions (vendor_id, tier, status, mrr, referred_by_partner_id, started_at)
         VALUES ($1, 'growth', 'active', 2660, $2, now() - interval '2 months')`,
        [v.id, p.id],
      );
      await invoice(q, v.id, 2660, 'paid', `${PERIOD}-14T10:00:00Z`);

      const r = await serviceOn(q).accrue(PERIOD);

      expect(r.withheld).toBeGreaterThanOrEqual(1);
      expect(await commissionFor(q, p.id)).toBeUndefined();
    });
  }, 30_000);
});
