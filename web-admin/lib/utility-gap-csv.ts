/**
 * CSV for the recovery-gap table.
 *
 * Built in the browser from the JSON the page already has, rather than as a
 * second server endpoint: the rows are already fetched, and a download route
 * would need its own auth and content-type handling for no extra correctness.
 *
 * Kept in step with `src/modules/utilities/utility-gap.ts`, which holds the
 * server-side copy and its spec.
 */
const cell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // A property called "Smith, J" would otherwise split into two columns.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function gapsToCsv(rows: any[]): string {
  const header = [
    'Property', 'Utility', 'Period',
    'Bulk usage', 'Submeter usage', 'Gap usage', 'Gap %',
    'Bulk cost', 'Submeter cost', 'Gap cost',
    'Submeters', 'Note',
  ];
  const lines = (rows ?? []).map((r) =>
    [
      r.propertyName ?? r.propertyId, r.kind, r.period,
      r.bulkConsumption, r.subConsumption, r.gapConsumption, r.gapPct,
      r.bulkCost, r.subCost, r.gapCost,
      r.subMeters, r.note ?? '',
    ].map(cell).join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
