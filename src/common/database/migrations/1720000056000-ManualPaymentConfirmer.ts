import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Who confirmed an off-gateway payment.
 *
 * A gateway payment is evidenced by the gateway. A cash payment recorded by
 * staff is evidenced by nothing but the person who pressed the button — and in
 * an agency holding other people's money in a trust account, "someone marked
 * this invoice paid" needs a name against it. Nullable because every payment
 * written before this, and every gateway payment after it, has no confirmer.
 *
 * No GRANT needed: a new column inherits the table's existing privileges, and
 * `payments` was already granted to pms_app.
 */
export class ManualPaymentConfirmer1720000056000 implements MigrationInterface {
  name = 'ManualPaymentConfirmer1720000056000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "confirmed_by" uuid;`);
    await q.query(`COMMENT ON COLUMN "payments"."confirmed_by" IS 'Staff user who recorded an off-gateway payment; null for gateway payments.';`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "confirmed_by";`);
  }
}
