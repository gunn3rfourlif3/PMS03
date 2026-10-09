/**
 * What a tenant is charged for their utilities — pure, so the figure that lands
 * on an invoice is testable without a database.
 *
 * DECIDED 2026-10-08: actual cost, passed through. The tenant is charged
 * exactly what their readings cost, with no margin. It is the easiest position
 * to defend when a tenant queries a charge, and the only one that needs no
 * separate disclosure.
 *
 * ONLY SUBMETERS. A bulk meter's cost is the landlord's: recovering it from one
 * tenant would charge them for the whole building. The caller passes submeter
 * readings; this refuses anything else rather than trusting it was filtered.
 *
 * VAT IS NOT APPLIED HERE. The charge is produced tax-EXCLUSIVE and goes
 * through `buildRentInvoice`, which computes tax the same way it does for rent.
 * Adding VAT here would double it. Whether a pass-through recovery should carry
 * VAT at all is a question for whoever does the agency's returns, and it is
 * flagged as an open item rather than answered in code.
 */

export interface RecoverableReading {
  id: string;
  meterId: string;
  /** A submeter has a unit. A bulk meter has none, and is refused. */
  unitId?: string | null;
  kind: string;
  readingDate: string;
  consumption: number | null;
  cost: number | null;
  estimated: boolean;
}

export interface RecoveryLine {
  kind: 'utility';
  description: string;
  /** Tax-exclusive, in rands. */
  amount: number;
  readingIds: string[];
}

export type RecoverySkip = {
  readingId: string;
  reason: 'bulk_meter' | 'no_cost' | 'zero_cost' | 'baseline';
};

export interface RecoveryResult {
  lines: RecoveryLine[];
  skipped: RecoverySkip[];
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const LABEL: Record<string, string> = {
  electricity: 'Electricity', water: 'Water', gas: 'Gas',
  sewerage: 'Sewerage', refuse: 'Refuse',
};

/**
 * Turn a period's readings into invoice lines, one per utility.
 *
 * Grouped by utility rather than one line per reading: a tenant's invoice
 * should say "Water" and an amount, not list four meter captures. The reading
 * ids travel with the line so the charge can be traced back.
 *
 * An estimated reading IS recovered, but the description says so — the
 * alternative is not billing until someone walks the building, which is how
 * three months of charges arrive at once.
 */
export function buildRecoveryLines(
  readings: RecoverableReading[],
  period: string,
): RecoveryResult {
  const skipped: RecoverySkip[] = [];
  const byKind = new Map<string, { amount: number; ids: string[]; estimated: boolean }>();

  for (const r of readings ?? []) {
    if (!r) continue;
    if (!r.unitId) { skipped.push({ readingId: r.id, reason: 'bulk_meter' }); continue; }
    if (r.cost === null || r.cost === undefined) {
      // A reading with usage but no cost cannot be recovered: there is no figure
      // to charge, and inventing one from a tariff nobody entered is worse.
      skipped.push({ readingId: r.id, reason: r.consumption === null ? 'baseline' : 'no_cost' });
      continue;
    }
    const cost = Number(r.cost);
    if (!(cost > 0)) { skipped.push({ readingId: r.id, reason: 'zero_cost' }); continue; }

    const cur = byKind.get(r.kind) ?? { amount: 0, ids: [], estimated: false };
    cur.amount += cost;
    cur.ids.push(r.id);
    cur.estimated = cur.estimated || !!r.estimated;
    byKind.set(r.kind, cur);
  }

  const lines: RecoveryLine[] = [...byKind.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([kind, v]) => ({
      kind: 'utility' as const,
      description: `${LABEL[kind] ?? kind} ${period}${v.estimated ? ' (estimated reading)' : ''}`,
      amount: round2(v.amount),
      readingIds: v.ids,
    }));

  return { lines, skipped, total: round2(lines.reduce((s, l) => s + l.amount, 0)) };
}
