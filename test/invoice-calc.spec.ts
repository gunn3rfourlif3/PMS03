import { buildRentInvoice, vatApplies } from '../src/modules/billing/invoice-calc';
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

describe('VAT applicability (residential rent is exempt, s12(c))', () => {
  const reg = { registered: true };
  it.each([
    [reg, { commercial: true }, true],
    [reg, { commercial: false }, false],
    [reg, {}, false],
    [reg, null, false],
    [{ registered: false }, { commercial: true }, false],
    [null, { commercial: true }, false],
    [{ registered: 'true' }, { commercial: true }, false],
    [reg, { commercial: 'true' }, false],
  ])('vatApplies(%j, %j) → %s', (vat, attrs, expected) => {
    expect(vatApplies(vat as any, attrs as any)).toBe(expected);
  });

  it('no tax profile → rent only, no tax line', () => {
    const r = buildRentInvoice([{ kind: 'rent', description: 'Rent', amount: 10000 }], null);
    expect(r.lineItems.map((l) => l.kind)).toEqual(['rent']);
    expect(r.total).toBe(10000);
  });

  it('carries the VAT number on the tax line', () => {
    const r = buildRentInvoice([{ kind: 'rent', description: 'Rent', amount: 10000 }], new ZaVatTaxProfile(), {
      vatNumber: '4123456789',
    });
    const tax = r.lineItems.find((l) => l.kind === 'tax')!;
    expect(tax).toMatchObject({ amount: 1500, description: 'VAT @ 15%', vatNumber: '4123456789' });
    expect(r.total).toBe(11500);
  });
});
