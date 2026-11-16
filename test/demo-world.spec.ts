import {
  apportionVacancy,
  isArrearsMonthUnpaid,
  prng,
  skipCurrentMonthFor,
  uniqueNames,
  unpaidMonthsFor,
} from '../scripts/demo-world';

/**
 * Regression cover for the two bugs that reached the Midnight Masquerade demo.
 * Both were pure arithmetic in the prospect seeder, which needs a database and
 * so could not be tested at all until these functions were lifted out of it.
 * No Postgres required.
 */

// The profile's two arrears records, in the profile's own terms.
const LERATO = { daysLate: 11, amountCents: 1180000 };
const JASON = { daysLate: 38, amountCents: 1890000 };
const VAT_PCT = 15;
const round2 = (n: number) => Math.round(n * 100) / 100;
const computeTax = (exclTax: number) => +(exclTax * (VAT_PCT / 100)).toFixed(2);
const toRands = (cents: number) => Math.round(cents / 100);

/** What the back office would show for one arrears record, seeded on `today`. */
function arrearsOnScreen(rec: { daysLate: number; amountCents: number }, today: Date) {
  const amount = toRands(rec.amountCents);
  const unpaidMonths = unpaidMonthsFor(rec.daysLate);
  // The seeder sets the rent so that each unpaid invoice is an equal share of
  // the stated total and reconciles to its own lines.
  const rentExcl = round2(amount / unpaidMonths / (1 + VAT_PCT / 100));
  const total = round2(rentExcl + computeTax(rentExcl));

  const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const dueIso = (back: number) => {
    const m = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
    return `${ym(m)}-01`; // the profile's rentDueDayOfMonth
  };
  const skip = skipCurrentMonthFor(dueIso(0), today);

  let unpaid = 0, overdue = 0, owed = 0, oldestDaysLate = -1;
  for (let back = 12; back >= 0; back--) {
    if (!isArrearsMonthUnpaid(back, unpaidMonths, skip)) continue;
    const daysLate = Math.floor((today.getTime() - Date.parse(`${dueIso(back)}T00:00:00Z`)) / 86400000);
    unpaid++;
    owed = round2(owed + total);
    if (daysLate > 0) overdue++;
    oldestDaysLate = Math.max(oldestDaysLate, daysLate);
  }
  return { unpaid, overdue, owed, oldestDaysLate, stated: amount };
}

/** Every day across two months, plus the February/March month-length edges. */
const DAYS: Date[] = [];
for (let i = 0; i < 70; i++) DAYS.push(new Date(Date.UTC(2026, 10, 1 + i, 9, 0, 0)));
for (const iso of ['2027-02-28', '2027-03-01', '2027-03-31', '2028-02-29']) {
  DAYS.push(new Date(`${iso}T09:00:00Z`));
}

describe('arrears window', () => {
  it('turns a stated age in days into whole unpaid months', () => {
    expect(unpaidMonthsFor(11)).toBe(1);
    expect(unpaidMonthsFor(38)).toBe(2);
    expect(unpaidMonthsFor(0)).toBe(1); // never zero: an arrears record must show something
    expect(unpaidMonthsFor(90)).toBe(3);
  });

  it('treats the due day itself as not yet overdue, so the window moves back', () => {
    // Rent due on the 1st, seeded on the 1st: the current invoice is issued,
    // not late, so the arrears sit in the month before.
    expect(skipCurrentMonthFor('2026-12-01', new Date('2026-12-01T09:00:00Z'))).toBe(1);
    expect(skipCurrentMonthFor('2026-12-01', new Date('2026-12-02T09:00:00Z'))).toBe(0);
  });

  // The bug: on 2026-11-14 the 11-day record had no unpaid invoice at all, and
  // the 38-day record showed 13 days. It held on exactly one day per month.
  it.each(DAYS.map((d) => [d.toISOString().slice(0, 10), d] as const))(
    'both records are overdue and owe exactly the stated amount on %s',
    (_iso, today) => {
      for (const rec of [LERATO, JASON]) {
        const s = arrearsOnScreen(rec, today);
        expect(s.unpaid).toBeGreaterThanOrEqual(1);
        expect(s.overdue).toBeGreaterThanOrEqual(1);
        expect(s.owed).toBeCloseTo(s.stated, 2);
      }
    },
  );

  it('keeps the two records in the order the demo script narrates them', () => {
    for (const today of DAYS) {
      const a = arrearsOnScreen(LERATO, today);
      const b = arrearsOnScreen(JASON, today);
      // "in arrears" and "further behind": Jason is always the older and larger.
      expect(b.oldestDaysLate).toBeGreaterThan(a.oldestDaysLate);
      expect(b.owed).toBeGreaterThan(a.owed);
    }
  });
});

