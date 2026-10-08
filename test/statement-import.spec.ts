import {
  matchStatement, matchSummary, StatementLine, OpenInvoice, AMOUNT_MATCH_WINDOW_DAYS,
} from '../src/providers/payment/statement-import';
import { payerReference, beneficiaryReference } from '../src/providers/payment/stitch-refs';

const INV_A = '11111111-1111-4111-8111-111111111111';
const INV_B = '22222222-2222-4222-8222-222222222222';

const inv = (id: string, outstanding: number, dueDate = '2026-10-01'): OpenInvoice =>
  ({ id, outstanding, dueDate, tenantId: `t-${id.slice(0, 4)}` });

const line = (p: Partial<StatementLine>): StatementLine =>
  ({ id: 'L1', date: '2026-10-02', amount: 8500, ...p });

describe('matching by reference', () => {
  it('matches a line quoting the payer reference', () => {
    const r = matchStatement([line({ reference: payerReference(INV_A) })], [inv(INV_A, 8500)]);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].basis).toBe('reference');
    expect(r.matched[0].invoice.id).toBe(INV_A);
  });

  it('matches the beneficiary reference too, and ignores the bank’s punctuation', () => {
    const ref = beneficiaryReference(INV_A);
    const r = matchStatement(
      [line({ description: `EFT  ${ref.slice(0, 6)}-${ref.slice(6)}  CREDIT` })],
      [inv(INV_A, 8500)],
    );
    expect(r.matched).toHaveLength(1);
  });

  // A reference beats an amount: the payer said which invoice they meant.
  it('prefers the reference even when another invoice matches the amount', () => {
    const r = matchStatement(
      [line({ reference: payerReference(INV_B), amount: 8500 })],
      [inv(INV_A, 8500), inv(INV_B, 8500)],
    );
    expect(r.matched[0].invoice.id).toBe(INV_B);
  });

  it('does not match a second line to an invoice already claimed', () => {
    const ref = payerReference(INV_A);
    const r = matchStatement(
      [line({ id: 'L1', reference: ref }), line({ id: 'L2', reference: ref })],
      [inv(INV_A, 8500)],
    );
    expect(r.matched).toHaveLength(1);
    expect(r.unmatched[0].reason).toBe('invoice_already_matched');
  });
});

describe('matching by amount and date', () => {
  it('matches when exactly one invoice fits', () => {
    const r = matchStatement([line({ amount: 8500 })], [inv(INV_A, 8500), inv(INV_B, 9200)]);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].basis).toBe('amount_and_date');
  });

  // The case that matters. Two tenants on the same rent is ordinary in a block
  // of flats; picking whichever sorted first is a silent, confident error.
  it('refuses to choose when two invoices fit the same amount', () => {
    const r = matchStatement([line({ amount: 8500 })], [inv(INV_A, 8500), inv(INV_B, 8500)]);
    expect(r.matched).toHaveLength(0);
    expect(r.unmatched[0].reason).toBe('ambiguous_amount');
    expect(r.unmatched[0].candidates).toEqual([INV_A, INV_B]);
  });

  it('will not reach outside the date window', () => {
    const far = inv(INV_A, 8500, '2026-01-01');
    const r = matchStatement([line({ date: '2026-10-02', amount: 8500 })], [far]);
    expect(r.unmatched[0].reason).toBe('no_candidate');
  });

  it('matches at the edge of the window', () => {
    const d = new Date(Date.UTC(2026, 9, 1) + AMOUNT_MATCH_WINDOW_DAYS * 86400000)
      .toISOString().slice(0, 10);
    const r = matchStatement([line({ date: d, amount: 8500 })], [inv(INV_A, 8500)]);
    expect(r.matched).toHaveLength(1);
  });

  it('does not match a partial payment to a full invoice', () => {
    const r = matchStatement([line({ amount: 4000 })], [inv(INV_A, 8500)]);
    expect(r.unmatched[0].reason).toBe('no_candidate');
  });
});

describe('what is not rent', () => {
  it('ignores debits', () => {
    const r = matchStatement([line({ amount: -500 })], [inv(INV_A, 8500)]);
    expect(r.matched).toHaveLength(0);
    expect(r.unmatched[0].reason).toBe('not_a_credit');
  });

  it('ignores a fully settled invoice as a candidate', () => {
    const r = matchStatement([line({ amount: 8500 })], [inv(INV_A, 0)]);
    expect(r.unmatched[0].reason).toBe('no_candidate');
  });

  it('survives empty input', () => {
    expect(matchStatement([], []).matched).toHaveLength(0);
    expect(matchSummary(matchStatement([], [])).matchedPct).toBeNull();
  });
});

describe('summary', () => {
  it('counts and totals what was matched', () => {
    const r = matchStatement(
      [line({ id: 'L1', reference: payerReference(INV_A) }), line({ id: 'L2', amount: 123 })],
      [inv(INV_A, 8500)],
    );
    const s = matchSummary(r);
    expect(s.lines).toBe(2);
    expect(s.matched).toBe(1);
    expect(s.unmatched).toBe(1);
    expect(s.matchedAmount).toBe(8500);
    expect(s.matchedPct).toBe(50);
  });
});
