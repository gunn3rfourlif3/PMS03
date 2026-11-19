import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import dataSource from '../src/common/database/data-source';
import { assertBalanced, JournalLineInput } from '../src/modules/accounting/double-entry';
import {
  apportionVacancy,
  isArrearsMonthUnpaid,
  prng,
  skipCurrentMonthFor,
  uniqueNames,
  unpaidMonthsFor,
} from './demo-world';
import { computeStatement } from '../src/modules/owners/statement-calc';
import { encryptedJson } from '../src/common/security/pii-crypto';
import { vatApplies } from '../src/modules/billing/invoice-calc';
import { ALLOCATED_AMOUNT, ALLOCATED_PAYMENTS_FROM, SUCCEEDED_PAYMENT } from '../src/common/database/invoice-outstanding';

/**
 * Prospect seed — builds an entire agency from a profile in `demo/profiles/`.
 *
 *   npm run seed:prospect -- midnight-masquerade
 *
 * Days 1-2 of LOCARE_ONSITE_DEMO_BUILD_PLAN.md. Day 1 is the structure: vendor,
 * branding, subscription, buildings, units to the profile's target exactly,
 * leases at its occupancy, staff and the two app logins. Day 2 adds the history
 * (twelve months of invoices and payments) and the story set.
 *
 * THE HISTORY POSTS THROUGH THE LEDGER. Every invoice and payment carries a
 * balanced double-entry transaction in the same shape the app's own services
 * use (`InvoiceService.generateRentInvoice`, `PaymentService`), and each set of
 * lines is checked by `assertBalanced` from `src/modules/accounting/double-entry`
 * before it is written — the same function the posting engine calls. The
 * services themselves are request-scoped Nest providers and cannot be driven
 * from a script, so this reuses the invariant rather than the plumbing. A demo
 * whose statements do not reconcile is worse than no demo.
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
  agency: {
    name: string; tradingName?: string; email: string; phone: string; city: string;
    addressText: string; emailDomain?: string; managementFeePct?: number; managementFeeConfirmed?: boolean;
    /** Stored at vendors.config.vat. Absent → not registered. */
    vat?: { registered: boolean; number?: string };
    /** Stored at vendors.config.invoicing. `billUtilities` also seeds submeters and a reading per unit. */
    invoicing?: { billUtilities?: boolean };
  };
  branding: { brand: string; tint: string; accent: string; logo: string | null };
  subscription: { tier: string; units: number; unitRateCents: number | null; status: string };
  portfolio: {
    targetUnits: number;
    /** `commercial`: let commercially, so rent carries VAT if the agency is registered. */
    buildings: { name: string; suburb: string; type: string; units: number; commercial?: boolean }[];
    rentRangeCents: { min: number; max: number };
    occupancyRate: number;
  };
  people: {
    staff: { name: string; email: string; role: string }[];
    landlordDemoAccount: { name: string; email: string; ownsBuildings: string[] };
    owners?: { name: string; ownsBuildings: string[] }[];
    tenantDemoAccount: { name: string; email: string; unit: string };
  };
  story?: Record<string, any>;
  history?: { monthsOfInvoices: number; monthsOfPayments: number; rentDueDayOfMonth: number; arrearsRate?: number };
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

/** As `za-vat.tax.ts` has it. One constant: the rent and the invoices must agree. */
const VAT_RATE_PCT = 15;

