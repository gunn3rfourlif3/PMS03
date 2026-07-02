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
