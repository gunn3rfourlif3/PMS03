import { IkhokhaPaymentProvider } from '../src/providers/payment/ikhokha.provider';
import { PaystackPaymentProvider } from '../src/providers/payment/paystack.provider';
import { PayfastPaymentProvider } from '../src/providers/payment/payfast.provider';

const req = { vendorId: 'v1', invoiceId: 'inv-42', amount: 950.5, currency: 'ZAR' };

describe('iKhokha provider (live collection rail)', () => {
  it('signs (path + body) with HMAC-SHA256, deterministic & secret-sensitive', () => {
    const a = IkhokhaPaymentProvider.sign('/public-api/v1/api/payment', '{"amount":100}', 'secret');
    const b = IkhokhaPaymentProvider.sign('/public-api/v1/api/payment', '{"amount":100}', 'other');
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(IkhokhaPaymentProvider.sign('/public-api/v1/api/payment', '{"amount":100}', 'secret'));
    expect(a).not.toBe(b);
  });

  it('collect returns a deterministic pending stub without credentials', async () => {
    const prev = { id: process.env.IKHOKHA_APP_ID, sec: process.env.IKHOKHA_APP_SECRET };
    delete process.env.IKHOKHA_APP_ID; delete process.env.IKHOKHA_APP_SECRET;
    const r = await new IkhokhaPaymentProvider().collect(req);
    expect(r).toEqual({ providerRef: 'ik_inv-42', status: 'pending' });
    if (prev.id) process.env.IKHOKHA_APP_ID = prev.id;
    if (prev.sec) process.env.IKHOKHA_APP_SECRET = prev.sec;
  });

  it('refuses payouts (collection gateway)', async () => {
    await expect(new IkhokhaPaymentProvider().payout({ vendorId: 'v', ownerId: 'o', amount: 1, currency: 'ZAR' }))
      .rejects.toThrow(/payout/i);
  });
});

describe('other gateways are stubbed for the first deploy', () => {
  afterEach(() => {
    delete process.env.PAYSTACK_LIVE; delete process.env.PAYFAST_LIVE;
    delete process.env.PAYSTACK_SECRET_KEY; delete process.env.PAYFAST_MERCHANT_ID; delete process.env.PAYFAST_MERCHANT_KEY;
  });

  it('Paystack collect stays a stub even with a key, unless PAYSTACK_LIVE=true', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';   // creds present…
    const r = await new PaystackPaymentProvider().collect(req);
    expect(r).toEqual({ providerRef: 'inv_inv-42', status: 'pending' }); // …but still stubbed
  });

  it('PayFast collect stays a stub even with merchant creds, unless PAYFAST_LIVE=true', async () => {
    process.env.PAYFAST_MERCHANT_ID = '10000100';
    process.env.PAYFAST_MERCHANT_KEY = '46f0cd694581a';
    const r = await new PayfastPaymentProvider().collect(req);
    expect(r).toEqual({ providerRef: 'pf_inv-42', status: 'pending' });
    expect(r.redirectUrl).toBeUndefined();
  });
});

describe('iKhokha callback signature verification', () => {
  const path = '/api/payments/webhook/ikhokha';
  const raw = JSON.stringify({ externalTransactionID: 'inv-42', responseCode: '00' });
  const secret = 'app-secret';

  it('accepts a correctly-signed callback', () => {
    const sig = IkhokhaPaymentProvider.sign(path, raw, secret);
    expect(IkhokhaPaymentProvider.verify(path, raw, secret, sig)).toBe(true);
  });
  it('rejects a tampered body', () => {
    const sig = IkhokhaPaymentProvider.sign(path, raw, secret);
    const tampered = JSON.stringify({ externalTransactionID: 'inv-42', responseCode: '00', amount: 1 });
    expect(IkhokhaPaymentProvider.verify(path, tampered, secret, sig)).toBe(false);
  });
  it('rejects a wrong/absent signature', () => {
    expect(IkhokhaPaymentProvider.verify(path, raw, secret, 'deadbeef')).toBe(false);
    expect(IkhokhaPaymentProvider.verify(path, raw, secret, undefined)).toBe(false);
  });
});
