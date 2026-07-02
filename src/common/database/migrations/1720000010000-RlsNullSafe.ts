import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Make RLS policies null-safe. The original policies cast
 * current_setting('app.current_vendor_id') directly to uuid, which throws
 * "invalid input syntax for type uuid" when there is NO vendor context (the GUC
 * is an empty string) — breaking legitimately public, no-context reads. Wrapping
 * in NULLIF(...) turns '' into NULL so the predicate simply matches no rows.
 */
export class RlsNullSafe1720000010000 implements MigrationInterface {
  name = 'RlsNullSafe1720000010000';

  private readonly vendorScoped = [
    'memberships', 'properties', 'units', 'leases', 'deposits', 'ledger_entries',
    'accounts', 'invoices', 'payments', 'owners', 'owner_statements', 'payouts',
    'notifications', 'notification_preferences', 'documents', 'signature_requests',
    'expenses', 'listings', 'applications',
  ];

  public async up(q: QueryRunner): Promise<void> {
    const expr = `NULLIF(current_setting('app.current_vendor_id', true), '')::uuid`;

    // vendors keyed on id
    await q.query(`DROP POLICY IF EXISTS "vendors_tenant_isolation" ON "vendors";`);
    await q.query(`
      CREATE POLICY "vendors_tenant_isolation" ON "vendors"
      USING ("id" = ${expr}) WITH CHECK ("id" = ${expr});
    `);

    for (const t of this.vendorScoped) {
      await q.query(`DROP POLICY IF EXISTS "${t}_tenant_isolation" ON "${t}";`);
      await q.query(`
        CREATE POLICY "${t}_tenant_isolation" ON "${t}"
        USING ("vendor_id" = ${expr}) WITH CHECK ("vendor_id" = ${expr});
      `);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    const expr = `current_setting('app.current_vendor_id', true)::uuid`;
    await q.query(`DROP POLICY IF EXISTS "vendors_tenant_isolation" ON "vendors";`);
    await q.query(`
      CREATE POLICY "vendors_tenant_isolation" ON "vendors"
      USING ("id" = ${expr}) WITH CHECK ("id" = ${expr});
    `);
    for (const t of this.vendorScoped) {
      await q.query(`DROP POLICY IF EXISTS "${t}_tenant_isolation" ON "${t}";`);
      await q.query(`
        CREATE POLICY "${t}_tenant_isolation" ON "${t}"
        USING ("vendor_id" = ${expr}) WITH CHECK ("vendor_id" = ${expr});
      `);
    }
  }
}
