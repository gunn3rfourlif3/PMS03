/** Pure reporting helpers (no DB): collection rate + arrears aging buckets. */
export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

/** Collection rate as a 2-dp percentage of billed that was collected. */
export function collectionRate(billed: number, collected: number): number {
  if (billed <= 0) return 0;
  return Math.round((collected / billed) * 10000) / 100;
}

/** Map days-overdue to an aging bucket. */
export function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 30) return '0-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}
