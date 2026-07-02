import 'reflect-metadata';
import dataSource from '../src/common/database/data-source';

/**
 * Minimal dev seed: one vendor (agency, FFC + trust account so the PPRA gate
 * passes), an owner user with a vendor_owner membership, and a property with a
 * vacant unit ready to list. Run AFTER migrations:  npm run seed
 *
 * Runs as the DB superuser (local `pms`), which bypasses RLS for setup inserts.
 */
async function main() {
  await dataSource.initialize();
  const q = (sql: string, params: unknown[] = []) => dataSource.query(sql, params);

  // Idempotent-ish: skip if the demo vendor already exists.
  const existing = await q(`SELECT id FROM vendors WHERE name = 'Demo Agency' LIMIT 1`);
  if (existing.length > 0) {
    console.log('Seed already applied. Vendor:', existing[0].id);
    await dataSource.destroy();
    return;
  }

  const [vendor] = await q(
    `INSERT INTO vendors (name, type, default_currency, has_valid_ffc, has_trust_account)
     VALUES ('Demo Agency', 'agency', 'ZAR', true, true) RETURNING id`,
  );
  const vendorId = vendor.id;

  const email = 'owner@demo.test';
  const [user] = await q(
    `INSERT INTO users (name, email, phone) VALUES ('Demo Owner', $1, '+27820000001') RETURNING id`,
    [email],
  );
  const userId = user.id;

  await q(
    `INSERT INTO memberships (vendor_id, user_id, role, scope) VALUES ($1, $2, 'vendor_owner', '{}')`,
    [vendorId, userId],
  );

  const [property] = await q(
    `INSERT INTO properties (vendor_id, name, type) VALUES ($1, 'Demo Court', 'building') RETURNING id`,
    [vendorId],
  );
  const [unit] = await q(
    `INSERT INTO units (vendor_id, property_id, label, status, market_rent, bedrooms, bathrooms)
     VALUES ($1, $2, 'Unit 101', 'vacant', 8000, 2, 1) RETURNING id`,
    [vendorId, property.id],
  );

  console.log('\nSeed complete:');
  console.table({ vendorId, userId, loginEmail: email, propertyId: property.id, unitId: unit.id });
  console.log('\nLog in by requesting an OTP for', email, '(code prints to the server console).');

  await dataSource.destroy();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
