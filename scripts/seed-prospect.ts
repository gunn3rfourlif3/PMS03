import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import dataSource from '../src/common/database/data-source';

/**
 * Prospect seed — builds an entire agency from a profile in `demo/profiles/`.
 *
 *   npm run seed:prospect -- midnight-masquerade
 *
 * Day 1 of LOCARE_ONSITE_DEMO_BUILD_PLAN.md: the structure. Vendor, branding,
 * subscription, buildings, units to the profile's target exactly, leases at its
 * occupancy, staff and the two app logins. Twelve months of invoices and
 * payments and the story records are Day 2.
 *
 * Runs as the DB owner (local `pms`), which bypasses RLS so one script can
 * insert across the vendor — the same arrangement `scripts/seed.ts` relies on.
 *
 * Idempotent on the profile's `slug`: a second run finds what it made and fills
 * gaps rather than doubling. Login is passwordless OTP, so no password is set.
 *
 * TWO CONVERSIONS THE PROFILE FORCES, both easy to get wrong:
 *
 *  1. The profile is in CENTS (`rentRangeCents`, `amountCents`). Every money
 *     column in this schema is in RANDS (`units.market_rent` 8000 means R8 000).
 *     Everything read off the profile therefore passes through `toRands()`.
 *  2. The profile's building types are its own vocabulary (`apartment_block`,
 *     `semi_detached`, `house`); `PropertyType` only has
 *     building | complex | single_unit | co_living. The map is below, and the
 *     profile's own word is kept in `properties.attributes.profileType` so
 *     nothing is lost in translation.
 *
 * Rents, names and dates are generated from a PRNG seeded on the slug, so a
 * re-run produces the same world rather than a different one.
 */

type Profile = {
  slug: string;
  agency: { name: string; tradingName?: string; email: string; phone: string; city: string; addressText: string };
  branding: { brand: string; tint: string; accent: string; logo: string | null };
  subscription: { tier: string; units: number; unitRateCents: number | null; status: string };
  portfolio: {
    targetUnits: number;
    buildings: { name: string; suburb: string; type: string; units: number }[];
    rentRangeCents: { min: number; max: number };
    occupancyRate: number;
  };
  people: {
    staff: { name: string; email: string; role: string }[];
    landlordDemoAccount: { name: string; email: string; ownsBuildings: string[] };
    tenantDemoAccount: { name: string; email: string; unit: string };
  };
  story?: Record<string, any>;
};

/** Profile vocabulary -> PropertyType. See the header note. */
const PROPERTY_TYPE: Record<string, string> = {
  apartment_block: 'building',
  complex: 'complex',
  semi_detached: 'complex',
  house: 'complex',
  single_unit: 'single_unit',
  co_living: 'co_living',
};

const toRands = (cents: number) => Math.round(cents / 100);

/** mulberry32, seeded off the slug so the generated world is stable per profile. */
function prng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Lerato','Thabo','Nomvula','Sipho','Anelisa','Kagiso','Zanele','Johan','Michelle','Riaan','Naledi','Pieter','Ayanda','Chantal','Bongani','Elmarie','Tshepo','Jason','Refilwe','Dewald','Lindiwe','Marius','Palesa','Shaun','Nosipho','Werner','Kefilwe','Danielle','Mandla','Carina'];
const LAST = ['Mokoena','Nkosi','Pillay','Adams','de Villiers','Dlamini','Fourie','Mahlangu','Botha','Sithole','Naidoo','van Wyk','Khumalo','Jacobs','Mthembu','Steyn','Moloi','September','Zulu','Erasmus','Maseko','Coetzee','Ndlovu','Williams','Radebe','Visser','Molefe','Abrahams','Ngcobo','Swart'];

/** Deterministic, and distinct enough across 500 units not to collide. */
function personName(rnd: () => number): string {
  return `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`;
}

/**
 * Unit labels, floor-style: 8 per floor, so building 96 gives 101..1208.
 * Labels are unique per vendor (`scripts/seed.ts` looks units up by label
 * alone), so the building name is part of the label, which is also the form the
 * profile's story uses — "Masquerade Heights 304".
 */
