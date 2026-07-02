import { applyPayment, lateFee } from '../src/modules/billing/payment-alloc';

describe('payment allocation + late fees', () => {
  it('marks an invoice paid on full payment', () => {
    expect(applyPayment(11500, 0, 11500)).toEqual({ paidToDate: 11500, status: 'paid' });
  });
  it('marks partly_paid on partial payment', () => {
    expect(applyPayment(11500, 0, 5000)).toEqual({ paidToDate: 5000, status: 'partly_paid' });
  });
  it('reaches paid after a top-up', () => {
    expect(applyPayment(11500, 5000, 6500)).toEqual({ paidToDate: 11500, status: 'paid' });
  });
  it('treats overpayment as paid', () => {
    expect(applyPayment(100, 0, 150).status).toBe('paid');
  });
  it('computes a percentage late fee', () => {
    expect(lateFee(11500, 0.1)).toBe(1150);
    expect(lateFee(0, 0.1)).toBe(0);
  });
});
