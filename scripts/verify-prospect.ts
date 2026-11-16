import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import dataSource from '../src/common/database/data-source';

/**
 * Pre-demo check of a seeded prospect world. READ-ONLY: every statement is a
 * SELECT, so it is safe against the database you are about to present from.
 *
 *   npm run verify:prospect -- midnight-masquerade
 *
 * Exits non-zero if any check fails. Run it after seeding and again on the
 * morning of the demo — the seeder proves the world was built correctly; this
 * proves it is STILL correct on the machine in front of the prospect.
 *
 * Every check here is something that was actually wrong once, or something the
 * demo script says out loud ("statements reconcile because the postings
 * balance"). Expectations come from the profile, not from literals, so a second
 * prospect's profile is checked by the same file.
 */
async function main() {
  const slug = process.argv[2];
  if (!slug) { console.error('usage: npm run verify:prospect -- <slug>'); process.exit(2); }
  const file = path.join(__dirname, '..', 'demo', 'profiles', `${slug}.json`);
  if (!fs.existsSync(file)) { console.error(`no profile at ${file}`); process.exit(2); }
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));

  await dataSource.initialize();
  const vendor = (await dataSource.query(`SELECT id FROM vendors WHERE slug=$1`, [slug]))[0];
  if (!vendor) { console.error(`no vendor with slug ${slug} — seed it first`); await dataSource.destroy(); process.exit(2); }
  const V: string = vendor.id;
  const ok = async (sql: string, params: unknown[] = []): Promise<boolean> =>
    (await dataSource.query(sql, [V, ...params]))[0]?.ok === true;

  /** Balance of one account by STD_ACCOUNTS code, on its natural side. */
  const bal = (code: string, side: 'dr' | 'cr') =>
    `(SELECT COALESCE(sum(${side === 'dr' ? 'debit-credit' : 'credit-debit'}),0)::numeric(14,2)
        FROM ledger_entries le JOIN accounts a ON a.id=le.account_id
       WHERE le.vendor_id=$1 AND a.code='${code}')`;

  const targetUnits: number = p.portfolio.targetUnits;
  const targetOccupied = Math.round(targetUnits * p.portfolio.occupancyRate);
  const toRands = (cents: number) => Math.round(cents / 100);

  const checks: [string, () => Promise<boolean>][] = [
    ['every ledger transaction balances', () => ok(
      `SELECT count(*)=0 ok FROM (SELECT 1 FROM ledger_entries WHERE vendor_id=$1
        GROUP BY transaction_id HAVING abs(sum(debit)-sum(credit))>0.005) x`)],
    ['receivables in the ledger = invoices still owing', () => ok(
      `SELECT ${bal('1000', 'dr')} = (SELECT COALESCE(sum(total),0)::numeric(14,2) FROM invoices WHERE vendor_id=$1 AND status<>'paid') ok`)],
    ['trust bank = deposit liability = deposits held', () => ok(
      `SELECT ${bal('1200', 'dr')} = ${bal('2200', 'cr')}
          AND ${bal('2200', 'cr')} = (SELECT COALESCE(sum(amount),0)::numeric(14,2) FROM deposits WHERE vendor_id=$1) ok`)],
    ['owner payable = statements finalized and not yet paid out', () => ok(
      `SELECT ${bal('2300', 'cr')} = (SELECT COALESCE(sum(net_payout),0)::numeric(14,2) FROM owner_statements WHERE vendor_id=$1 AND status='finalized') ok`)],
    ['every paid-out statement has exactly one payout, for its net', () => ok(
      `SELECT count(*)=0 ok FROM owner_statements s WHERE s.vendor_id=$1 AND s.status='paid_out'
          AND (SELECT count(*) FROM payouts po WHERE po.statement_id=s.id AND po.amount=s.net_payout)<>1`)],
    ['every building has an owner', () => ok(
      `SELECT count(*)=0 ok FROM properties WHERE vendor_id=$1 AND owner_id IS NULL AND deleted_at IS NULL`)],
    ['one deposit per active lease', () => ok(
      `SELECT (SELECT count(*) FROM deposits WHERE vendor_id=$1)=(SELECT count(*) FROM leases WHERE vendor_id=$1 AND status='active') ok`)],
    [`${targetUnits} units, ${targetOccupied} occupied`, () => ok(
      `SELECT (SELECT count(*) FROM units WHERE vendor_id=$1)=$2::int
          AND (SELECT count(*) FROM units WHERE vendor_id=$1 AND status='occupied')=$3::int ok`, [targetUnits, targetOccupied])],
    ['no building is more than twice the portfolio vacancy rate empty', () => ok(
      `SELECT COALESCE(max(v),0) <= $2::float ok FROM (
         SELECT (count(*) FILTER (WHERE status<>'occupied'))::float/count(*) v FROM units WHERE vendor_id=$1 GROUP BY property_id) x`,
      [Math.max(0.1, (1 - p.portfolio.occupancyRate) * 2)])],
    ['no two people share a name', () => ok(
      `SELECT count(*)=0 ok FROM (SELECT 1 FROM users u JOIN memberships m ON m.user_id=u.id
        WHERE m.vendor_id=$1 GROUP BY u.name HAVING count(*)>1) x`)],
    ['everyone is on one email domain', () => ok(
      `SELECT count(DISTINCT split_part(u.email,'@',2))=1 ok FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.vendor_id=$1`)],
    ['each unit agrees with its own active lease on rent', () => ok(
      `SELECT count(*)=0 ok FROM leases l JOIN units u ON u.id=l.unit_id
        WHERE l.vendor_id=$1 AND l.status='active' AND l.rent_amount<>u.market_rent`)],
    ['no invoice predates its lease', () => ok(
      `SELECT count(*)=0 ok FROM invoices i JOIN leases l ON l.id=i.lease_id WHERE i.vendor_id=$1 AND i.due_date<l.start_date`)],
    ['owner banking is encrypted at rest', () => ok(
      `SELECT COALESCE(bool_and(banking ? '__enc'),false) ok FROM owners WHERE vendor_id=$1 AND deleted_at IS NULL`)],
  ];

  // The story records the script opens on screen.
  for (const a of p.story?.arrears ?? []) {
    checks.push([`${a.unit} (${a.tenant}) is overdue and owes exactly R${toRands(a.amountCents)}`, () => ok(
      `SELECT COALESCE(sum(i.total),0)=$3::numeric AND count(*)>0 ok
         FROM invoices i JOIN leases l ON l.id=i.lease_id JOIN units u ON u.id=l.unit_id
        WHERE i.vendor_id=$1 AND u.label=$2 AND i.status='overdue'`, [a.unit, toRands(a.amountCents)])]);
  }
  for (const m of p.story?.maintenance ?? []) {
    checks.push([`maintenance job exists: ${m.title}`, () => ok(
      `SELECT count(*)=1 ok FROM tickets WHERE vendor_id=$1 AND description=$2`, [m.title])]);
  }
  if (p.story?.leaseExpiringSoon) {
    const e = p.story.leaseExpiringSoon;
    checks.push([`${e.unit} lease expires within ${e.expiresInDays} days and has not lapsed`, () => ok(
      `SELECT count(*)=1 ok FROM leases l JOIN units u ON u.id=l.unit_id
        WHERE l.vendor_id=$1 AND u.label=$2 AND l.status='active'
          AND l.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $3::int`, [e.unit, e.expiresInDays])]);
  }
  if (p.story?.newLeaseAwaitingSignature) {
    const n = p.story.newLeaseAwaitingSignature;
    checks.push([`${n.unit} is reserved with a lease out for signature`, () => ok(
      `SELECT (SELECT status FROM units WHERE vendor_id=$1 AND label=$2)='reserved'
          AND (SELECT count(*) FROM lease_agreements WHERE vendor_id=$1 AND ref=$3 AND status='sent')=1 ok`,
      [n.unit, `${slug}-awaiting-signature`])]);
  }
  for (const who of [p.people.landlordDemoAccount, p.people.tenantDemoAccount, ...p.people.staff]) {
    checks.push([`login exists: ${who.email}`, () => ok(
      `SELECT count(*)=1 ok FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.vendor_id=$1 AND u.email=$2`, [who.email])]);
  }

  let failed = 0;
  console.log(`\n${p.agency.name} — pre-demo check (read-only)\n`);
  for (const [label, run] of checks) {
    let pass = false;
    try { pass = await run(); } catch (e: any) { console.log(`  FAIL  ${label}\n        ${e?.message ?? e}`); failed++; continue; }
    if (!pass) failed++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${label}`);
  }
  console.log(`\n${checks.length - failed}/${checks.length} checks pass${failed ? ' — do not present until the failures are understood' : ''}\n`);
  if (p.agency.managementFeeConfirmed !== true) {
    console.log(`  note: the ${(Number(p.agency.managementFeePct ?? 0.08) * 100).toFixed(2)}% management fee is still a placeholder the client has not confirmed.\n`);
  }
  await dataSource.destroy();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  try { await dataSource.destroy(); } catch { /* already down */ }
  process.exit(2);
});
