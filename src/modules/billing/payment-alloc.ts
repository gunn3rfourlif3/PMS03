/**
 * Pure helpers for payment allocation + late fees (no DB/framework) so the
 * money math is unit-testable. All amounts in major units; rounded to cents.
 */
import { InvoiceStatus } from './invoice.entity';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Given an invoice total, how much was already paid, and a new payment amount,
 * return the new paid-to-date and the resulting invoice status.
 */
export function applyPayment(
  invoiceTotal: number,
  alreadyPaid: number,
  paymentAmount: number,
): { paidToDate: number; status: InvoiceStatus } {
  const paidToDate = round2(alreadyPaid + paymentAmount);
  const totalC = Math.round(invoiceTotal * 100);
  const paidC = Math.round(paidToDate * 100);
  let status: InvoiceStatus;
  if (paidC <= 0) status = 'issued';
  else if (paidC < totalC) status = 'partly_paid';
  else status = 'paid';
  return { paidToDate, status };
}

/** One-time late fee = percentage of the outstanding balance. */
export function lateFee(outstanding: number, pct: number): number {
  return round2(Math.max(0, outstanding) * pct);
}