const FIRST = ['Lerato','Thabo','Nomvula','Sipho','Anelisa','Kagiso','Zanele','Johan','Michelle','Riaan','Naledi','Pieter','Ayanda','Chantal','Bongani','Elmarie','Tshepo','Jason','Refilwe','Dewald','Lindiwe','Marius','Palesa','Shaun','Nosipho','Werner','Kefilwe','Danielle','Mandla','Carina'];
const LAST = ['Mokoena','Nkosi','Pillay','Adams','de Villiers','Dlamini','Fourie','Mahlangu','Botha','Sithole','Naidoo','van Wyk','Khumalo','Jacobs','Mthembu','Steyn','Moloi','September','Zulu','Erasmus','Maseko','Coetzee','Ndlovu','Williams','Radebe','Visser','Molefe','Abrahams','Ngcobo','Swart'];


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

  // ONE email domain for the whole world. Generated addresses used to be built
  // from the slug (`tenant001@midnight-masquerade.demo`) while the profile's own
  // staff addresses had no hyphen (`@midnightmasquerade.demo`) — two domains in
  // one demo, carried as an open item since the seeder was written. The profile
  // states the domain; the slug is only the fallback.
  const emailDomain = p.agency.emailDomain ?? `${p.slug}.demo`;

  // The management fee shows on the owner, so it is a figure the prospect can
  // see. It was the literal 0.08 in the INSERT below — a number nobody gave us,
  // asserted on screen. Stated in the profile now, and the profile says there
  // whether it is confirmed. Replace it with their own fee once they say it.
  const managementFeePct = p.agency.managementFeePct ?? 0.08;

  await dataSource.initialize();
  const q = (sql: string, params: unknown[] = []) => dataSource.query(sql, params);
  const first = async (sql: string, v: unknown[] = []) => (await q(sql, v))[0];

  // ---------------- vendor ----------------
  const branding = {
    colors: { brand: p.branding.brand, tint: p.branding.tint, accent: p.branding.accent },
    logo: { text: p.agency.tradingName ?? p.agency.name, ...(p.branding.logo ? { imageUrl: p.branding.logo } : {}) },
    contact: { email: p.agency.email, phone: p.agency.phone, address: p.agency.addressText },
  };

  // Written on every run, so the profile is the source of truth for the demo.
  const vatSettings = { registered: p.agency.vat?.registered === true, ...(p.agency.vat?.number ? { number: p.agency.vat.number } : {}) };
  const invoicingSettings = { billUtilities: p.agency.invoicing?.billUtilities === true };

  let vendor = await first(`SELECT id FROM vendors WHERE slug=$1`, [p.slug]);
  if (!vendor) {
    vendor = await first(
      `INSERT INTO vendors (name,slug,type,status,default_currency,has_valid_ffc,has_trust_account,config)
       VALUES ($1,$2,'agency','active','ZAR',true,true, jsonb_build_object('branding',$3::jsonb,'vat',$4::jsonb,'invoicing',$5::jsonb))
       RETURNING id`,
      [p.agency.name, p.slug, JSON.stringify(branding), JSON.stringify(vatSettings), JSON.stringify(invoicingSettings)],
    );
  } else {
    await q(
      `UPDATE vendors
          SET name=$2,
              config = COALESCE(config,'{}'::jsonb) || jsonb_build_object('branding',$3::jsonb,'vat',$4::jsonb,'invoicing',$5::jsonb),
              updated_at = now()
        WHERE id=$1`,
      [vendor.id, p.agency.name, JSON.stringify(branding), JSON.stringify(vatSettings), JSON.stringify(invoicingSettings)],
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
    // `users` is global, not per vendor, so an existing row is only renamed when
    // its address is on this world's own domain — never someone else's account.
    const onConflict = email.endsWith(`@${emailDomain}`) ? 'DO UPDATE SET name = EXCLUDED.name' : 'DO NOTHING';
    await q(`INSERT INTO users (name,email,phone) VALUES ($1,$2,$3) ON CONFLICT (email) ${onConflict}`, [name, email, phone]);
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

  // ---------------- owners ----------------
  // EVERY building has an owner. The seeder used to create one — the demo
  // landlord, with two buildings — and leave the other eight ownerless: a
  // managing agency with 436 units belonging to nobody, an owners screen with a
  // single row, and no owner statement possible for 87% of the book.
  //
  // Banking is fictional and goes through the app's own `encryptedJson`
  // transformer, so it is encrypted at rest exactly as real banking is. It is
  // rewritten on every run: PII_ENCRYPTION_KEY changing after a seed makes the
  // old ciphertext unreadable (the owners screen then fails), and a re-seed
  // under the new key repairs it.
  const BANKS = [
    { bankName: 'FNB', branchCode: '250655' }, { bankName: 'Standard Bank', branchCode: '051001' },
    { bankName: 'Absa', branchCode: '632005' }, { bankName: 'Nedbank', branchCode: '198765' },
    { bankName: 'Capitec', branchCode: '470010' },
  ];
  function bankingFor(name: string) {
    const r = prng(`${p.slug}:banking:${name}`);
    const bank = BANKS[Math.floor(r() * BANKS.length)];
    let acct = '62';
    for (let i = 0; i < 9; i++) acct += Math.floor(r() * 10);
    return { ...bank, accountHolder: name, accountNumber: acct, accountType: 'cheque' };
  }
  async function ensureOwner(name: string, userId: string | null): Promise<string> {
    const banking = JSON.stringify(encryptedJson.to(bankingFor(name)));
    let o = await first(`SELECT id FROM owners WHERE vendor_id=$1 AND name=$2`, [V, name]);
    if (!o) {
      o = await first(
        `INSERT INTO owners (vendor_id,name,management_fee_pct,payout_subaccount,user_id,banking)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
        [V, name, managementFeePct, 'ACC-' + name.replace(/\W/g, '').slice(0, 6).toUpperCase(), userId, banking],
      );
    } else {
      await q(
        `UPDATE owners SET user_id=COALESCE($2,user_id), management_fee_pct=$3, banking=$4::jsonb, updated_at=now() WHERE id=$1`,
        [o.id, userId, managementFeePct, banking],
      );
    }
    return o.id;
  }

  const ownerIdByBuilding = new Map<string, string>();
  const ownerNames: string[] = [];

  // The demo landlord: the one owner with a login, opened on screen.
  const landlordUserId = await user(p.people.landlordDemoAccount.name, p.people.landlordDemoAccount.email, nextPhone());
  await membership(landlordUserId, 'owner');
  const landlordId = await ensureOwner(p.people.landlordDemoAccount.name, landlordUserId);
  ownerNames.push(p.people.landlordDemoAccount.name);
  for (const b of p.people.landlordDemoAccount.ownsBuildings) ownerIdByBuilding.set(b, landlordId);

  for (const o of p.people.owners ?? []) {
    const id = await ensureOwner(o.name, null);
    ownerNames.push(o.name);
    for (const b of o.ownsBuildings) ownerIdByBuilding.set(b, id);
  }
  for (const b of p.portfolio.buildings) {
    if (!ownerIdByBuilding.has(b.name)) console.warn(`  ! ${b.name} has no owner in the profile — it will have no owner statement`);
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

  type Slot = { label: string; propertyId: string; rent: number; tenantName?: string; reserved: boolean };
  const slots: Slot[] = [];

  const taxedProps = new Set<string>();
  const vatDivisor = (propertyId: string) => (taxedProps.has(propertyId) ? 1 + VAT_RATE_PCT / 100 : 1);
  for (const b of p.portfolio.buildings) {
    const ownerId = ownerIdByBuilding.get(b.name) ?? null;
    let prop = await first(`SELECT id FROM properties WHERE vendor_id=$1 AND name=$2`, [V, b.name]);
    if (!prop) {
      prop = await first(
        `INSERT INTO properties (vendor_id,name,type,owner_id,address,attributes)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb) RETURNING id`,
        [
          V, b.name, PROPERTY_TYPE[b.type] ?? 'building', ownerId,
          JSON.stringify({ suburb: b.suburb, city: p.agency.city }),
          JSON.stringify({ profileType: b.type, commercial: b.commercial === true }),
        ],
      );
    } else {
      await q(
        `UPDATE properties SET owner_id=$2,
                attributes = COALESCE(attributes,'{}'::jsonb) || jsonb_build_object('commercial',$3::boolean)
          WHERE id=$1`,
        [prop.id, ownerId, b.commercial === true],
      );
    }
    // The same rule the API applies when it issues an invoice.
    if (vatApplies(vatSettings, { commercial: b.commercial === true })) taxedProps.add(prop.id);

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
  // The arrears units' rent is DERIVED from the profile's stated outstanding
  // amount, here, where every other rent is set. It used to be patched onto the
  // lease and unit later, inside the history phase — so a re-seed, which skips
  // that phase, reset the unit's market rent to the generated figure and left
  // the unit disagreeing with its own lease.
  for (const a of story.arrears ?? []) {
    const slot = slots.find((x) => x.label === a.unit);
    if (slot) {
      slot.rent = Math.round((toRands(a.amountCents) / unpaidMonthsFor(a.daysLate) / vatDivisor(slot.propertyId)) * 100) / 100;
    }
  }

  // Occupancy: the profile's rate, rounded. Named units are occupied first so
  // the story always lands on a live lease — except the unit whose lease is
  // still awaiting signature, which has to be vacant for that to make sense.
  const targetOccupied = Math.round(p.portfolio.targetUnits * p.portfolio.occupancyRate);

  // Vacancy is apportioned across the buildings — see `apportionVacancy` in
  // ./demo-world.ts for what filling in list order did to the demo landlord's
  // houses. Its own PRNG stream: `rnd` draws rents and names and must not shift.
  const vacancyRate = 1 - p.portfolio.occupancyRate;
  const vacant = apportionVacancy({
    buildings: p.portfolio.buildings,
    slots,
    vacancyRate,
    totalVacant: p.portfolio.targetUnits - targetOccupied,
    alwaysVacant: awaitingSignatureLabel,
    rnd: prng(`${p.slug}:occupancy`),
  });

  const occupy = new Set<string>();
  for (const s of slots) if (!vacant.has(s.label)) occupy.add(s.label);
  if (occupy.size !== targetOccupied) {
    console.warn(`  ! occupied ${occupy.size}, profile asks ${targetOccupied} — building counts cannot carry the rate`);
  }

  // Generated tenant names: distinct from each other and from everyone the
  // profile names. Own PRNG stream — see `uniqueNames` for what sharing cost.
  const profileNames = [
    ...p.people.staff.map((x) => x.name), ...ownerNames, p.people.tenantDemoAccount.name,
    ...named.map((n) => n.tenantName).filter((n): n is string => !!n),
  ];
  const namePool = uniqueNames(FIRST, LAST, prng(`${p.slug}:names`), profileNames);
  let nameIdx = 0;
  const nextName = (): string => {
    if (nameIdx >= namePool.length) throw new Error(`ran out of distinct tenant names at ${nameIdx} — extend FIRST/LAST`);
    return namePool[nameIdx++];
  };

  const today = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  let created = 0;
  let leased = 0;
  let tenantSeq = 0;

  for (const s of slots) {
    const occupied = occupy.has(s.label);
    // One place decides unit status. 'reserved' used to be set at the very end,
    // inside the guard that creates the lease_agreement — so on a SECOND run
    // the guard skipped, this loop had already reset the unit to 'vacant', and
    // the awaiting-signature beat lost its reserved unit. The runbook tells you
    // to re-seed before a demo, which is exactly when that bit.
    const status = occupied ? 'occupied' : s.label === awaitingSignatureLabel ? 'reserved' : 'vacant';

    // Drawn whether or not the unit exists, so a re-run consumes `rnd` exactly
    // as the first run did and the two cannot drift apart.
    const bedrooms = 1 + Math.floor(rnd() * 3);
    let u = await first(`SELECT id FROM units WHERE vendor_id=$1 AND label=$2`, [V, s.label]);
    if (!u) {
      u = await first(
        `INSERT INTO units (vendor_id,property_id,label,status,market_rent,bedrooms,bathrooms)
         VALUES ($1,$2,$3,$4,$5,$6,1) RETURNING id`,
        [V, s.propertyId, s.label, status, s.rent, bedrooms],
      );
      created++;
    } else {
      await q(`UPDATE units SET status=$2, property_id=$3, market_rent=$4 WHERE id=$1`, [u.id, status, s.propertyId, s.rent]);
    }

    if (!occupied) continue;

    // The tenant: the profile's name where it gives one, otherwise generated.
    const isDemoTenant = s.label === p.people.tenantDemoAccount.unit;
    const name = s.tenantName ?? nextName();
    const email = isDemoTenant
      ? p.people.tenantDemoAccount.email
      : `tenant${String(++tenantSeq).padStart(3, '0')}@${emailDomain}`;

    const tenantId = await user(name, email, nextPhone());
    await membership(tenantId, 'tenant');

    const existing = await first(`SELECT id FROM leases WHERE vendor_id=$1 AND unit_id=$2 AND tenant_id=$3`, [V, u.id, tenantId]);
    if (!existing) {
      // Started somewhere in the last two years, so renewals and expiries are
      // spread rather than all falling in the same month.
      const start = new Date(today);
      start.setMonth(start.getMonth() - Math.floor(rnd() * 24));
      start.setDate(1);

      // The CURRENT term's end, not the first term's. A 12-month lease whose
      // term has run out gets renewed by a real agency; leaving it expired made
      // HALF the book `lease_expired` on the day it was seeded, because starts
      // are spread over 24 months and the term is 12. That drowned the
      // portfolio map — every unit carried a flag and nothing could recede.
      // A deliberate few are left as holdovers, which is the case the state
      // exists to catch.
      const end = new Date(start);
      end.setMonth(end.getMonth() + 12);
      if (end <= today) {
        if (rnd() < 0.08) {
          // Holdover: expired, but recently — an agency that let one lapse,
          // not one that has not papered a tenancy in two years.
          end.setTime(today.getTime() - Math.floor(rnd() * 90 + 1) * 86400000);
        } else {
          while (end <= today) end.setFullYear(end.getFullYear() + 1);
        }
      }
      await q(
        `INSERT INTO leases (vendor_id,unit_id,tenant_id,type,status,start_date,end_date,rent_amount,billing_cycle)
         VALUES ($1,$2,$3,'fixed','active',$4,$5,$6,'monthly')`,
        [V, u.id, tenantId, isoDate(start), isoDate(end), s.rent],
      );
      leased++;
    }
  }


  // ----------------------------- Inspections -------------------------------
  // Nothing seeded inspections before this, so `MAX(conducted_on)` was null for
  // every unit and the portfolio map flagged all 470 tenancies
  // `inspection_never`. An agency that has traded for a year has inspected most
  // of its stock; the ones it has not are the finding worth surfacing.
  {
    const leasesForInspection: Array<{ id: string; unit_id: string }> = await q(
      `SELECT l.id, l.unit_id FROM leases l
        WHERE l.vendor_id=$1 AND l.status='active'
          AND NOT EXISTS (SELECT 1 FROM inspections i WHERE i.unit_id = l.unit_id AND i.vendor_id = $1)
        ORDER BY l.unit_id`,
      [V],
    );
    // Decided ONCE per world. The 5% left uninspected are the finding the
    // portfolio map exists to surface; without this guard every re-seed rolled
    // again for exactly those units and inspected most of them — a second run
    // added 20 inspections and the finding eroded toward nothing.
    const alreadyInspected = Number((await first(`SELECT count(*)::int AS n FROM inspections WHERE vendor_id=$1`, [V])).n) > 0;
    let inspected = 0;
    for (const l of alreadyInspected ? [] : leasesForInspection) {
      const roll = rnd();
      // 5% never inspected, 10% gone stale past the 365-day cadence, the rest current.
      if (roll < 0.05) continue;
      const daysAgo =
        roll < 0.15
          ? 400 + Math.floor(rnd() * 300)
          : 25 + Math.floor(rnd() * 330);
      const conducted = new Date(today.getTime() - daysAgo * 86400000);
      await q(
        `INSERT INTO inspections (vendor_id,unit_id,lease_id,type,status,checklist,tenant_signoff,conducted_on)
         VALUES ($1,$2,$3,'periodic','signed_off',$4::jsonb,true,$5)`,
        [
          V,
          l.unit_id,
          l.id,
          JSON.stringify([
            { area: 'Kitchen', condition: 'good' },
            { area: 'Bathroom', condition: 'good' },
            { area: 'Living area', condition: 'fair' },
          ]),
          isoDate(conducted),
        ],
      );
      inspected++;
    }
    if (inspected) console.log(`  inspections: ${inspected} recorded`);
  }

  // ---------------- utilities ----------------
  // Only when the profile bills utilities: an electricity and a water submeter
  // on every let unit, and one costed reading per meter for this month, unbilled,
  // so the next invoice run puts Electricity and Water lines on each invoice.
  // Its own random stream, so turning this on does not shift anything else the
  // seeder generates. Idempotent: a meter is created once per unit and kind, and
  // a reading once per meter per day (the table's own unique index).
  if (invoicingSettings.billUtilities) {
    const ur = prng(`${p.slug}:utilities`);
    await q(
      `INSERT INTO utility_meters (vendor_id, unit_id, kind, metered, unit_of_measure, serial, label)
       SELECT $1, l.unit_id, k.kind, true, k.uom,
              k.code || '-' || upper(substr(replace(l.unit_id::text, '-', ''), 1, 8)), k.label
         FROM leases l
        CROSS JOIN (VALUES ('electricity','kWh','E','Electricity submeter'),
                           ('water','kL','W','Water submeter')) AS k(kind, uom, code, label)
        WHERE l.vendor_id = $1 AND l.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM utility_meters m
                           WHERE m.unit_id = l.unit_id AND m.kind = k.kind AND m.deleted_at IS NULL)`,
      [V],
    );
    const meters: { id: string; kind: string }[] = await q(
      `SELECT m.id, m.kind FROM utility_meters m
         JOIN leases l ON l.unit_id = m.unit_id AND l.status = 'active'
        WHERE m.vendor_id = $1 AND m.deleted_at IS NULL ORDER BY m.serial`,
      [V],
    );
    // City of Cape Town-ish domestic rates, rounded. Demo figures, not a tariff.
    const RATE: Record<string, number> = { electricity: 3.95, water: 42.5 };
    const now = new Date();
    const readingDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const rows = meters.map((m) => {
      const used = m.kind === 'electricity' ? 220 + Math.floor(ur() * 400) : 7 + Math.floor(ur() * 12);
      const reading = (m.kind === 'electricity' ? 18000 : 900) + Math.floor(ur() * 5000) + used;
      return [m.id, readingDate, reading, used, RATE[m.kind], Math.round(used * RATE[m.kind] * 100) / 100];
    });
    let added = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const part = rows.slice(i, i + 500);
      const params: unknown[] = [V];
      const values = part.map((r) => {
        const b = params.length;
        params.push(...r);
        return `($1,$${b + 1},$${b + 2}::date,$${b + 3},$${b + 4},$${b + 5},$${b + 6},'import')`;
      });
      const res = await q(
        `INSERT INTO utility_readings (vendor_id, meter_id, reading_date, reading, consumption, tariff_rate, cost, source)
         VALUES ${values.join(',')} ON CONFLICT DO NOTHING RETURNING id`,
        params,
      );
      added += res.length;
    }
    console.log(`  utilities: ${meters.length} submeters, ${added} new readings for ${readingDate}`);
  }

  // ======================= Day 2: history and story =======================
  // VAT, as `src/providers/policy/za/za-vat.tax.ts` defines it. Rent is treated
  // as tax-EXCLUSIVE and the tax line is computed, exactly as
  // `buildRentInvoice` does — this must not drift from that file.
  const VAT_PCT = VAT_RATE_PCT;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const computeTax = (exclTax: number) => +(exclTax * (VAT_PCT / 100)).toFixed(2);

  /** The four accounts the rent and payment postings touch, by STD_ACCOUNTS code. */
  const ACCOUNTS: Record<string, { code: string; name: string; type: string; isTrust?: boolean }> = {
    AR:      { code: '1000', name: 'Accounts Receivable', type: 'asset' },
    BANK:    { code: '1100', name: 'Bank (operating)', type: 'asset' },
    VAT_OUT: { code: '2100', name: 'VAT Output (payable)', type: 'liability' },
    RENT_INC:{ code: '4000', name: 'Rental Income', type: 'income' },
    // Deposits (DepositService.capture) and owner statements / payouts
    // (OwnerStatementService) — same codes as STD_ACCOUNTS.
    TRUST_BANK:    { code: '1200', name: 'Trust Bank (segregated)', type: 'asset', isTrust: true },
    DEPOSIT_TRUST: { code: '2200', name: 'Tenant Deposits (trust)', type: 'liability', isTrust: true },
    OWNER_PAYABLE: { code: '2300', name: 'Owner Payable', type: 'liability' },
    MGMT_FEE:      { code: '4200', name: 'Management Fee Income', type: 'income' },
  };
  const accountId: Record<string, string> = {};
  for (const [key, a] of Object.entries(ACCOUNTS)) {
    let row = await first(`SELECT id FROM accounts WHERE vendor_id=$1 AND code=$2`, [V, a.code]);
    if (!row) {
      row = await first(
        `INSERT INTO accounts (vendor_id,code,name,type,is_trust) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [V, a.code, a.name, a.type, !!a.isTrust],
      );
    }
    accountId[key] = row.id;
  }

  const hist = p.history ?? { monthsOfInvoices: 12, monthsOfPayments: 12, rentDueDayOfMonth: 1 };

  // ---- ledger staging, shared by every phase that posts ----
  type Row = unknown[];
  let ledRows: Row[] = [];
  let ledgerRows = 0;

  /** Validate with the ledger's own invariant, then stage the rows. */
  const post = (lines: JournalLineInput[], postedAt: string): string => {
    assertBalanced(lines);
    const txnId = randomUUID();
    for (const l of lines) {
      ledRows.push([V, txnId, l.accountId, l.debit ?? 0, l.credit ?? 0, l.entityRef ?? null, postedAt]);
      ledgerRows++;
    }
    return txnId;
  };

  // Batched: thousands of rows one at a time would be minutes of round trips.
  // Chunked to stay well inside Postgres' 65535-parameter cap.
  async function insertMany(table: string, cols: string[], rows: Row[], extra = '') {
    if (rows.length === 0) return;
    const perRow = cols.length;
    const chunk = Math.max(1, Math.floor(60000 / perRow));
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const values = slice
        .map((_, r) => `(${cols.map((__, c) => `$${r * perRow + c + 1}`).join(',')})`)
        .join(',');
      await q(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${values} ${extra}`, slice.flat());
    }
  }
  const flushLedger = async () => {
    await insertMany('ledger_entries',
      ['vendor_id','transaction_id','account_id','debit','credit','entity_ref','posted_at'], ledRows);
    ledRows = [];
  };

  // Idempotency: the history is generated as one block with ids minted here, so
  // a re-run cannot match the rows it made last time. If any invoice exists for
  // this vendor the whole phase is skipped rather than half-repeated.
  const invCount = Number((await first(`SELECT count(*)::int AS n FROM invoices WHERE vendor_id=$1`, [V])).n);

  let invoicesMade = 0, paymentsMade = 0, arrearsMade = 0;

  if (invCount > 0) {
    console.log(`\n  history: ${invCount} invoices already present — skipped (idempotent)`);
  } else {
    // ---- the arrears leases get their rent aligned to the profile's amount ----
    // The profile states an outstanding amount per arrears unit. Rents were
    // generated on Day 1 and will not multiply out to it, so the lease and unit
    // rent are set to amount/1.15 here: the stated figure stays true AND the
    // invoice is internally consistent (rent + VAT = total). Adjusting the rent
    // is the honest direction — inventing a total that does not match its own
    // lines would put a broken invoice on screen.
    const arrearsByLabel = new Map<string, { daysLate: number; amount: number; tenant: string }>();
    for (const a of (p.story?.arrears ?? [])) {
      arrearsByLabel.set(a.unit, { daysLate: a.daysLate, amount: toRands(a.amountCents), tenant: a.tenant });
    }
    for (const [label, a] of arrearsByLabel) {
      const propId = slots.find((x) => x.label === label)?.propertyId ?? '';
      const rentExcl = round2(a.amount / unpaidMonthsFor(a.daysLate) / vatDivisor(propId));
      await q(
        `UPDATE leases SET rent_amount=$3
           WHERE vendor_id=$1 AND unit_id=(SELECT id FROM units WHERE vendor_id=$1 AND label=$2)`,
        [V, label, rentExcl],
      );
      await q(`UPDATE units SET market_rent=$3 WHERE vendor_id=$1 AND label=$2`, [V, label, rentExcl]);
    }

    const leases: { id: string; unitId: string; propertyId: string; tenantId: string; rent: number; label: string; start: string }[] =
      await q(
        `SELECT l.id, l.unit_id AS "unitId", u.property_id AS "propertyId", l.tenant_id AS "tenantId",
                l.rent_amount::float8 AS rent, u.label, l.start_date::text AS start
           FROM leases l JOIN units u ON u.id = l.unit_id
          WHERE l.vendor_id=$1 AND l.status='active'
          ORDER BY u.label`,
        [V],
      );

    // A book in which every invoice outside the story is paid is the tell that
    // the data was generated. `history.arrearsRate` of the other leases carry
    // an unpaid month, a quarter of those two months. Deterministic: drawn from
    // the slug-seeded stream in a fixed lease order.
    const arrearsRate = p.history?.arrearsRate ?? 0.05;

    const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const dueOf = (d: Date) => {
      const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      const day = Math.min(hist.rentDueDayOfMonth, dim);
      return `${ym(d)}-${String(day).padStart(2, '0')}`;
    };
    const todayMs = Date.now();

    // On the first of the month the current invoice is due TODAY, so it is
    // issued rather than late; the arrears window then starts one month back,
    // which keeps "in arrears" true on every day of the month.
    const nowUtc = new Date();
    const curDue = dueOf(new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1)));
    const skipCurrentMonth = skipCurrentMonthFor(curDue, nowUtc);

    const invRows: Row[] = [], payRows: Row[] = [];

    for (const L of leases) {
      const arrears = arrearsByLabel.get(L.label);
      const startMs = Date.parse(`${L.start}T00:00:00Z`);

      // Leases outside the story: most are paid up, a few are behind.
      const roll = arrears ? 1 : rnd();
      const lateMonths = roll < arrearsRate * 0.25 ? 2 : roll < arrearsRate ? 1 : 0;

      for (let back = hist.monthsOfInvoices; back >= 0; back--) {
        const m = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - back, 1));
        // Never invoice a month before the lease began.
        if (Date.parse(`${ym(m)}-01T00:00:00Z`) < startMs) continue;

        const period = ym(m);
        const dueDate = dueOf(m);
        const dueMs = Date.parse(`${dueDate}T00:00:00Z`);
        const rentExcl = round2(L.rent);
        // Residential rent is VAT-exempt: only commercial lets of a registered agency carry it.
        const tax = taxedProps.has(L.propertyId) ? computeTax(rentExcl) : 0;
        const total = round2(rentExcl + tax);
        const daysLate = Math.floor((todayMs - dueMs) / 86400000);

        // Unpaid tail for the two arrears leases: the profile's `daysLate` says
        // how far back the unpaid run starts. Everything older is paid.
        // Unpaid is counted BACK FROM THE NEWEST INVOICE, not measured against
        // the calendar. The old test (`daysLate <= arrears.daysLate`) compared
        // the profile's stated age against a monthly due-date grid, and the two
        // only lined up on one day of the month: seeded on the 14th with rent
        // due on the 1st, the 11-day arrears record had NO unpaid invoice at all
        // — the headline arrears tenant showed a clean account — and the 38-day
        // one showed 13 days. `back` is already the invoice's age in months, so
        // the window is exact on any day: the newest `unpaidMonths` invoices
        // that are actually due are the unpaid ones, and they sum to the
        // profile's stated amount because the rent was set from it above.
        const unpaid = arrears
          ? isArrearsMonthUnpaid(back, unpaidMonthsFor(arrears.daysLate), skipCurrentMonth)
          : lateMonths > 0 && back < lateMonths;
        const invoiceId = randomUUID();
        const postedAt = `${dueDate}T08:00:00Z`;

        const invTxn = post(
          [
            { accountId: accountId.AR, debit: total, entityRef: `lease:${L.id}` },
            { accountId: accountId.RENT_INC, credit: rentExcl },
            ...(tax > 0 ? [{ accountId: accountId.VAT_OUT, credit: tax }] : []),
          ],
          postedAt,
        );

        const status = unpaid ? (daysLate > 0 ? 'overdue' : 'issued') : 'paid';
        invRows.push([
          invoiceId, V, L.id, L.tenantId, period, dueDate, status, total,
          JSON.stringify([
            { kind: 'rent', description: `Rent ${period}`, amount: rentExcl },
            ...(tax > 0 ? [{ kind: 'tax', description: `VAT @ ${VAT_PCT}%`, amount: tax, ...(vatSettings.number ? { vatNumber: vatSettings.number } : {}) }] : []),
          ]),
          invTxn, status === 'overdue',
        ]);
        invoicesMade++;
        if (unpaid && daysLate > 0) arrearsMade++;

        if (status === 'paid') {
          const paymentId = randomUUID();
          // Paid a day or two after the due date, deterministically.
          const paidAt = new Date(dueMs + (1 + Math.floor(rnd() * 2)) * 86400000).toISOString();
          const payTxn = post(
            [
              { accountId: accountId.BANK, debit: total, entityRef: `payment:${paymentId}` },
              { accountId: accountId.AR, credit: total, entityRef: `invoice:${invoiceId}` },
            ],
            paidAt,
          );
          payRows.push([
            paymentId, V, L.tenantId, total, 'eft',
            `seed:${p.slug}:${L.id}:${period}`, 'succeeded', paidAt,
            JSON.stringify([{ invoiceId, amount: total }]), payTxn,
          ]);
          paymentsMade++;
        }
      }
    }

    // ---- batched inserts: ~5.6k invoices and ~28k ledger rows one at a time
    // would take minutes of round trips. Chunked to stay well inside Postgres'
    // 65535-parameter cap.
    await insertMany('invoices',
      ['id','vendor_id','lease_id','tenant_id','period','due_date','status','total','line_items','ledger_txn_id','late_fee_applied'],
      invRows, 'ON CONFLICT (vendor_id,lease_id,period) DO NOTHING');
    await insertMany('payments',
      ['id','vendor_id','tenant_id','amount','method','gateway_ref','status','received_at','allocation','ledger_txn_id'],
      payRows, 'ON CONFLICT (gateway_ref) DO NOTHING');
    await flushLedger();
  }

  // ======================= deposits =======================
  // One deposit per active tenancy, captured into trust at the start of the
  // lease in the shape `DepositService.capture` posts: Dr Trust Bank / Cr Tenant
  // Deposits (trust), both lines carrying the lease. A year of rent with no
  // deposit held anywhere left the trust accounts empty — the first place an
  // agency principal looks. One month's rent, to the nearest R50. No interest is
  // accrued: the rate is the agency's own and nobody has given us one.
  let depositsMade = 0;
  if (Number((await first(`SELECT count(*)::int AS n FROM deposits WHERE vendor_id=$1`, [V])).n) === 0) {
    const tenancies: { id: string; rent: number; start: string }[] = await q(
      `SELECT l.id, l.rent_amount::float8 AS rent, l.start_date::text AS start
         FROM leases l JOIN units u ON u.id = l.unit_id
        WHERE l.vendor_id=$1 AND l.status='active' ORDER BY u.label`,
      [V],
    );
    const depRows: Row[] = [];
    for (const l of tenancies) {
      const amount = Math.round(l.rent / 50) * 50;
      const at = `${l.start}T09:00:00Z`;
      post(
        [
          { accountId: accountId.TRUST_BANK, debit: amount, entityRef: `lease:${l.id}` },
          { accountId: accountId.DEPOSIT_TRUST, credit: amount, entityRef: `lease:${l.id}` },
        ],
        at,
      );
      depRows.push([V, l.id, amount, 'trust:default', 'held', at, at]);
    }
    await insertMany('deposits', ['vendor_id','lease_id','amount','held_in','status','proof_sent_at','created_at'], depRows);
    await flushLedger();
    depositsMade = depRows.length;
  }

  // ======================= owner statements and payouts =======================
  // One statement per owner per COMPLETED month, computed the way
  // `OwnerStatementService.generate` computes it: gross is what succeeded
  // payments ALLOCATED to that owner's invoices in the period (the app's own SQL
  // fragments, imported, not re-written), the figures come from the app's own
  // `computeStatement`, and the posting is its reclassification — Dr Rental
  // Income / Cr Management Fee Income / Cr Owner Payable. Every month but the
  // latest is paid out (Dr Owner Payable / Cr Bank, as `payout` posts); the
  // latest is left finalized and unpaid, which is what the day after a
  // statement run looks like.
  let statementsMade = 0, payoutsMade = 0;
  if (Number((await first(`SELECT count(*)::int AS n FROM owner_statements WHERE vendor_id=$1`, [V])).n) === 0) {
    const nowS = new Date();
    const currentPeriod = `${nowS.getUTCFullYear()}-${String(nowS.getUTCMonth() + 1).padStart(2, '0')}`;
    const collected: { ownerId: string; period: string; gross: number }[] = await q(
      `SELECT pr.owner_id AS "ownerId", i.period, SUM(${ALLOCATED_AMOUNT})::float8 AS gross
       ${ALLOCATED_PAYMENTS_FROM}
         JOIN leases l ON l.id = i.lease_id
         JOIN units u ON u.id = l.unit_id
         JOIN properties pr ON pr.id = u.property_id
        WHERE ${SUCCEEDED_PAYMENT}
          AND pay.vendor_id = $1 AND pr.owner_id IS NOT NULL AND i.period < $2
        GROUP BY pr.owner_id, i.period
        ORDER BY i.period, pr.owner_id`,
      [V, currentPeriod],
    );
    const latest = collected.reduce((m, r) => (r.period > m ? r.period : m), '');
    const stRows: Row[] = [], poRows: Row[] = [];
    for (const r of collected) {
      const f = computeStatement(r.gross, managementFeePct, 0);
      if (f.grossCollected <= 0) continue;
      const [y, m] = r.period.split('-').map(Number);
      // The 3rd of the following month, never in the future.
      const stmtAt = new Date(Math.min(Date.UTC(y, m, 3, 8), nowS.getTime())).toISOString();
      const statementId = randomUUID();
      const txn = post(
        [
          { accountId: accountId.RENT_INC, debit: f.grossCollected, entityRef: `owner:${r.ownerId}` },
          { accountId: accountId.MGMT_FEE, credit: f.managementFee },
          { accountId: accountId.OWNER_PAYABLE, credit: f.netPayout, entityRef: `owner:${r.ownerId}` },
        ],
        stmtAt,
      );
      const paidOut = r.period !== latest;
      stRows.push([statementId, V, r.ownerId, r.period, f.grossCollected, f.managementFee, f.expenses, f.netPayout,
        paidOut ? 'paid_out' : 'finalized', txn, stmtAt]);
      if (paidOut) {
        const paidAt = new Date(Math.min(Date.UTC(y, m, 5, 10), nowS.getTime())).toISOString();
        const ptxn = post(
          [
            { accountId: accountId.OWNER_PAYABLE, debit: f.netPayout, entityRef: `owner:${r.ownerId}` },
            { accountId: accountId.BANK, credit: f.netPayout },
          ],
          paidAt,
        );
        poRows.push([V, r.ownerId, statementId, f.netPayout, `seed:${p.slug}:${r.ownerId}:${r.period}`, 'paid', ptxn, paidAt]);
      }
    }
    await insertMany('owner_statements',
      ['id','vendor_id','owner_id','period','gross_collected','management_fee','expenses','net_payout','status','ledger_txn_id','created_at'],
      stRows, 'ON CONFLICT (vendor_id,owner_id,period) DO NOTHING');
    await insertMany('payouts',
      ['vendor_id','owner_id','statement_id','amount','gateway_ref','status','ledger_txn_id','created_at'],
      poRows, 'ON CONFLICT (gateway_ref) DO NOTHING');
    await flushLedger();
    statementsMade = stRows.length; payoutsMade = poRows.length;
  }

  // ---- the story set: the records that get clicked on screen ----
  let storyMade = 0;
  const unitIdByLabel = async (label: string): Promise<string | null> => {
    const r = await first(`SELECT id FROM units WHERE vendor_id=$1 AND label=$2`, [V, label]);
    return r?.id ?? null;
  };

  for (const m of (p.story?.maintenance ?? [])) {
    const unitId = await unitIdByLabel(m.unit);
    if (!unitId) { console.warn(`  ! maintenance names ${m.unit}, which has no unit — skipped`); continue; }
    const existing = await first(`SELECT id FROM tickets WHERE vendor_id=$1 AND description=$2`, [V, m.title]);
    if (existing) continue;
    const reporter = await first(`SELECT tenant_id FROM leases WHERE vendor_id=$1 AND unit_id=$2 AND status='active'`, [V, unitId]);
    await q(
      `INSERT INTO tickets (vendor_id,unit_id,reporter_id,category,priority,description,status,media,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'[]', now() - ($8 || ' days')::interval)`,
      [V, unitId, reporter?.tenant_id ?? null, 'plumbing',
       m.status === 'open' ? 'high' : 'medium', m.title,
       m.status === 'resolved' ? 'resolved' : 'open', String(m.openedDaysAgo)],
    );
    storyMade++;
  }

  // Lease expiring soon: set the end date rather than inventing a second lease.
  if (p.story?.leaseExpiringSoon) {
    const e = p.story.leaseExpiringSoon;
    const unitId = await unitIdByLabel(e.unit);
    if (unitId) {
      const end = new Date(Date.now() + e.expiresInDays * 86400000).toISOString().slice(0, 10);
      await q(
        `UPDATE leases SET end_date=$3 WHERE vendor_id=$1 AND unit_id=$2 AND status='active'`,
        [V, unitId, end],
      );
    }
  }

  // New lease awaiting signature: a `sent` lease_agreement against a draft
  // lease on the vacant unit the profile names. No e-sign provider is involved
  // — the row is what the back office lists as outstanding.
  if (p.story?.newLeaseAwaitingSignature) {
    const n = p.story.newLeaseAwaitingSignature;
    const unitId = await unitIdByLabel(n.unit);
    if (unitId) {
      const ref = `${p.slug}-awaiting-signature`;
      const already = await first(`SELECT id FROM lease_agreements WHERE ref=$1`, [ref]);
      if (!already) {
        const tenantId = await user(n.tenant, `${n.tenant.split(' ')[0].toLowerCase()}@${emailDomain}`, nextPhone());
        await membership(tenantId, 'tenant');
        const rentRow = await first(`SELECT market_rent::float8 AS rent FROM units WHERE id=$1`, [unitId]);
        const start = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        const lease = await first(
          `INSERT INTO leases (vendor_id,unit_id,tenant_id,type,status,start_date,rent_amount,billing_cycle)
           VALUES ($1,$2,$3,'fixed','draft',$4,$5,'monthly') RETURNING id`,
          [V, unitId, tenantId, start, rentRow.rent],
        );
        await q(
          `INSERT INTO lease_agreements (vendor_id,lease_id,tenant_id,ref,file_url,render_data,status,created_at)
           VALUES ($1,$2,$3,$4,$5,'{}'::jsonb,'sent', now() - ($6 || ' days')::interval)`,
          [V, lease.id, tenantId, ref, `/media/${ref}.pdf`, String(n.sentDaysAgo)],
        );
        storyMade++;
      }
    }
  }

  console.log(`\n${p.agency.name} seeded (slug ${p.slug}, vendor ${V})`);
  console.log(`  tier      : ${p.subscription.tier}, ${p.subscription.units} units, status ${p.subscription.status}${mrr ? `, mrr ${mrr}` : ' — no rate set (CUSTOM_UNIT_RATE unset)'}`);
  console.log(`  buildings : ${p.portfolio.buildings.length}`);
  console.log(`  mgmt fee  : ${(managementFeePct * 100).toFixed(2)}% on every owner${p.agency.managementFeeConfirmed === true ? '' : ' — PLACEHOLDER, not given by the client'}`);
  console.log(`  owners    : ${ownerNames.length}, covering ${ownerIdByBuilding.size} of ${p.portfolio.buildings.length} buildings (banking fictional, encrypted with the PII key now in effect)`);
  console.log(`  units     : ${slots.length} (${created} created this run), ${occupy.size} occupied`);
  console.log(`  leases    : ${leased} created this run`);
  console.log(`  invoices  : ${invoicesMade} created this run (${arrearsMade} overdue), through the ledger`);
  console.log(`  payments  : ${paymentsMade} created this run`);
  console.log(`  deposits  : ${depositsMade} captured into trust this run`);
  console.log(`  statements: ${statementsMade} owner statements created this run, ${payoutsMade} paid out`);
  console.log(`  ledger    : ${ledgerRows} entries, every transaction assertBalanced()`);
  console.log(`  story     : ${storyMade} records created this run`);
  for (const a of (p.story?.arrears ?? [])) {
    const r = await first(
      `SELECT count(*)::int AS n, COALESCE(sum(i.total),0)::float8 AS owed,
              COALESCE(max(CURRENT_DATE - i.due_date),0)::int AS oldest
         FROM invoices i JOIN units u ON u.id = (SELECT unit_id FROM leases WHERE id = i.lease_id)
        WHERE i.vendor_id=$1 AND u.label=$2 AND i.status IN ('overdue','issued')`,
      [V, a.unit],
    );
    console.log(
      `  arrears   : ${a.unit} — ${r.n} unpaid, R${r.owed} owed (profile says R${toRands(a.amountCents)}), oldest ${r.oldest} days late (profile says ${a.daysLate})`,
    );
  }
  console.log(`  staff     : ${p.people.staff.map((s) => s.email).join(', ')}`);
  console.log(`  landlord  : ${p.people.landlordDemoAccount.email}`);
  console.log(`  tenant    : ${p.people.tenantDemoAccount.email} (${p.people.tenantDemoAccount.unit})`);
  console.log(`\n  Logins are passwordless OTP — request a code and read it off the API console or Mailpit.\n`);

  await dataSource.destroy();
}

main().catch(async (e) => {
  console.error(e);
  try { await dataSource.destroy(); } catch { /* already down */ }
  process.exit(1);
});
