import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/common/database/data-source';

/**
 * Tenant isolation is a non-negotiable (CLAUDE.md) and until now nothing
 * asserted it automatically. Every other DB-backed suite connects as the owner,
 * which Postgres exempts from its own RLS policies — so a table shipped without
 * a policy, or a policy dropped by a later migration, would pass the whole test
 * suite and only surface when one agency saw another's data.
 *
 * Two halves, because they fail for different reasons:
 *
 *   1. A catalogue sweep. Every table carrying `vendor_id` has RLS enabled and
 *      at least one policy. This is the convention in CLAUDE.md ("new
 *      tenant-scoped table -> migration with RLS policy, in the same file")
 *      expressed as a test, so the rule fails CI rather than a code review.
 *
 *   2. A behavioural proof, as the unprivileged `pms_app` role: with
 *      app.current_vendor_id set to one vendor, the other vendor's row is
 *      invisible even when asked for by primary key, and writing into the other
 *      tenant is refused outright.
 *
 * Half 2 needs APP_DATABASE_URL (the pms_app connection string). Without it the
 * half skips loudly rather than passing vacuously — same reasoning as
 * test/global-setup.js: a suite that reports a pass with nothing connected is a
 * lie shaped exactly like success.
 */

const dbDescribe = process.env.DB_AVAILABLE === '1' ? describe : describe.skip;

let owner: DataSource | null = null;
let app: DataSource | null = null;

/** Rows this suite created, torn down in afterAll. Obviously synthetic on sight. */
const TAG = `rls-check-${Date.now()}`;
let vendorA = '';
let vendorB = '';

beforeAll(async () => {
  if (process.env.DB_AVAILABLE !== '1') return;
  owner = await new DataSource({ ...dataSourceOptions, logging: false }).initialize();

  if (process.env.APP_DATABASE_URL) {
    app = await new DataSource({
      type: 'postgres',
      url: process.env.APP_DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      entities: [],
      synchronize: false,
      logging: false,
    }).initialize();
  }

  if (owner) {
    const [a] = await owner.query(
      `INSERT INTO vendors (name) VALUES ($1) RETURNING id`,
      [`${TAG} A`],
    );
    const [b] = await owner.query(
      `INSERT INTO vendors (name) VALUES ($1) RETURNING id`,
      [`${TAG} B`],
    );
    vendorA = a.id;
    vendorB = b.id;
    await owner.query(
      `INSERT INTO properties (vendor_id, name) VALUES ($1, $2), ($3, $4)`,
      [vendorA, `${TAG} A building`, vendorB, `${TAG} B building`],
    );
  }
}, 60_000);

afterAll(async () => {
  if (owner?.isInitialized && vendorA) {
    await owner.query(`DELETE FROM properties WHERE vendor_id = ANY($1)`, [[vendorA, vendorB]]);
    await owner.query(`DELETE FROM vendors WHERE id = ANY($1)`, [[vendorA, vendorB]]);
  }
  if (app?.isInitialized) await app.destroy();
  if (owner?.isInitialized) await owner.destroy();
});

/** Run `fn` on one connection with the tenant context set, as the app does. */
async function asTenant<T>(vendorId: string, fn: (q: any) => Promise<T>): Promise<T> {
  if (!app) throw new Error('No app DataSource — this test should have been skipped.');
  const q = app.createQueryRunner();
  await q.connect();
  await q.startTransaction();
  try {
    await q.query(`SELECT set_config('app.current_vendor_id', $1, true)`, [vendorId]);
    return await fn(q);
  } finally {
    await q.rollbackTransaction();
    await q.release();
  }
}

dbDescribe('tenant isolation is enforced by Postgres', () => {
  it('every table with vendor_id has RLS enabled and a policy', async () => {
    const rows: Array<{ relname: string; rls: boolean; policies: string }> = await owner!.query(`
      SELECT c.relname,
             c.relrowsecurity AS rls,
             (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
                         AND a.attname = 'vendor_id'
                         AND a.attnum > 0
                         AND NOT a.attisdropped
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `);

    expect(rows.length).toBeGreaterThan(0);

    const unprotected = rows
      .filter((r) => !r.rls || Number(r.policies) === 0)
      .map((r) => `${r.relname} (rls=${r.rls}, policies=${r.policies})`);

    // Named rather than counted, so a failure says which migration to fix.
    expect(unprotected).toEqual([]);
    console.log(`  checked ${rows.length} tenant-scoped tables; all have RLS and a policy`);
  });

  const appIt = process.env.APP_DATABASE_URL ? it : it.skip;

  if (!process.env.APP_DATABASE_URL) {
    // Visible in the run output, unlike a silently skipped block.
    console.warn(
      '\n  APP_DATABASE_URL is not set, so the behavioural half is SKIPPED, not passed.' +
        '\n    Set it to the pms_app connection string (see .env.example).\n',
    );
  }

  appIt('one vendor cannot read another vendor rows', async () => {
    const visible = await asTenant(vendorA, (q) =>
      q.query(`SELECT vendor_id FROM properties WHERE name LIKE $1`, [`${TAG}%`]),
    );
    expect(visible.map((r: any) => r.vendor_id)).toEqual([vendorA]);
  });

  appIt('asking for another vendor row by id still returns nothing', async () => {
    // The interesting case: the id is known and correct, and RLS is the only
    // thing standing between the caller and the row.
    const [other] = await owner!.query(
      `SELECT id FROM properties WHERE vendor_id = $1`,
      [vendorB],
    );
    const found = await asTenant(vendorA, (q) =>
      q.query(`SELECT id FROM properties WHERE id = $1`, [other.id]),
    );
    expect(found).toEqual([]);
  });

  appIt('writing into another vendor is refused', async () => {
    await expect(
      asTenant(vendorA, (q) =>
        q.query(`INSERT INTO properties (vendor_id, name) VALUES ($1, $2)`, [
          vendorB,
          `${TAG} smuggled`,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  appIt('no tenant context means no rows, rather than all rows', async () => {
    // A request that forgets to set the context must fail closed. The policy
    // compares against current_setting(..., true), which is NULL when unset, so
    // every comparison is NULL and nothing matches.
    const q = app!.createQueryRunner();
    await q.connect();
    try {
      const rows = await q.query(`SELECT id FROM properties WHERE name LIKE $1`, [`${TAG}%`]);
      expect(rows).toEqual([]);
    } finally {
      await q.release();
    }
  });
});
