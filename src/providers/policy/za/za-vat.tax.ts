import { TaxProfile } from '../policy.interfaces';

/** South African VAT (15%). */
export class ZaVatTaxProfile implements TaxProfile {
  readonly key = 'ZA_VAT';
  readonly ratePct = 15;
  computeTax(amountExclTax: number): number {
    return +(amountExclTax * (this.ratePct / 100)).toFixed(2);
  }
}
