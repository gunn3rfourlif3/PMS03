import { InvoiceLineItem } from './invoice.entity';
import { TaxProfile } from '@providers/policy/policy.interfaces';

/**
 * Pure invoice math (no DB/framework) so pricing + tax is unit-testable.
 *
 * Convention: rent and other charges are treated as tax-EXCLUSIVE; the tax
 * profile computes the tax line. Swap to inclusive per market later if needed.
 */

export interface RentInvoiceParts {
  lineItems: InvoiceLineItem[];
  total: number;
}

export interface ChargeInput {
  kind: 'rent' | 'utility' | 'levy' | 'late_fee';
  description: string;
  amount: number; // tax-exclusive, major units
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface Proration {
  amount: number;       // pro-rated rent for the first month
  days: number;         // days charged (start day .. month end, inclusive)
  daysInMonth: number;
  prorated: boolean;    // false when the lease starts on the 1st (full month)
}

/**
 * Pro-rata a first month's rent when a lease starts mid-month: charge for the
 * days from the start date to month-end (inclusive). A start on the 1st bills a
 * full month.
 */
export function prorateFirstMonth(rentAmount: number, startDate: string): Proration {
  const d = new Date(`${startDate}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  if (!Number.isFinite(day) || day <= 1) {
    return { amount: round2(rentAmount), days: daysInMonth, daysInMonth, prorated: false };
  }
  const days = daysInMonth - day + 1;
  return { amount: round2((rentAmount * days) / daysInMonth), days, daysInMonth, prorated: true };
}

export function buildRentInvoice(
  charges: ChargeInput[],
  tax: TaxProfile,
): RentInvoiceParts {
  const lineItems: InvoiceLineItem[] = charges.map((c) => ({
    kind: c.kind,
    description: c.description,
    amount: round2(c.amount),
  }));

  const taxable = charges.reduce((s, c) => s + c.amount, 0);
  const taxAmount = round2(tax.computeTax(taxable));
  if (taxAmount > 0) {
    lineItems.push({
      kind: 'tax',
      description: `${tax.key} @ ${tax.ratePct}%`,
      amount: taxAmount,
    });
  }

  const total = round2(lineItems.reduce((s, li) => s + li.amount, 0));
  return { lineItems, total };
}
