/**
 * Pure owner-statement math. No DB/framework deps.
 * net = gross rent collected - management fee - owner-billable expenses.
 */
const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface StatementFigures {
  grossCollected: number;
  managementFee: number;
  expenses: number;
  netPayout: number;
}

export function computeStatement(
  grossCollected: number,
  managementFeePct: number,
  expenses = 0,
): StatementFigures {
  const gross = round2(grossCollected);
  const managementFee = round2(gross * managementFeePct);
  const exp = round2(Math.max(0, expenses));
  const netPayout = round2(Math.max(0, gross - managementFee - exp));
  return { grossCollected: gross, managementFee, expenses: exp, netPayout };
}
