import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Owner portal: link an owner record to a login user so property owners can
 * sign in and view their own statements, payouts, properties and banking.
 */
export class OwnerPortal1720000017000 implements MigrationInterface {
  name = 'OwnerPortal1720000017000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "user_id" uuid;`);
    await q.query(`CREATE INDEX IF NOT EXISTS "ix_owners_user" ON "owners" ("vendor_id","user_id");`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "ix_owners_user";`);
    await q.query(`ALTER TABLE "owners" DROP COLUMN IF EXISTS "user_id";`);
  }
}
