import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A per-agency negotiated price that survives the pricing ladder.
 *
 * `SubscriptionsService.refresh()` recomputes `mrr` from the unit count on every
 * call, for every tier except `enterprise`. That is right for a standard
 * customer and wrong for a grandfathered one — and Locare has exactly one
 * customer, who is grandfathered.
 *
 * LOCARE_COMMISSION_STRUCTURE.md §7.2: Dantalan signed at R925 with no VAT
 * position stated, and that is to be honoured for their current term rather
 * than invoicing the only customer a surprise increase; they move to the
 * standard basis at renewal, with notice. Without an override, the first time
 * anyone opens their subscription page a recompute silently reprices them to
 * whatever band their unit count lands in — and the first real invoice bills
 * that number.
 *
 * The alternative escape hatch was to mark them `enterprise`, which is a lie
 * about the plan they are on. It would misreport their tier in the back-office,
 * the admin subscriptions list and the commission basis, in order to protect a
 * price. A nullable override column says what is actually true.
 *
 * `override_until` implements the "current term, then standard, with notice"
 * half of §7.2: once the date passes, the ladder resumes on its own rather than
 * relying on someone remembering.
 */
export class SubscriptionPriceOverride1720000043000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE vendor_subscriptions
        ADD COLUMN IF NOT EXISTS price_override        numeric,
        ADD COLUMN IF NOT EXISTS price_override_reason text,
        ADD COLUMN IF NOT EXISTS price_override_until  date;`);

    // A negotiated price of zero is a real thing (a pilot, a written-off month),
    // so the column is nullable rather than defaulted — NULL means "use the
    // ladder", 0 means "bill nothing". A negative price is never meaningful.
    await q.query(`
      ALTER TABLE vendor_subscriptions
        DROP CONSTRAINT IF EXISTS vendor_subscriptions_price_override_nonneg;`);
    await q.query(`
      ALTER TABLE vendor_subscriptions
        ADD CONSTRAINT vendor_subscriptions_price_override_nonneg
        CHECK (price_override IS NULL OR price_override >= 0);`);

    // An override with no stated reason is an unexplained discount that nobody
    // can audit later. Require the reason whenever a price is set.
    await q.query(`
      ALTER TABLE vendor_subscriptions
        DROP CONSTRAINT IF EXISTS vendor_subscriptions_price_override_reason;`);
    await q.query(`
      ALTER TABLE vendor_subscriptions
        ADD CONSTRAINT vendor_subscriptions_price_override_reason
        CHECK (price_override IS NULL OR nullif(btrim(price_override_reason), '') IS NOT NULL);`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE vendor_subscriptions
        DROP CONSTRAINT IF EXISTS vendor_subscriptions_price_override_reason,
        DROP CONSTRAINT IF EXISTS vendor_subscriptions_price_override_nonneg;`);
    await q.query(`
      ALTER TABLE vendor_subscriptions
        DROP COLUMN IF EXISTS price_override_until,
        DROP COLUMN IF EXISTS price_override_reason,
        DROP COLUMN IF EXISTS price_override;`);
  }
}
