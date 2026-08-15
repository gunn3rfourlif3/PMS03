import 'reflect-metadata';
import dataSource from '../src/common/database/data-source';
import { encryptJson } from '../src/common/security/pii-crypto';

/**
 * Comprehensive demo seed — exercises every UI scenario.
 *
 * Runs as the DB owner/superuser (local `pms`), which bypasses RLS so we can
 * insert across the vendor. Idempotent: safe to re-run (natural-key guards +
 * ON CONFLICT). Dates are computed relative to "today" so the paid / not-yet-due
 * / overdue / partly-paid mix stays realistic whenever you run it.
 *
 * Vendor: Demo Agency (slug `demo`). Logins (passwordless OTP, code prints to
 * the API console):
 *   owner@demo.test    — agency owner (web console + landlord app)
 *   thabo@demo.test    — tenant (tenant app): a due invoice + a resolved ticket to approve
 *   lerato@/naledi@/johan@/kagiso@demo.test — more tenants
 */
async function main() {
  await dataSource.initialize();
  const q = (sql: string, params: unknown[] = []) => dataSource.query(sql, params);

  // ---- date helpers (relative to now) ----
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ym = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const addMonths = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const cur = ym(now), prev = ym(addMonths(now, -1)), prev2 = ym(addMonths(now, -2));
  const duePrev = `${prev}-07`;
  const dueFuture = iso(addDays(now, 20));   // not yet due
  const dueSoon = iso(now);                  // due today -> 0-30 bucket
  const duePast30 = iso(addDays(now, -30));  // overdue ~0-30/31-60
  const duePast60 = iso(addDays(now, -60));  // overdue ~61-90
  const startDate = iso(addMonths(now, -3));
  const li = (rent: number) => [{ desc: 'Rent', amount: rent }, { desc: 'VAT 15%', amount: Math.round(rent * 0.15) }];
  const total = (rent: number) => Math.round(rent * 1.15);

  // ---- idempotent upsert helpers ----
  const first = async (sql: string, p: unknown[] = []) => (await q(sql, p))[0];
  async function user(name: string, email: string, phone: string): Promise<string> {
    await q(`INSERT INTO users (name,email,phone) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING`, [name, email, phone]);
    return (await first(`SELECT id FROM users WHERE email=$1`, [email])).id;
  }
  async function membership(vendor: string, u: string, role: string) {
    await q(`INSERT INTO memberships (vendor_id,user_id,role,scope) VALUES ($1,$2,$3,'{}') ON CONFLICT (vendor_id,user_id) DO NOTHING`, [vendor, u, role]);
  }
  async function owner(vendor: string, name: string, feePct: number): Promise<string> {
    let r = await first(`SELECT id FROM owners WHERE vendor_id=$1 AND name=$2`, [vendor, name]);
    if (!r) r = await first(`INSERT INTO owners (vendor_id,name,management_fee_pct,payout_subaccount) VALUES ($1,$2,$3,$4) RETURNING id`,
      [vendor, name, feePct, 'ACC-' + name.replace(/\W/g, '').slice(0, 6).toUpperCase()]);
    return r.id;
  }
  async function property(vendor: string, name: string, ownerId: string | null): Promise<string> {
    let r = await first(`SELECT id FROM properties WHERE vendor_id=$1 AND name=$2`, [vendor, name]);
    if (!r) r = await first(`INSERT INTO properties (vendor_id,name,type,owner_id) VALUES ($1,$2,'building',$3) RETURNING id`, [vendor, name, ownerId]);
    return r.id;
  }
  async function unit(vendor: string, prop: string, label: string, status: string, rent: number): Promise<string> {
    let r = await first(`SELECT id FROM units WHERE vendor_id=$1 AND label=$2`, [vendor, label]);
    if (!r) r = await first(`INSERT INTO units (vendor_id,property_id,label,status,market_rent,bedrooms,bathrooms) VALUES ($1,$2,$3,$4,$5,2,1) RETURNING id`, [vendor, prop, label, status, rent]);
    else await q(`UPDATE units SET status=$2, property_id=$3 WHERE id=$1`, [r.id, status, prop]);
    return r.id;
  }
  async function lease(vendor: string, unitId: string, tenantId: string, rent: number): Promise<string> {
    let r = await first(`SELECT id FROM leases WHERE vendor_id=$1 AND unit_id=$2 AND tenant_id=$3`, [vendor, unitId, tenantId]);
    if (!r) r = await first(`INSERT INTO leases (vendor_id,unit_id,tenant_id,type,status,start_date,rent_amount,billing_cycle) VALUES ($1,$2,$3,'fixed','active',$4,$5,'monthly') RETURNING id`, [vendor, unitId, tenantId, startDate, rent]);
    return r.id;
  }
  async function invoice(vendor: string, leaseId: string, tenantId: string, period: string, due: string, status: string, tot: number, rent: number): Promise<string> {
    await q(`INSERT INTO invoices (vendor_id,lease_id,tenant_id,period,due_date,status,total,line_items,late_fee_applied)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) ON CONFLICT (vendor_id,lease_id,period) DO NOTHING`,
      [vendor, leaseId, tenantId, period, due, status, tot, JSON.stringify(li(rent)), status === 'overdue']);
    return (await first(`SELECT id FROM invoices WHERE vendor_id=$1 AND lease_id=$2 AND period=$3`, [vendor, leaseId, period])).id;
  }
  async function payment(ref: string, vendor: string, tenantId: string, amount: number, invoiceId: string) {
    await q(`INSERT INTO payments (vendor_id,tenant_id,amount,method,gateway_ref,status,received_at,allocation)
             VALUES ($1,$2,$3,'eft',$4,'succeeded',$5,$6::jsonb) ON CONFLICT (gateway_ref) DO NOTHING`,
      [vendor, tenantId, amount, ref, now.toISOString(), JSON.stringify([{ invoiceId, amount }])]);
  }
  async function conversation(vendor: string, tenantId: string, subject: string, msgs: { role: 'tenant' | 'staff'; body: string; sender: string }[], status = 'open'): Promise<void> {
    const existing = await first(`SELECT id FROM conversations WHERE vendor_id=$1 AND tenant_user_id=$2 AND subject=$3`, [vendor, tenantId, subject]);
    if (existing) return;
    const last = msgs[msgs.length - 1];
    const preview = last.body.length > 120 ? last.body.slice(0, 117) + '…' : last.body;
    const staffRead = status === 'closed' || last.role === 'staff' ? now.toISOString() : null;
    const tenantRead = last.role === 'tenant' ? now.toISOString() : null;
    const conv = await first(`INSERT INTO conversations (vendor_id,subject,tenant_user_id,status,last_message_at,last_message_preview,staff_last_read_at,tenant_last_read_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [vendor, subject, tenantId, status, now.toISOString(), preview, staffRead, tenantRead]);
    let i = 0;
    for (const m of msgs) {
      const ts = new Date(now.getTime() - (msgs.length - i) * 3600 * 1000).toISOString();
      await q(`INSERT INTO messages (vendor_id,conversation_id,sender_user_id,sender_role,body,created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
        [vendor, conv.id, m.sender, m.role, m.body, ts]);
      i++;
    }
  }
  async function statement(vendor: string, ownerId: string, period: string, gross: number, fee: number, exp: number, net: number, status: string): Promise<string> {
    await q(`INSERT INTO owner_statements (vendor_id,owner_id,period,gross_collected,management_fee,expenses,net_payout,status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (vendor_id,owner_id,period) DO NOTHING`, [vendor, ownerId, period, gross, fee, exp, net, status]);
    return (await first(`SELECT id FROM owner_statements WHERE vendor_id=$1 AND owner_id=$2 AND period=$3`, [vendor, ownerId, period])).id;
  }
  async function payout(ref: string, vendor: string, ownerId: string, statementId: string, amount: number) {
    await q(`INSERT INTO payouts (vendor_id,owner_id,statement_id,amount,gateway_ref,status) VALUES ($1,$2,$3,$4,$5,'paid') ON CONFLICT (gateway_ref) DO NOTHING`, [vendor, ownerId, statementId, amount, ref]);
  }
  async function listing(vendor: string, unitId: string, rent: number, status: string): Promise<string> {
    // `uq_open_listing_per_unit` is a PARTIAL index on (unit_id) alone — not
    // (vendor_id, unit_id) — covering statuses draft/published/paused where
    // deleted_at IS NULL. Looking up by vendor as well could miss a row that
    // still blocks the insert, so match the constraint's own scope exactly or a
    // re-seed dies on a duplicate key.
    let r = await first(
      `SELECT id FROM listings
        WHERE unit_id=$1 AND deleted_at IS NULL
          AND status IN ('draft','published','paused')
        LIMIT 1`,
      [unitId],
    );
    if (!r) r = await first(`INSERT INTO listings (vendor_id,unit_id,advertised_rent,available_from,status,description) VALUES ($1,$2,$3,$4,$5,'Bright, secure unit close to amenities.') RETURNING id`, [vendor, unitId, rent, dueFuture, status]);
    else await q(`UPDATE listings SET status=$2, advertised_rent=$3 WHERE id=$1`, [r.id, status, rent]);
    return r.id;
  }
  async function application(vendor: string, listingId: string, name: string, email: string, phone: string, status: string, screening: unknown | null) {
    const ex = await first(`SELECT id FROM applications WHERE vendor_id=$1 AND listing_id=$2 AND applicant_email=$3`, [vendor, listingId, email]);
    if (ex) return;
    await q(`INSERT INTO applications (vendor_id,listing_id,applicant_name,applicant_email,applicant_phone,status,screening_result) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [vendor, listingId, name, email, phone, status, screening ? JSON.stringify(screening) : null]);
  }
  async function ticket(vendor: string, unitId: string, reporter: string, category: string, priority: string, desc: string, status: string): Promise<string> {
    let r = await first(`SELECT id FROM tickets WHERE vendor_id=$1 AND description=$2`, [vendor, desc]);
    if (!r) r = await first(`INSERT INTO tickets (vendor_id,unit_id,reporter_id,category,priority,description,status,media) VALUES ($1,$2,$3,$4,$5,$6,$7,'[]') RETURNING id`, [vendor, unitId, reporter, category, priority, desc, status]);
    else await q(`UPDATE tickets SET status=$2 WHERE id=$1`, [r.id, status]);
    return r.id;
  }
  async function expense(vendor: string, unitId: string, ownerId: string | null, category: string, amount: number, billable: boolean): Promise<string> {
    let r = await first(`SELECT id FROM expenses WHERE vendor_id=$1 AND unit_id=$2 AND category=$3 AND amount=$4`, [vendor, unitId, category, amount]);
    if (!r) r = await first(`INSERT INTO expenses (vendor_id,unit_id,owner_id,category,amount,owner_billable,incurred_on,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'recorded') RETURNING id`, [vendor, unitId, ownerId, category, amount, billable, iso(now)]);
    return r.id;
  }
  async function workOrder(vendor: string, ticketId: string, status: string, cost: number | null, expenseId: string | null) {
    const ex = await first(`SELECT id FROM work_orders WHERE vendor_id=$1 AND ticket_id=$2`, [vendor, ticketId]);
    if (ex) return;
    await q(`INSERT INTO work_orders (vendor_id,ticket_id,status,cost,expense_id) VALUES ($1,$2,$3,$4,$5)`, [vendor, ticketId, status, cost, expenseId]);
  }
  async function notification(vendor: string, userId: string, channel: string, template: string, destination: string, status: string) {
    const ex = await first(`SELECT id FROM notifications WHERE vendor_id=$1 AND user_id=$2 AND template=$3 AND channel=$4`, [vendor, userId, template, channel]);
    if (ex) return;
    await q(`INSERT INTO notifications (vendor_id,user_id,channel,template,destination,payload,status,sent_at)
             VALUES ($1,$2,$3,$4,$5,'{}'::jsonb,$6,$7)`,
      [vendor, userId, channel, template, destination, status, status === 'queued' ? null : now.toISOString()]);
  }
  async function provider(vendor: string, name: string, category: string, contactName: string, phone: string, email: string) {
    const ex = await first(`SELECT id FROM service_providers WHERE vendor_id=$1 AND name=$2`, [vendor, name]);
    if (ex) return;
    await q(`INSERT INTO service_providers (vendor_id,name,category,contact_name,phone,email,status) VALUES ($1,$2,$3,$4,$5,$6,'active')`,
      [vendor, name, category, contactName, phone, email]);
  }
  async function deposit(vendor: string, leaseId: string, amount: number) {
    const ex = await first(`SELECT id FROM deposits WHERE vendor_id=$1 AND lease_id=$2`, [vendor, leaseId]);
    if (ex) return;
    await q(`INSERT INTO deposits (vendor_id,lease_id,amount,held_in,status) VALUES ($1,$2,$3,'Trust Bank','held')`, [vendor, leaseId, amount]);
  }

  // ================= build the world =================
  let vendor = await first(`SELECT id FROM vendors WHERE slug='demo' OR name='Demo Agency' LIMIT 1`);
  if (!vendor) vendor = await first(`INSERT INTO vendors (name,slug,type,default_currency,has_valid_ffc,has_trust_account) VALUES ('Demo Agency','demo','agency','ZAR',true,true) RETURNING id`);
  const V = vendor.id;

  const ownerUser = await user('Demo Owner', 'owner@demo.test', '+27820000001');
  await membership(V, ownerUser, 'vendor_owner');

  // property owners (for statements)
  const sipho = await owner(V, 'Sipho Dlamini', 0.08);
  const acme = await owner(V, 'Acme Holdings', 0.10);

  // owner-portal login (property investor signs in to see their statements)
  const siphoUser = await user('Sipho Dlamini', 'sipho@owner.demo.test', '+27820000020');
  await membership(V, siphoUser, 'owner');
  await q(`UPDATE owners SET user_id = $2 WHERE id = $1`, [sipho, siphoUser]);

  // properties + units
  const demoCourt = await property(V, 'Demo Court', null);
  const sandton = await property(V, 'Sandton Heights', sipho);
  const rivonia = await property(V, 'Rivonia Mews', acme);

  const u101 = await unit(V, demoCourt, 'Unit 101', 'occupied', 8000);
  const u102 = await unit(V, demoCourt, 'Unit 102', 'occupied', 8500);
  const a101 = await unit(V, sandton, 'A-101', 'occupied', 12000);
  const a102 = await unit(V, sandton, 'A-102', 'occupied', 9500);
  const a103 = await unit(V, sandton, 'A-103', 'vacant', 11000);
  const b201 = await unit(V, rivonia, 'B-201', 'occupied', 15000);
  const b202 = await unit(V, rivonia, 'B-202', 'vacant', 13000);

  // tenants
  const thabo = await user('Thabo M', 'thabo@demo.test', '+27820000010'); await membership(V, thabo, 'tenant');
  const kagiso = await user('Kagiso P', 'kagiso@demo.test', '+27820000011'); await membership(V, kagiso, 'tenant');
  const lerato = await user('Lerato N', 'lerato@demo.test', '+27820000012'); await membership(V, lerato, 'tenant');
  const naledi = await user('Naledi K', 'naledi@demo.test', '+27820000013'); await membership(V, naledi, 'tenant');
  const johan = await user('Johan V', 'johan@demo.test', '+27820000014'); await membership(V, johan, 'tenant');

  // leases
  const lThabo = await lease(V, u101, thabo, 8000);
  const lKagiso = await lease(V, u102, kagiso, 8500);
  const lLerato = await lease(V, a101, lerato, 12000);
  const lNaledi = await lease(V, a102, naledi, 9500);
  const lJohan = await lease(V, b201, johan, 15000);

  // invoices + payments — the full status mix
  const iThaboPrev = await invoice(V, lThabo, thabo, prev, duePrev, 'paid', total(8000), 8000);
  await payment(`seed-thabo-${prev}`, V, thabo, total(8000), iThaboPrev);
  await invoice(V, lThabo, thabo, cur, dueFuture, 'issued', total(8000), 8000);           // tenant: due, not overdue

  const iKagisoCur = await invoice(V, lKagiso, kagiso, cur, dueSoon, 'paid', total(8500), 8500);
  await payment(`seed-kagiso-${cur}`, V, kagiso, total(8500), iKagisoCur);                 // paid this month

  const iLeratoPrev = await invoice(V, lLerato, lerato, prev, duePrev, 'paid', total(12000), 12000);
  await payment(`seed-lerato-${prev}`, V, lerato, total(12000), iLeratoPrev);
  await invoice(V, lLerato, lerato, cur, dueFuture, 'issued', total(12000), 12000);         // not yet due

  await invoice(V, lNaledi, naledi, prev2, duePast60, 'overdue', total(9500), 9500);        // arrears 61-90
  await invoice(V, lNaledi, naledi, prev, duePast30, 'overdue', total(9500), 9500);         // arrears 0-30/31-60

  const iJohanCur = await invoice(V, lJohan, johan, cur, dueSoon, 'partly_paid', total(15000), 15000);
  await payment(`seed-johan-${cur}`, V, johan, 10000, iJohanCur);                           // partial collection

  // deposits (trust)
  await deposit(V, lJohan, 15000);
  await deposit(V, lLerato, 12000);

  // owner statements + payout
  const stSipho = await statement(V, sipho, prev, 13800, 1104, 0, 12696, 'paid_out');
  await payout(`seed-payout-sipho-${prev}`, V, sipho, stSipho, 12696);
  await statement(V, sipho, cur, 13800, 1104, 0, 12696, 'finalized');       // owner portal: awaiting payout
  await statement(V, acme, cur, 10000, 1000, 0, 9000, 'finalized');                         // ready to pay

  // listings + applicant funnel (submitted / screening / approved / rejected)
  const listA = await listing(V, a103, 11000, 'published');
  const listB = await listing(V, b202, 13000, 'published');
  await application(V, listA, 'Bongani S', 'bongani@example.com', '+27830000001', 'submitted', null);
  await application(V, listA, 'Zanele P', 'zanele@example.com', '+27830000002', 'screening', { recommendation: 'approve', incomeToRentRatio: 3.4, creditScore: 712 });
  await application(V, listA, 'Themba R', 'themba@example.com', '+27830000003', 'rejected', { recommendation: 'decline', incomeToRentRatio: 1.8, creditScore: 540 });
  await application(V, listB, 'Fikile M', 'fikile@example.com', '+27830000004', 'approved', { recommendation: 'approve', incomeToRentRatio: 4.1, creditScore: 760 });

  // maintenance: open / assigned / resolved / closed + work orders + expenses
  const tFridge = await ticket(V, u101, thabo, 'appliance', 'medium', 'Fridge not cooling', 'resolved');
  const eFridge = await expense(V, u101, null, 'maintenance', 750, false);
  await workOrder(V, tFridge, 'completed', 750, eFridge);                                    // tenant can approve
  await ticket(V, u101, thabo, 'plumbing', 'high', 'Geyser leaking in the ceiling', 'open');

  await ticket(V, a102, naledi, 'plumbing', 'high', 'Leaking kitchen tap', 'open');
  const tPower = await ticket(V, b201, johan, 'electrical', 'urgent', 'Power trips every night', 'assigned');
  await workOrder(V, tPower, 'assigned', null, null);
  const tHinge = await ticket(V, a101, lerato, 'general', 'low', 'Broken cupboard hinge', 'closed');
  const eHinge = await expense(V, a101, sipho, 'maintenance', 1200, true);
  await workOrder(V, tHinge, 'completed', 1200, eHinge);

  // notification delivery log (activity feed)
  await notification(V, thabo, 'email', 'rent_invoice_issued', 'thabo@demo.test', 'delivered');
  await notification(V, thabo, 'push', 'payment_received', 'thabo@demo.test', 'delivered');
  await notification(V, lerato, 'email', 'rent_invoice_issued', 'lerato@demo.test', 'delivered');
  await notification(V, naledi, 'sms', 'rent_overdue', '+27820000013', 'sent');
  await notification(V, johan, 'email', 'rent_invoice_issued', 'johan@demo.test', 'delivered');

  // owner banking (payout details)
  await q(`UPDATE owners SET banking = $2::jsonb WHERE id = $1`, [sipho, JSON.stringify(encryptJson({ bankName: 'FNB', accountHolder: 'Sipho Dlamini', accountNumber: '62012345678', branchCode: '250655', accountType: 'Cheque' }))]);
  await q(`UPDATE owners SET banking = $2::jsonb WHERE id = $1`, [acme, JSON.stringify(encryptJson({ bankName: 'Standard Bank', accountHolder: 'Acme Holdings (Pty) Ltd', accountNumber: '001234567', branchCode: '051001', accountType: 'Business' }))]);

  // conversations / in-app messaging
  await conversation(V, thabo, 'Geyser leaking in the ceiling', [
    { role: 'tenant', sender: thabo, body: 'Hi, the geyser is leaking into the ceiling of the bathroom. Water is coming through the light fitting.' },
    { role: 'staff', sender: ownerUser, body: 'Thanks Thabo — that sounds urgent. I have logged a maintenance ticket and a plumber will be in touch today. Please switch off the geyser at the DB board in the meantime.' },
    { role: 'tenant', sender: thabo, body: 'Done, switched it off. Thank you!' },
  ]);
  await conversation(V, kagiso, 'Parking bay allocation', [
    { role: 'tenant', sender: kagiso, body: 'Could I please get a second parking bay? We now have two cars.' },
    { role: 'staff', sender: ownerUser, body: 'Let me check availability with the body corporate and revert. There may be a small monthly charge.' },
  ]);
  await conversation(V, lerato, 'Lease renewal query', [
    { role: 'tenant', sender: lerato, body: 'My lease is up for renewal soon — what would the new rent be?' },
    { role: 'staff', sender: ownerUser, body: 'We are proposing a 6% escalation. I will send the renewal document through the app for e-signature this week.' },
    { role: 'tenant', sender: lerato, body: 'That works, thank you for letting me know.' },
  ], 'closed');

  // service providers
  await provider(V, 'FixIt Plumbing', 'plumbing', 'Sipho M', '+27831110001', 'fixit@example.com');
  await provider(V, 'BrightSpark Electrical', 'electrical', 'Nadia P', '+27831110002', 'spark@example.com');
  await provider(V, 'GreenScape Gardens', 'landscaping', 'Themba K', '+27831110003', 'green@example.com');
  await provider(V, 'Sparkle Cleaners', 'cleaning', 'Lerato S', '+27831110004', 'clean@example.com');
  await provider(V, 'Sentinel Security', 'security', 'John D', '+27831110005', 'sentinel@example.com');
  await provider(V, 'Khumalo Attorneys', 'legal', 'Zanele K', '+27831110006', 'legal@example.com');

  console.log('\nComprehensive seed complete for Demo Agency.');
  console.table({
    vendorId: V, tenants: 5, properties: 3, units: 7,
    invoices: 'paid / not-yet-due / overdue / partly-paid',
    tickets: 'open x2 / assigned / resolved / closed',
    owners: 2, statements: '1 paid_out + 1 ready-to-pay',
    listings: 2, applications: 'submitted / screening / approved / rejected',
  });
  console.log('\nLogins (OTP prints to the API console):');
  console.log('  owner@demo.test   — web console + landlord app');
  console.log('  thabo@demo.test   — tenant app (has a due invoice + a resolved ticket to approve)');
  console.log('  lerato@ / naledi@ / johan@ / kagiso@demo.test — more tenants');
  console.log('  sipho@owner.demo.test — owner portal (statements, payouts, banking)\n');

  await dataSource.destroy();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
