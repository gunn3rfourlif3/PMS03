import 'reflect-metadata';
import dataSource from '../src/common/database/data-source';

/**
 * Demo partner seed — one partner account for walking the partner portal and
 * the assistant help panel.
 *
 * Login is passwordless OTP, so there is no password here and none to set:
 * request a code for the email below and read it off the API console.
 *
 *   partner@demo.test — partner owner of "Demo Partner Co"
 *
 * The data is shaped to light up the assistant panel's signals:
 *   - Thornhill Letting sits in `proposal` with `stage_changed_at` 31 days ago,
 *     which is past the 14-day line, so the stale-deal signal fires.
 *   - `banking` is left empty, so the banking signal fires. It only fires for a
 *     partner whose status is exactly `active` (the approval gate), which this
 *     partner is.
 *   - The open-lead cap signal CANNOT fire: the cap lives server-side in
 *     `openLeadCap()` and `/partner/me` returns the Partner entity, which has no
 *     cap field. Seeding 20 deals would not surface it.
 *   - The changelog signal cannot fire either: no partner route serves it.
 *
 * Idempotent: re-running adds nothing and overwrites nothing.
 */
const REF_CODE = 'DEMOPARTNER';
const EMAIL = 'partner@demo.test';

async function main() {
  await dataSource.initialize();
  const q = (sql: string, params: unknown[] = []) => dataSource.query(sql, params);
  const first = async (sql: string, p: unknown[] = []) => (await q(sql, p))[0];

  // ---- user ----
  await q(
    `INSERT INTO users (name,email,phone) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING`,
    ['Demo Partner', EMAIL, '+27820000111'],
  );
  const userId = (await first(`SELECT id FROM users WHERE email=$1`, [EMAIL])).id;

  // ---- partner ----
  // status 'active' so the banking signal is past the approval gate; banking
  // left at its '{}' default so that signal has something to say.
  let partner = await first(`SELECT id FROM partners WHERE ref_code=$1`, [REF_CODE]);
  if (!partner) {
    partner = await first(
      `INSERT INTO partners (name,contact_email,contact_phone,company,ref_code,status,notes)
       VALUES ($1,$2,$3,$4,$5,'active',$6) RETURNING id`,
      [
        'Demo Partner Co',
        EMAIL,
        '+27820000111',
        'Demo Partner Co (Pty) Ltd',
        REF_CODE,
        'Seeded by scripts/seed-demo-partner.ts for portal and help-panel demos.',
      ],
    );
  }
  const partnerId = partner.id;

  await q(
    `INSERT INTO partner_members (partner_id,user_id,role) VALUES ($1,$2,'partner_owner')
     ON CONFLICT DO NOTHING`,
    [partnerId, userId],
  );

  // ---- deals ----
  // [name, stage, units, mrr, days since the stage last moved, lost reason]
  const deals: [string, string, number, number, number, string | null][] = [
    ['Thornhill Letting', 'proposal', 34, 4200, 31, null], // stale: past 14 days
    ['Baywest Rentals', 'demo', 18, 2800, 3, null],
    ['Umhlanga Property Group', 'contacted', 52, 6100, 1, null],
    ['Rosebank Estates', 'lead', 11, 1500, 0, null],
    ['Clifton Collective', 'won', 26, 3400, 10, null],
    ['Kloof Rentals', 'lost', 9, 1100, 20, 'Stayed with their incumbent'],
  ];

  for (const [name, stage, units, mrr, ageDays, lostReason] of deals) {
    const existing = await first(
      `SELECT id FROM partner_deals WHERE partner_id=$1 AND prospect_name=$2`,
      [partnerId, name],
    );
    if (existing) continue;
    await q(
      `INSERT INTO partner_deals
         (partner_id,prospect_name,contact_name,contact_email,stage,expected_units,expected_mrr,
          source,lost_reason,stage_changed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'manual',$8, now() - ($9 || ' days')::interval)`,
      [
        partnerId,
        name,
        `${name.split(' ')[0]} contact`,
        `${name.split(' ')[0].toLowerCase()}@demo.test`,
        stage,
        units,
        mrr,
        lostReason,
        String(ageDays),
      ],
    );
  }

  // ---- activities ----
  // One demo inside the last 7 days so the overview's "demos this week" is not 0.
  const activities: [string, string, number][] = [
    ['demo', 'Walked Baywest through the tenant app', 2],
    ['call', 'Umhlanga asked for a second reference', 1],
    ['email', 'Sent Thornhill the proposal pack', 30],
    ['note', 'Rosebank only has budget next quarter', 4],
  ];
  for (const [type, summary, ageDays] of activities) {
    const existing = await first(
      `SELECT id FROM partner_activities WHERE partner_id=$1 AND summary=$2`,
      [partnerId, summary],
    );
    if (existing) continue;
    await q(
      `INSERT INTO partner_activities (partner_id,type,summary,created_at)
       VALUES ($1,$2,$3, now() - ($4 || ' days')::interval)`,
      [partnerId, type, summary, String(ageDays)],
    );
  }

  console.log(`Demo partner ready.`);
  console.log(`  partner : Demo Partner Co (${partnerId}), status active, ref ${REF_CODE}`);
  console.log(`  login   : ${EMAIL} — request an OTP, the code prints to this API console`);
  console.log(`  deals   : ${deals.length} (Thornhill Letting is 31 days stale)`);
  console.log(`  banking : empty on purpose, so the banking signal fires`);
  await dataSource.destroy();
}

main().catch(async (e) => {
  console.error(e);
  try { await dataSource.destroy(); } catch { /* already down */ }
  process.exit(1);
});
