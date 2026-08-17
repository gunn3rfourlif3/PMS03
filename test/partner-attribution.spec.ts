import { DataSource, QueryRunner } from 'typeorm';
import { dataSourceOptions } from '../src/common/database/data-source';

/**
 * Behavioural tests for migration 1720000039000 — the two SQL functions that
 * decide who owns a referral and when an Introducer's 24-month clock starts.
 *
 * These are the only DB-backed specs in the suite. Everything else here is a
 * pure unit test, because the rest of the logic is pure. This is not: the
 * behaviour under test lives inside plpgsql, so asserting it without Postgres
 * would only be asserting that a string contains a substring.
 *
 * Requires a running database (`.\scripts\start-all.ps1 -Setup`, or any
 * DATABASE_URL). `test/global-setup.js` probes for one before collection and
 * these suites report as SKIPPED when there is none.
 *
 * They must never report as passed without a database. An earlier version of
 * this file guarded at runtime and returned early, which produced a green suite
 * that had asserted nothing — indistinguishable from a real pass, and worse
 * than no test at all.
 *
 * Every case runs inside a transaction that is rolled back, so a local dev
 * database is left exactly as it was found.
 */

const dbDescribe = process.env.DB_AVAILABLE === '1' ? describe : describe.skip;

let ds: DataSource | null = null;

beforeAll(async () => {
  if (process.env.DB_AVAILABLE !== '1') return;
  ds = await new DataSource({ ...dataSourceOptions, logging: false }).initialize();
}, 30_000);

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});

/** Runs `fn` in a transaction that is always rolled back. */
async function inRollback(fn: (q: QueryRunner) => Promise<void>): Promise<void> {
  if (!ds) throw new Error('No DataSource — this suite should have been skipped.');
  const q = ds.createQueryRunner();
  await q.connect();
  await q.startTransaction();
  try {
    await fn(q);
  } finally {
    await q.rollbackTransaction();
    await q.release();
  }
}

const uniq = () => Math.random().toString(36).slice(2, 10);

async function seedPartner(q: QueryRunner, months: number | null = 24) {
  const ref = `TEST_${uniq()}`;
  const [row] = await q.query(
    `INSERT INTO partners (name, contact_email, ref_code, status, commission_rate, commission_months)
     VALUES ('Attribution Test Partner', $1, $2, 'active', 0.08, $3) RETURNING id`,
    [`partner_${uniq()}@test.invalid`, ref, months],
  );
  return { id: row.id as string, ref };
}

const subFor = async (q: QueryRunner, vendorId: string) => {
  const [s] = await q.query(
    `SELECT status, started_at, referred_by_partner_id AS partner FROM vendor_subscriptions WHERE vendor_id = $1`,
    [vendorId],
  );
  return s as { status: string; started_at: Date; partner: string | null };
};

dbDescribe('approve_agency() — the commission clock', () => {
  it('stamps started_at at activation, not at signup', async () => {
    await inRollback(async (q) => {
      const partner = await seedPartner(q);
      const [{ signup_agency: vendorId }] = await q.query(`SELECT signup_agency($1,$2,$3,$4)`, [
        partner.ref, 'Clock Test Agency', 'Owner', `owner_${uniq()}@test.invalid`,
      ]);

      // Simulate an approval that sat in the queue for two months. Before the
      // fix this time was silently deducted from the partner's 24-month window.
      await q.query(
        `UPDATE vendor_subscriptions SET started_at = now() - interval '60 days' WHERE vendor_id = $1`,
        [vendorId],
      );
      const before = await subFor(q, vendorId);
      expect(before.status).toBe('pending');

      await q.query(`SELECT approve_agency($1)`, [vendorId]);

      const after = await subFor(q, vendorId);
      expect(after.status).toBe('active');
      const ageSeconds = (Date.now() - new Date(after.started_at).getTime()) / 1000;
      expect(ageSeconds).toBeLessThan(60);
    });
  }, 30_000);

  it('does not restart the clock when an agency is approved twice', async () => {
    await inRollback(async (q) => {
      const partner = await seedPartner(q);
      const [{ signup_agency: vendorId }] = await q.query(`SELECT signup_agency($1,$2,$3,$4)`, [
        partner.ref, 'Double Approve Agency', 'Owner', `owner_${uniq()}@test.invalid`,
      ]);

      await q.query(`SELECT approve_agency($1)`, [vendorId]);
      const first = await subFor(q, vendorId);

      // Backdate so a restart would be unmistakable rather than sub-second.
      await q.query(
        `UPDATE vendor_subscriptions SET started_at = now() - interval '200 days' WHERE vendor_id = $1`,
        [vendorId],
      );
      const backdated = await subFor(q, vendorId);

      await q.query(`SELECT approve_agency($1)`, [vendorId]);
      const second = await subFor(q, vendorId);

      expect(second.status).toBe('active');
      expect(new Date(second.started_at).getTime()).toBe(new Date(backdated.started_at).getTime());
      expect(new Date(second.started_at).getTime()).not.toBe(new Date(first.started_at).getTime());
    });
  }, 30_000);

  it('leaves attribution untouched when approving', async () => {
    await inRollback(async (q) => {
      const partner = await seedPartner(q);
      const [{ signup_agency: vendorId }] = await q.query(`SELECT signup_agency($1,$2,$3,$4)`, [
        partner.ref, 'Attribution Survives Agency', 'Owner', `owner_${uniq()}@test.invalid`,
      ]);

      await q.query(`SELECT approve_agency($1)`, [vendorId]);

      expect((await subFor(q, vendorId)).partner).toBe(partner.id);
    });
  }, 30_000);
});

dbDescribe('referral attribution — first recorded wins', () => {
  it('provision_agency records the onboarding partner', async () => {
    await inRollback(async (q) => {
      const partner = await seedPartner(q, null);
      const [{ provision_agency: vendorId }] = await q.query(
        `SELECT provision_agency($1,$2,$3,$4,$5)`,
        [partner.id, 'Provisioned Agency', '', 'Owner', `owner_${uniq()}@test.invalid`],
      );

      const sub = await subFor(q, vendorId);
      expect(sub.partner).toBe(partner.id);
      expect(sub.status).toBe('active');
    });
  }, 30_000);

  it('a second write cannot take over an existing subscription', async () => {
    await inRollback(async (q) => {
      const first = await seedPartner(q);
      const second = await seedPartner(q);

      const [{ signup_agency: vendorId }] = await q.query(`SELECT signup_agency($1,$2,$3,$4)`, [
        first.ref, 'Contested Agency', 'Owner', `owner_${uniq()}@test.invalid`,
      ]);

      // The exact upsert both functions now use. Before the migration
      // provision_agency ran this as DO UPDATE, which would reassign the row.
      await q.query(
        `INSERT INTO vendor_subscriptions (vendor_id, tier, status, referred_by_partner_id)
         VALUES ($1, 'starter', 'active', $2)
         ON CONFLICT (vendor_id) DO NOTHING`,
        [vendorId, second.id],
      );

      expect((await subFor(q, vendorId)).partner).toBe(first.id);
    });
  }, 30_000);
});
