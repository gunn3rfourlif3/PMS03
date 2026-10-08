/**
 * The recovery gap — pure, so the number an agency argues with the municipality
 * about is unit-testable without a database.
 *
 * Bulk reading minus the sum of the submeters under it. That difference is
 * common-area usage, losses and leaks: what the agency paid for and did not
 * recover. It is the whole reason bulk and submeters are modelled separately.
 */

export interface GapRow {
  propertyId: string;
  propertyName?: string;
  kind: string;
  period: string;
  /** From the property's bulk meter. Null when no bulk reading exists. */
  bulkConsumption: number | null;
  bulkCost: number | null;
  /** Summed across the submeters in that property. */
  subConsumption: number | null;
  subCost: number | null;
  subMeters: number;
}

export interface GapResult extends GapRow {
  /** bulk - submeters, in units. Null when either side is missing. */
  gapConsumption: number | null;
  gapCost: number | null;
  /** Gap as a share of the bulk reading, 0-100. Null when bulk is absent or zero. */
  gapPct: number | null;
  /** Why a gap could not be computed, for a row that shows a dash rather than a number. */
  note?: string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * A gap needs both sides. Treating a missing bulk reading as zero would report
 * the entire submetered total as a surplus; treating missing submeters as zero
 * would report the entire bulk as a loss. Both are worse than "not known".
 */
export function computeGap(row: GapRow): GapResult {
  const bulk = row.bulkConsumption;
  const sub = row.subConsumption;

  let note: string | undefined;
  if (bulk === null || bulk === undefined) note = 'No bulk reading for this period';
  else if (sub === null || sub === undefined) note = 'No submeter readings for this period';

  const gapConsumption = note ? null : round2(Number(bulk) - Number(sub));
  const gapCost =
    row.bulkCost === null || row.bulkCost === undefined || row.subCost === null || row.subCost === undefined
      ? null
      : round2(Number(row.bulkCost) - Number(row.subCost));

  // Zero bulk is a real reading, but a percentage of zero is not a number.
  const gapPct =
    gapConsumption === null || !Number(bulk) ? null : round2((gapConsumption / Number(bulk)) * 100);

  return { ...row, gapConsumption, gapCost, gapPct, note };
}

export function computeGaps(rows: GapRow[]): GapResult[] {
  return (rows ?? []).map(computeGap);
}

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // A property called "Smith, J" would otherwise split into two columns.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The first thing an agency does with this is check it against the municipal bill. */
export function gapsToCsv(rows: GapResult[]): string {
  const header = [
    'Property', 'Utility', 'Period',
    'Bulk usage', 'Submeter usage', 'Gap usage', 'Gap %',
    'Bulk cost', 'Submeter cost', 'Gap cost',
    'Submeters', 'Note',
  ];
  const lines = rows.map((r) =>
    [
      r.propertyName ?? r.propertyId, r.kind, r.period,
      r.bulkConsumption, r.subConsumption, r.gapConsumption, r.gapPct,
      r.bulkCost, r.subCost, r.gapCost,
      r.subMeters, r.note ?? '',
    ].map(csvCell).join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
