/**
 * Pure world-generation helpers for the prospect seeder (`seed-prospect.ts`).
 *
 * These live apart from the seeder for one reason: the seeder needs a database,
 * so nothing in it can be unit-tested, and the two bugs that reached a demo were
 * both pure arithmetic — an arrears window measured against the calendar instead
 * of its own invoice grid, and vacancy filled in list order so the last
 * buildings emptied completely. `test/demo-world.spec.ts` covers both and needs
 * no Postgres.
 *
 * Nothing here touches the database, the clock (the caller passes `now`) or the
 * profile's shape beyond the minimum each function states.
 */

/** mulberry32, seeded off a string so a generated world is stable per profile. */
export function prng(seed: string): () => number {
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

/**
 * How many months of rent an arrears record of `daysLate` days represents.
 * A month is 30 days here: 11 days behind is one unpaid invoice, 38 days two.
 * The profile's stated outstanding amount is divided across them, so the figure
 * on screen matches the profile whatever the date.
 */
export const unpaidMonthsFor = (daysLate: number): number => Math.max(1, Math.ceil(daysLate / 30));

/**
 * 1 when the current month's invoice is not yet OVERDUE, so the arrears window
 * starts one month further back.
 *
 * "Not yet overdue", not "not yet due": on the due day itself the invoice is 0
 * days late and renders as issued — true, but not the arrears record the demo
 * script opens. Compared at UTC midnight so the whole due day counts.
 */
export function skipCurrentMonthFor(currentDueIso: string, now: Date): number {
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Date.parse(`${currentDueIso}T00:00:00Z`) >= startOfToday ? 1 : 0;
}

/**
 * Whether the invoice `back` months old is one of an arrears record's unpaid
 * ones. Counted BACK FROM THE NEWEST INVOICE, never measured against the
 * calendar: the old test compared the profile's stated age in days against a
 * monthly due-date grid, and the two only lined up on one day of the month —
 * seeded on the 14th with rent due on the 1st, an 11-day arrears record had no
 * unpaid invoice at all.
 */
export function isArrearsMonthUnpaid(back: number, unpaidMonths: number, skipCurrentMonth: number): boolean {
  return back >= skipCurrentMonth && back < unpaidMonths + skipCurrentMonth;
}

/**
 * Which unit labels are left vacant, apportioned ACROSS the buildings by
 * largest remainder rather than taken off the end of the slot list.
 *
 * Filling occupancy in list order emptied the last buildings completely: at 94%
 * of 500 units every vacancy landed in the final two buildings, leaving one of
 * them 0/16 — and that was a building the demo landlord account owns, so the
 * owner portal opened on screen showed a landlord whose houses were all empty.
 *
 * `reserved` slots are the story's and always stay occupied. `alwaysVacant` (the
 * unit whose lease is awaiting signature) counts toward the portfolio's vacancy
 * rather than adding to it. `rnd` should be a stream of its own: the caller's
 * main stream draws rents and names, and shifting it changes the whole world.
 */
export function apportionVacancy<T extends { label: string; reserved: boolean }>(opts: {
  buildings: { name: string }[];
  slots: T[];
  vacancyRate: number;
  totalVacant: number;
  alwaysVacant?: string | null;
  rnd: () => number;
}): Set<string> {
  const { buildings, slots, vacancyRate, totalVacant, alwaysVacant, rnd } = opts;
  const vacant = new Set<string>(alwaysVacant ? [alwaysVacant] : []);

  const buckets = buildings.map((b) => {
    const mine = slots.filter((s) => s.label.startsWith(b.name + ' '));
    const vacatable = mine.filter((s) => !s.reserved);
    for (let i = vacatable.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [vacatable[i], vacatable[j]] = [vacatable[j], vacatable[i]];
    }
    const exact = mine.length * vacancyRate;
    return { name: b.name, vacatable, base: Math.floor(exact), frac: exact - Math.floor(exact), take: 0 };
  });

  let toPlace = totalVacant - vacant.size;
  for (const bk of buckets) {
    bk.take = Math.min(bk.base, bk.vacatable.length, Math.max(0, toPlace));
    toPlace -= bk.take;
  }
  // Leftovers to the largest fractional shares first; name breaks ties so the
  // result does not depend on sort stability.
  for (const bk of [...buckets].sort((a, b) => b.frac - a.frac || a.name.localeCompare(b.name))) {
    if (toPlace <= 0) break;
    if (bk.take < bk.vacatable.length) { bk.take++; toPlace--; }
  }
  for (const bk of buckets) for (const s of bk.vacatable.slice(0, bk.take)) vacant.add(s.label);
  return vacant;
}

/**
 * Every first-name x last-name combination, shuffled, minus the names the
 * profile already gives to someone. Names are DRAWN WITHOUT REPLACEMENT.
 *
 * The seeder used to draw a first and a last name independently per tenant.
 * 470 draws from 900 combinations is a birthday problem: 165 of 476 people
 * shared a name with someone else, one name appeared four times, and two
 * collided with the story — a second "Kagiso Sithole" beside the tenant whose
 * lease is awaiting signature, and a tenant with the property manager's name.
 * Searching for a story record in front of a prospect and getting two is the
 * failure; a list with the same name four times is the tell.
 */
export function uniqueNames(first: string[], last: string[], rnd: () => number, exclude: Iterable<string> = []): string[] {
  const taken = new Set([...exclude].map((n) => n.trim().toLowerCase()));
  const all: string[] = [];
  for (const f of first) for (const l of last) {
    const n = `${f} ${l}`;
    if (!taken.has(n.toLowerCase())) all.push(n);
  }
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}