describe('vacancy apportionment', () => {
  const BUILDINGS = [
    { name: 'Masquerade Heights', units: 96 }, { name: 'The Carnival', units: 84 },
    { name: 'Harlequin Court', units: 72 }, { name: 'Domino Place', units: 60 },
    { name: 'Venetian Mews', units: 48 }, { name: 'Columbine Lofts', units: 40 },
    { name: 'Pierrot Gardens', units: 36 }, { name: 'Bauta Villas', units: 28 },
    { name: 'Scaramouche Row', units: 20 }, { name: 'Volto Street Houses', units: 16 },
  ];
  const RESERVED = [
    'Masquerade Heights 304', 'The Carnival 212', 'Harlequin Court 7B',
    'Domino Place 15', 'Pierrot Gardens 4', 'Columbine Lofts 22',
  ];
  const AWAITING = 'Columbine Lofts 22';
  const LANDLORD_OWNS = ['Venetian Mews', 'Volto Street Houses'];

  const build = () => {
    const slots: { label: string; reserved: boolean }[] = [];
    for (const b of BUILDINGS) {
      const res = RESERVED.filter((r) => r.startsWith(b.name + ' '));
      for (const r of res) slots.push({ label: r, reserved: true });
      for (let i = res.length; i < b.units; i++) slots.push({ label: `${b.name} ${i}`, reserved: false });
    }
    return slots;
  };

  const run = (occupancyRate: number) => {
    const slots = build();
    const target = Math.round(slots.length * occupancyRate);
    const vacant = apportionVacancy({
      buildings: BUILDINGS, slots, vacancyRate: 1 - occupancyRate,
      totalVacant: slots.length - target, alwaysVacant: AWAITING,
      rnd: prng('midnight-masquerade:occupancy'),
    });
    return { slots, target, vacant };
  };

  it('hits the profile occupancy exactly', () => {
    const { slots, target, vacant } = run(0.94);
    expect(slots.length - vacant.size).toBe(target);
  });

  // The bug: vacancy taken off the end of the list left Volto Street Houses
  // 0/16 occupied — and the demo landlord account owns it.
  it('leaves no building more than twice the portfolio vacancy rate empty', () => {
    const { slots, vacant } = run(0.94);
    for (const b of BUILDINGS) {
      const mine = slots.filter((s) => s.label.startsWith(b.name + ' '));
      const empty = mine.filter((s) => vacant.has(s.label)).length;
      expect(empty / mine.length).toBeLessThanOrEqual(0.06 * 2);
    }
  });

  it('never strips a building the demo landlord owns', () => {
    const { slots, vacant } = run(0.94);
    for (const name of LANDLORD_OWNS) {
      const mine = slots.filter((s) => s.label.startsWith(name + ' '));
      expect(mine.some((s) => !vacant.has(s.label))).toBe(true);
    }
  });

  it('keeps the story units occupied, except the one awaiting signature', () => {
    const { vacant } = run(0.94);
    for (const label of RESERVED) {
      expect(vacant.has(label)).toBe(label === AWAITING);
    }
  });

  it('is deterministic — the same profile seeds the same world', () => {
    expect([...run(0.94).vacant].sort()).toEqual([...run(0.94).vacant].sort());
  });

  it('still apportions at a much lower occupancy', () => {
    const { slots, target, vacant } = run(0.7);
    expect(slots.length - vacant.size).toBe(target);
    const volto = slots.filter((s) => s.label.startsWith('Volto Street Houses '));
    expect(volto.some((s) => !vacant.has(s.label))).toBe(true);
  });
});

describe('generated names', () => {
  const FIRST = ['Lerato', 'Thabo', 'Kagiso', 'Jason', 'Michelle', 'Sipho'];
  const LAST = ['Mokoena', 'Nkosi', 'Sithole', 'Pillay', 'Adams', 'Dlamini'];
  // The people the profile names: story tenants, and a staff member.
  const PROFILE = ['Lerato Mokoena', 'Jason Pillay', 'Kagiso Sithole', 'Thabo Nkosi'];

  // The bug: first and last names drawn independently per tenant. 165 of 476
  // people shared a name, and two collided with the story — a second "Kagiso
  // Sithole", and a tenant with the property manager's name.
  it('never repeats a name', () => {
    const names = uniqueNames(FIRST, LAST, prng('x:names'));
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(FIRST.length * LAST.length);
  });

  it('never hands out a name the profile already gave to someone', () => {
    const names = uniqueNames(FIRST, LAST, prng('x:names'), PROFILE);
    for (const taken of PROFILE) expect(names).not.toContain(taken);
    expect(names).toHaveLength(FIRST.length * LAST.length - PROFILE.length);
  });

  it('matches excluded names regardless of case or stray spaces', () => {
    expect(uniqueNames(FIRST, LAST, prng('x'), ['  lerato MOKOENA '])).not.toContain('Lerato Mokoena');
  });

  it('is deterministic for a seed and differs between seeds', () => {
    expect(uniqueNames(FIRST, LAST, prng('a'))).toEqual(uniqueNames(FIRST, LAST, prng('a')));
    expect(uniqueNames(FIRST, LAST, prng('a'))).not.toEqual(uniqueNames(FIRST, LAST, prng('b')));
  });
});
