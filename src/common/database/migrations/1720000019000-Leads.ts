import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marketing leads captured from the public product site (agent registrations,
 * demo requests, contact). Platform-level (not vendor-scoped), so no RLS.
 */
export class Leads1720000019000 implements MigrationInterface {
  name = 'Leads1720000019000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "leads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" text NOT NULL DEFAULT 'contact',
        "name" varchar NOT NULL,
        "email" varchar NOT NULL,
        "phone" varchar,
        "company" varchar,
        "message" text,
        "meta" jsonb NOT NULL DEFAULT '{}',
        "status" text NOT NULL DEFAULT 'new',
        "created_at" timestamptz NOT NULL DEFAULT now()
      );`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_leads_type" ON "leads" ("type");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_leads_created" ON "leads" ("created_at");`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "leads";`);
  }
}
