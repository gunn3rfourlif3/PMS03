import { PayfastPaymentProvider } from '../src/providers/payment/payfast.provider';
import { YocoPaymentProvider } from '../src/providers/payment/yoco.provider';
import { PeachPaymentProvider } from '../src/providers/payment/peach.provider';

const collectReq = { vendorId: 'v', invoiceId: 'inv-9', amount: 1234.5, currency: 'ZAR' };

describe('PayFast provider', () => {
  it('signature is a deterministic md5 and passphrase-sensitive', () => {
    const f = { merchant_id: '10000100', amount: '100.00', item_name: 'Invoice 1' };
    const a = PayfastPaymentProvider.sign(f);
    const b = PayfastPaymentProvider.sign(f, 'secret');
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    expect(a).toBe(PayfastPaymentProvider.sign(f)); // stable
    expect(a).not.toBe(b);                           // passphrase changes it
  });

  it('collect returns a pending stub without merchant credentials', async () => {
    const prevId = process.env.PAYFAST_MERCHANT_ID;
    delete process.env.PAYFAST_MERCHANT_ID;
    const r = await new PayfastPaymentProvider().collect(collectReq);
    expect(r).toEqual({ providerRef: 'pf_inv-9', status: 'pending' });
    if (prevId) process.env.PAYFAST_MERCHANT_ID = prevId;
  });

  it('collect builds a signed redirect URL when configured', async () => {
    process.env.PAYFAST_MERCHANT_ID = '10000100';
    process.env.PAYFAST_MERCHANT_KEY = '46f0cd694581a';
    const r = await new PayfastPaymentProvider().collect(collectReq);
    expect(r.status).toBe('pending');
    expect(r.redirectUrl).toContain('payfast.co.za/eng/process?');
    expect(r.redirectUrl).toContain('signature=');
    expect(r.redirectUrl).toContain('m_payment_id=inv-9');
    expect(r.redirectUrl).toContain('amount=1234.50');
    delete process.env.PAYFAST_MERCHANT_ID; delete process.env.PAYFAST_MERCHANT_KEY;
  });

  it('refuses payouts', async () => {
    await expect(new PayfastPaymentProvider().payout({ vendorId: 'v', ownerId: 'o', amount: 1, currency: 'ZAR' }))
      .rejects.toThrow(/payout/i);
  });
});

describe('Yoco + Peach providers (no credentials → safe stub)', () => {
  it('Yoco collect returns pending without a key', async () => {
    const prev = process.env.YOCO_SECRET_KEY; delete process.env.YOCO_SECRET_KEY;
    expect(await new YocoPaymentProvider().collect(collectReq)).toEqual({ providerRef: 'yoco_inv-9', status: 'pending' });
    if (prev) process.env.YOCO_SECRET_KEY = prev;
  });
  it('Peach collect returns pending without an endpoint', async () => {
    const prev = process.env.PEACH_CHECKOUT_URL; delete process.env.PEACH_CHECKOUT_URL;
    expect(await new PeachPaymentProvider().collect(collectReq)).toEqual({ providerRef: 'peach_inv-9', status: 'pending' });
    if (prev) process.env.PEACH_CHECKOUT_URL = prev;
  });
  it('both refuse payouts', async () => {
    await expect(new YocoPaymentProvider().payout({ vendorId: 'v', ownerId: 'o', amount: 1, currency: 'ZAR' })).rejects.toThrow(/payout/i);
    await expect(new PeachPaymentProvider().payout({ vendorId: 'v', ownerId: 'o', amount: 1, currency: 'ZAR' })).rejects.toThrow(/payout/i);
  });
});
