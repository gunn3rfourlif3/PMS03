import { PaystackPaymentProvider } from '../src/providers/payment/paystack.provider';

describe('Paystack provider (no credentials → safe stub)', () => {
  const prev = process.env.PAYSTACK_SECRET_KEY;
  beforeAll(() => { delete process.env.PAYSTACK_SECRET_KEY; });
  afterAll(() => { if (prev) process.env.PAYSTACK_SECRET_KEY = prev; });

  const p = new PaystackPaymentProvider();

  it('collect returns a pending stub without hitting the network', async () => {
    const r = await p.collect({ vendorId: 'v', invoiceId: 'inv1', amount: 100, currency: 'ZAR' });
    expect(r).toEqual({ providerRef: 'inv_inv1', status: 'pending' });
  });

  it('payout returns a scheduled stub without credentials', async () => {
    const r = await p.payout({ vendorId: 'v', ownerId: 'o1', amount: 500, currency: 'ZAR', bankAccount: { accountNumber: '123' } });
    expect(r).toEqual({ providerRef: 'ps_payout_o1', status: 'scheduled' });
  });
});
