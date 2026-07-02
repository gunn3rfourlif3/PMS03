/** Pure helper: the 'YYYY-MM' billing period an expense date falls in. */
export function expensePeriod(incurredOn: string): string {
  // incurredOn is 'YYYY-MM-DD'; period is the leading 'YYYY-MM'.
  return incurredOn.slice(0, 7);
}
