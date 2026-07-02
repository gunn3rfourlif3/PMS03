import { buildRentInvoice } from '../src/modules/billing/invoice-calc';
import { ZaVatTaxProfile } from '../src/providers/policy/za/za-vat.tax';

describe('rent invoice calc (ZA VAT)', () => {
  const tax = new ZaVatTaxProfile();

  it('adds a 15% VAT line and totals correctly', () => {
    const { lineItems, total } = buildRentInvoice(
      [{ kind: 'rent', description: 'Rent 2026-07', amount: 10000 }],
      tax,
    );
    expect(lineItems.find((l) => l.kind === 'rent')!.amount).toBe(10000);
    expect(lineItems.find((l) => l.kind === 'tax')!.amount).toBe(1500);
    expect(total).toBe(11500);
  });

  it('produces a ledger-balanceable total (rent + tax = total)', () => {
    const { lineItems, total } = buildRentInvoice(
      [{ kind: 'rent', description: 'r', amount: 7333.33 }],
      tax,
    );
    const sum = lineItems.reduce((s, l) => s + l.amount, 0);
    expect(Math.round(sum * 100)).toBe(Math.round(total * 100));
  });
});