function generatedSuffixes(count: number, taken: Set<string>): string[] {
  const out: string[] = [];
  let floor = 1;
  let n = 1;
  while (out.length < count) {
    const suffix = `${floor}${String(n).padStart(2, '0')}`;
    if (!taken.has(suffix)) out.push(suffix);
    n++;
    if (n > 8) { n = 1; floor++; }
    if (floor > 200) throw new Error('ran out of unit labels');
  }
  return out;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: npm run seed:prospect -- <slug>   (a file in demo/profiles/)');
    process.exit(1);
  }
  const file = path.join(__dirname, '..', 'demo', 'profiles', `${slug}.json`);
  if (!fs.existsSync(file)) {
    console.error(`no profile at ${file}`);
    process.exit(1);
  }
  const p: Profile = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rnd = prng(p.slug);

  await dataSource.initialize();
  const q = (sql: string, params: unknown[] = []) => dataSource.query(sql, params);
  const first = async (sql: string, v: unknown[] = []) => (await q(sql, v))[0];

  // ---------------- vendor ----------------
  const branding = {
    colors: { brand: p.branding.brand, tint: p.branding.tint, accent: p.branding.accent },
    logo: { text: p.agency.tradingName ?? p.agency.name, ...(p.branding.logo ? { imageUrl: p.branding.logo } : {}) },
    contact: { email: p.agency.email, phone: p.agency.phone, address: p.agency.addressText },
  };

  let vendor = await first(`SELECT id FROM vendors WHERE slug=$1`, [p.slug]);
  if (!vendor) {
    vendor = await first(
      `INSERT INTO vendors (name,slug,type,status,default_currency,has_valid_ffc,has_trust_account,config)
       VALUES ($1,$2,'agency','active','ZAR',true,true, jsonb_build_object('branding',$3::jsonb))
       RETURNING id`,
      [p.agency.name, p.slug, JSON.stringify(branding)],
    );
  } else {
    await q(
      `UPDATE vendors
          SET name=$2,
              config = COALESCE(config,'{}'::jsonb) || jsonb_build_object('branding',$3::jsonb),
              updated_at = now()
        WHERE id=$1`,
      [vendor.id, p.agency.name, JSON.stringify(branding)],
    );
  }
  const V: string = vendor.id;

  // ---------------- subscription ----------------
  // `mrr` stays 0 while `unitRateCents` is null: at this size the tier is a
  // Custom conversation and CUSTOM_UNIT_RATE is unset, so there is no rate to
  // state. Open item (c) in the build plan — do not invent one here.
  const mrr = p.subscription.unitRateCents ? toRands(p.subscription.unitRateCents) * p.subscription.units : 0;
  await q(
    `INSERT INTO vendor_subscriptions (vendor_id,tier,status,unit_count,mrr)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (vendor_id) DO UPDATE
       SET tier=EXCLUDED.tier, status=EXCLUDED.status,
           unit_count=EXCLUDED.unit_count, mrr=EXCLUDED.mrr, updated_at=now()`,
    [V, p.subscription.tier, p.subscription.status, p.subscription.units, mrr],
  );

  // ---------------- users ----------------
  async function user(name: string, email: string, phone: string): Promise<string> {
    await q(`INSERT INTO users (name,email,phone) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING`, [name, email, phone]);
    return (await first(`SELECT id FROM users WHERE email=$1`, [email])).id;
  }
  async function membership(userId: string, role: string) {
    await q(
      `INSERT INTO memberships (vendor_id,user_id,role,scope) VALUES ($1,$2,$3,'{}')
       ON CONFLICT (vendor_id,user_id) DO NOTHING`,
      [V, userId, role],
    );
  }

  let phoneSeq = 300;
  const nextPhone = () => `+2782${String(++phoneSeq).padStart(7, '0')}`;

  for (const s of p.people.staff) {
    await membership(await user(s.name, s.email, nextPhone()), s.role);
  }

  // ---------------- landlord ----------------
  const landlordUserId = await user(p.people.landlordDemoAccount.name, p.people.landlordDemoAccount.email, nextPhone());
  await membership(landlordUserId, 'owner');
  let landlord = await first(`SELECT id FROM owners WHERE vendor_id=$1 AND name=$2`, [V, p.people.landlordDemoAccount.name]);
  if (!landlord) {
    landlord = await first(
      `INSERT INTO owners (vendor_id,name,management_fee_pct,payout_subaccount,user_id)
       VALUES ($1,$2,0.08,$3,$4) RETURNING id`,
      [V, p.people.landlordDemoAccount.name, 'ACC-' + p.people.landlordDemoAccount.name.replace(/\W/g, '').slice(0, 6).toUpperCase(), landlordUserId],
    );
  } else {
    await q(`UPDATE owners SET user_id=$2 WHERE id=$1`, [landlord.id, landlordUserId]);
  }

  // ---------------- reserved labels ----------------
  // Units the profile names by label — the tenant demo account's unit and every
  // unit in `story`. They are created with exactly those labels so Day 2 can
  // attach its records without renaming anything. Everything else is filler.
  const named: { label: string; tenantName?: string }[] = [
    { label: p.people.tenantDemoAccount.unit, tenantName: p.people.tenantDemoAccount.name },
  ];
  const story = p.story ?? {};
  for (const a of story.arrears ?? []) named.push({ label: a.unit, tenantName: a.tenant });
  for (const m of story.maintenance ?? []) named.push({ label: m.unit });
  if (story.leaseExpiringSoon) named.push({ label: story.leaseExpiringSoon.unit, tenantName: story.leaseExpiringSoon.tenant });
  if (story.newLeaseAwaitingSignature) named.push({ label: story.newLeaseAwaitingSignature.unit, tenantName: story.newLeaseAwaitingSignature.tenant });

  const awaitingSignatureLabel: string | null = story.newLeaseAwaitingSignature?.unit ?? null;

  /** Split "Masquerade Heights 304" into its building and its suffix. */
  function splitLabel(label: string): { building: string; suffix: string } | null {
    const b = p.portfolio.buildings.find((x) => label.startsWith(x.name + ' '));
    if (!b) return null;
    return { building: b.name, suffix: label.slice(b.name.length + 1) };
  }

  const reservedBy = new Map<string, { suffix: string; tenantName?: string }[]>();
  for (const n of named) {
    const split = splitLabel(n.label);
    if (!split) {
      console.warn(`  ! profile names "${n.label}", which matches no building — skipped`);
      continue;
    }
    const list = reservedBy.get(split.building) ?? [];
    if (!list.some((x) => x.suffix === split.suffix)) list.push({ suffix: split.suffix, tenantName: n.tenantName });
    reservedBy.set(split.building, list);
  }

  // ---------------- properties, units, leases ----------------
  const rentMin = toRands(p.portfolio.rentRangeCents.min);
  const rentMax = toRands(p.portfolio.rentRangeCents.max);
  const ownedByLandlord = new Set(p.people.landlordDemoAccount.ownsBuildings);

  type Slot = { label: string; propertyId: string; rent: number; tenantName?: string; reserved: boolean };
  const slots: Slot[] = [];

  for (const b of p.portfolio.buildings) {
    const ownerId = ownedByLandlord.has(b.name) ? landlord.id : null;
    let prop = await first(`SELECT id FROM properties WHERE vendor_id=$1 AND name=$2`, [V, b.name]);
    if (!prop) {
      prop = await first(
        `INSERT INTO properties (vendor_id,name,type,owner_id,address,attributes)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb) RETURNING id`,
        [
          V, b.name, PROPERTY_TYPE[b.type] ?? 'building', ownerId,
          JSON.stringify({ suburb: b.suburb, city: p.agency.city }),
          JSON.stringify({ profileType: b.type }),
        ],
      );
    } else {
      await q(`UPDATE properties SET owner_id=$2 WHERE id=$1`, [prop.id, ownerId]);
    }

    const reserved = reservedBy.get(b.name) ?? [];
    const taken = new Set(reserved.map((r) => r.suffix));
    const fillers = generatedSuffixes(Math.max(0, b.units - reserved.length), taken);

    for (const r of reserved) {
      slots.push({ label: `${b.name} ${r.suffix}`, propertyId: prop.id, rent: 0, tenantName: r.tenantName, reserved: true });
    }
    for (const suffix of fillers) {
      slots.push({ label: `${b.name} ${suffix}`, propertyId: prop.id, rent: 0, reserved: false });
    }
  }

  if (slots.length !== p.portfolio.targetUnits) {
    throw new Error(`built ${slots.length} units but the profile targets ${p.portfolio.targetUnits} — the building counts do not sum to the target`);
  }

  // Rents: deterministic inside the profile's range, to the nearest R50.
  for (const s of slots) {
    s.rent = Math.round((rentMin + rnd() * (rentMax - rentMin)) / 50) * 50;
  }

  // Occupancy: the profile's rate, rounded. Named units are occupied first so
  // the story always lands on a live lease — except the unit whose lease is
  // still awaiting signature, which has to be vacant for that to make sense.
  const targetOccupied = Math.round(p.portfolio.targetUnits * p.portfolio.occupancyRate);
  const occupy = new Set<string>();
  for (const s of slots) {
    if (s.reserved && s.label !== awaitingSignatureLabel) occupy.add(s.label);
  }
  for (const s of slots) {
    if (occupy.size >= targetOccupied) break;
    if (s.label === awaitingSignatureLabel || occupy.has(s.label)) continue;
    occupy.add(s.label);
  }

  const today = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  let created = 0;
  let leased = 0;
  let tenantSeq = 0;

  for (const s of slots) {
    const occupied = occupy.has(s.label);
    const status = occupied ? 'occupied' : 'vacant';

    let u = await first(`SELECT id FROM units WHERE vendor_id=$1 AND label=$2`, [V, s.label]);
    if (!u) {
      u = await first(
        `INSERT INTO units (vendor_id,property_id,label,status,market_rent,bedrooms,bathrooms)
         VALUES ($1,$2,$3,$4,$5,$6,1) RETURNING id`,
        [V, s.propertyId, s.label, status, s.rent, 1 + Math.floor(rnd() * 3)],
      );
      created++;
    } else {
      await q(`UPDATE units SET status=$2, property_id=$3, market_rent=$4 WHERE id=$1`, [u.id, status, s.propertyId, s.rent]);
    }

    if (!occupied) continue;

    // The tenant: the profile's name where it gives one, otherwise generated.
    const isDemoTenant = s.label === p.people.tenantDemoAccount.unit;
    const name = s.tenantName ?? personName(rnd);
    const email = isDemoTenant
      ? p.people.tenantDemoAccount.email
      : `tenant${String(++tenantSeq).padStart(3, '0')}@${p.slug}.demo`;

    const tenantId = await user(name, email, nextPhone());
    await membership(tenantId, 'tenant');

    const existing = await first(`SELECT id FROM leases WHERE vendor_id=$1 AND unit_id=$2 AND tenant_id=$3`, [V, u.id, tenantId]);
    if (!existing) {
      // Started somewhere in the last two years, so renewals and expiries are
      // spread rather than all falling in the same month.
      const start = new Date(today);
      start.setMonth(start.getMonth() - Math.floor(rnd() * 24));
      start.setDate(1);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 12);
      await q(
        `INSERT INTO leases (vendor_id,unit_id,tenant_id,type,status,start_date,end_date,rent_amount,billing_cycle)
         VALUES ($1,$2,$3,'fixed','active',$4,$5,$6,'monthly')`,
        [V, u.id, tenantId, isoDate(start), isoDate(end), s.rent],
      );
      leased++;
    }
  }

  console.log(`\n${p.agency.name} seeded (slug ${p.slug}, vendor ${V})`);
  console.log(`  tier      : ${p.subscription.tier}, ${p.subscription.units} units, status ${p.subscription.status}${mrr ? `, mrr ${mrr}` : ' — no rate set (CUSTOM_UNIT_RATE unset)'}`);
  console.log(`  buildings : ${p.portfolio.buildings.length}`);
  console.log(`  units     : ${slots.length} (${created} created this run), ${occupy.size} occupied`);
  console.log(`  leases    : ${leased} created this run`);
  console.log(`  staff     : ${p.people.staff.map((s) => s.email).join(', ')}`);
  console.log(`  landlord  : ${p.people.landlordDemoAccount.email}`);
  console.log(`  tenant    : ${p.people.tenantDemoAccount.email} (${p.people.tenantDemoAccount.unit})`);
  console.log(`\n  Logins are passwordless OTP — request a code and read it off the API console or Mailpit.`);
  console.log(`  No invoices, payments or story records yet: that is Day 2.\n`);

  await dataSource.destroy();
}

main().catch(async (e) => {
  console.error(e);
  try { await dataSource.destroy(); } catch { /* already down */ }
  process.exit(1);
});
