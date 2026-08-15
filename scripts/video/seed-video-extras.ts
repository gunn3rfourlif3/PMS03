import 'reflect-metadata';
import dataSource from '../../src/common/database/data-source';

/**
 * Extra demo data the marketing video needs, on top of `npm run seed`.
 *
 * The base seed is built for exercising the back-office. Several screens the
 * video films are thin or empty without more: the proof-of-payment queue has
 * nothing in it, the tenant's Documents tab has no signed lease, and its
 * Maintenance tab has a single ticket. Empty states make a product look
 * unfinished on camera even when it isn't.
 *
 * Everything here is idempotent — safe to re-run before every take.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/video/seed-video-extras.ts
 */
async function main() {
  await dataSource.initialize();
  const q = (sql: string, params: unknown[] = []) => dataSource.query(sql, params);
  const one = async (sql: string, params: unknown[] = []) => (await q(sql, params))[0];
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

  const vendor = await one(`SELECT id FROM vendors WHERE slug='demo' OR name='Demo Agency' LIMIT 1`);
  if (!vendor) throw new Error('Demo Agency not found — run `npm run seed` first.');
  const V = vendor.id;

  const thabo = await one(`SELECT id, name FROM users WHERE email='thabo@demo.test'`);
  const staff = await one(`SELECT id, name FROM users WHERE email='owner@demo.test'`);
  if (!thabo) throw new Error('thabo@demo.test not found — reseed.');

  const counts = { proofs: 0, agreements: 0, tickets: 0, messages: 0, statements: 0 };

  // ── 1. Pending proofs of payment ──────────────────────────────────────────
  // /payments IS the proof-of-payment review queue, and the base seed leaves it
  // empty. The video's central beat clicks Accept here, which posts the payment
  // to the ledger — so there must be something to accept.
  const unpaid = await q(
    `SELECT i.id, i.tenant_id, i.total, i.period, u.name AS tenant
       FROM invoices i JOIN users u ON u.id = i.tenant_id
      WHERE i.vendor_id = $1 AND i.status IN ('issued','overdue','partly_paid')
      ORDER BY i.due_date DESC LIMIT 3`, [V]);

  for (const inv of unpaid) {
    const ref = `EFT-${String(inv.period).replace('-', '')}-${inv.id.slice(0, 4).toUpperCase()}`;
    const exists = await one(
      `SELECT id FROM proof_of_payments WHERE vendor_id=$1 AND invoice_id=$2 AND status='pending'`, [V, inv.id]);
    if (exists) continue;
    await q(
      `INSERT INTO proof_of_payments
         (vendor_id, invoice_id, tenant_id, file_url, amount, paid_at, reference, note, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')`,
      [V, inv.id, inv.tenant_id, '/media/demo/proof-of-payment.jpg', inv.total,
       iso(new Date()), ref, 'Paid via EFT this morning']);
    counts.proofs++;
  }

  // ── 2. A signed lease agreement for the tenant ────────────────────────────
  // Without this the tenant app's Documents and Pay tabs show empty states.
  const lease = await one(
    `SELECT l.id, l.tenant_id, u.label AS unit
       FROM leases l JOIN units u ON u.id = l.unit_id
      WHERE l.vendor_id=$1 AND l.tenant_id=$2 LIMIT 1`, [V, thabo.id]);

  if (lease) {
    const ref = `LA-DEMO-${lease.id.slice(0, 6).toUpperCase()}`;
    const exists = await one(`SELECT id FROM lease_agreements WHERE ref=$1`, [ref]);
    if (!exists) {
      await q(
        `INSERT INTO lease_agreements
           (vendor_id, lease_id, tenant_id, ref, file_url, render_data, status, signer_name, signer_ip, signed_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,'signed',$7,'196.0.0.1',$8)`,
        [V, lease.id, thabo.id, ref, '/media/demo/lease-agreement.pdf',
         JSON.stringify({ unit: lease.unit, tenant: thabo.name }), thabo.name, daysAgo(21)]);
      counts.agreements++;
    }
  }

  // ── 3. Maintenance history for the tenant ─────────────────────────────────
  // One ticket looks like a stub; a short history looks like a system in use.
  const unit = await one(
    `SELECT u.id FROM leases l JOIN units u ON u.id=l.unit_id
      WHERE l.vendor_id=$1 AND l.tenant_id=$2 LIMIT 1`, [V, thabo.id]);

  if (unit) {
    const extra: Array<[string, string, string, string, number]> = [
      ['plumbing',  'high',   'Kitchen tap dripping constantly',        'assigned', 3],
      ['electrical','normal', 'Bedroom plug point not working',         'open',     1],
      ['general',   'low',    'Front gate remote needs a new battery',  'closed',   26],
    ];
    for (const [category, priority, description, status, ago] of extra) {
      const exists = await one(
        `SELECT id FROM tickets WHERE vendor_id=$1 AND description=$2`, [V, description]);
      if (exists) continue;
      await q(
        `INSERT INTO tickets (vendor_id, unit_id, reporter_id, category, priority, description, media, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,'[]'::jsonb,$7,$8)`,
        [V, unit.id, thabo.id, category, priority, description, status, daysAgo(ago)]);
      counts.tickets++;
    }
  }

  // ── 4. A live conversation with unread replies ────────────────────────────
  // HomeScreen shows an unread badge from messageUnread; an empty inbox hides a
  // feature that's actually there. tenant_last_read_at stays behind the last
  // message so the badge renders.
  const convo = await one(
    `SELECT id FROM conversations WHERE vendor_id=$1 AND tenant_user_id=$2 ORDER BY created_at LIMIT 1`,
    [V, thabo.id]);

  if (convo && staff) {
    const thread: Array<[string, string, number]> = [
      ['tenant', 'Morning — the geyser is still leaking into the ceiling.', 4],
      ['staff',  'Thanks Thabo. I have logged it as urgent and called the plumber.', 4],
      ['staff',  'FixIt Plumbing will be there tomorrow between 09:00 and 11:00.', 1],
    ];
    for (const [role, body, ago] of thread) {
      const exists = await one(`SELECT id FROM messages WHERE conversation_id=$1 AND body=$2`, [convo.id, body]);
      if (exists) continue;
      await q(
        `INSERT INTO messages (vendor_id, conversation_id, sender_user_id, sender_role, body, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [V, convo.id, role === 'tenant' ? thabo.id : staff.id, role, body, daysAgo(ago)]);
      counts.messages++;
    }
    await q(
      `UPDATE conversations
          SET last_message_at=$2, last_message_preview=$3, tenant_last_read_at=$4, status='open'
        WHERE id=$1`,
      [convo.id, daysAgo(1), 'FixIt Plumbing will be there tomorrow…', daysAgo(3)]);
  }

  // ── 5. Owner statement history ────────────────────────────────────────────
  // A single month reads as a demo; several months read as a track record, and
  // the owner portal's history list has something to show.
  const owner = await one(`SELECT id, management_fee_pct FROM owners WHERE vendor_id=$1 ORDER BY name LIMIT 1`, [V]);
  if (owner) {
    const now = new Date();
    for (let back = 2; back <= 4; back++) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const exists = await one(
        `SELECT id FROM owner_statements WHERE vendor_id=$1 AND owner_id=$2 AND period=$3`, [V, owner.id, period]);
      if (exists) continue;
      const gross = 13800 + back * 250;                        // small month-on-month drift
      const fee = Math.round(gross * Number(owner.management_fee_pct ?? 0.08));
      const expenses = back === 3 ? 1450 : 0;                  // one month with a repair
      const net = gross - fee - expenses;
      const st = await one(
        `INSERT INTO owner_statements (vendor_id,owner_id,period,gross_collected,management_fee,expenses,net_payout,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'paid_out') RETURNING id`,
        [V, owner.id, period, gross, fee, expenses, net]);
      await q(
        `INSERT INTO payouts (vendor_id,owner_id,statement_id,amount,gateway_ref,status)
         VALUES ($1,$2,$3,$4,$5,'paid') ON CONFLICT (gateway_ref) DO NOTHING`,
        [V, owner.id, st.id, net, `seed-video-payout-${period}`]);
      counts.statements++;
    }
  }

  console.log('\nVideo demo data:');
  console.log(`  pending proofs of payment   ${counts.proofs}`);
  console.log(`  signed lease agreements     ${counts.agreements}`);
  console.log(`  maintenance tickets         ${counts.tickets}`);
  console.log(`  messages in thread          ${counts.messages}`);
  console.log(`  owner statements + payouts  ${counts.statements}`);
  console.log(Object.values(counts).some(Boolean) ? '' : '  (all present already — nothing to do)');

  await dataSource.destroy();
}

main().catch((e) => { console.error('\nFAILED:', e.message, '\n'); process.exit(1); });
