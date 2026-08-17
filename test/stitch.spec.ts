import {
  payerReference, beneficiaryReference, moneyInput,
  PAYER_REF_MAX, BENEFICIARY_REF_MAX,
} from '../src/providers/payment/stitch-refs';
import { StitchPaymentProvider } from '../src/providers/payment/stitch.provider';

const INVOICE = '9f8e7d6c-5b4a-4321-9876-543210fedcba';

describe('Stitch statement references', () => {
  it('keeps the payer reference inside Stitch\'s 12-character cap', () => {
    const r = payerReference(INVOICE);
    expect(r.length).toBeLessThanOrEqual(PAYER_REF_MAX);
    expect(r.startsWith('RENT')).toBe(true);
  });

  it('keeps the beneficiary reference inside the 20-character cap', () => {
    expect(beneficiaryReference(INVOICE).length).toBeLessThanOrEqual(BENEFICIARY_REF_MAX);
  });

  it('stays within the cap even with an over-long prefix', () => {
    expect(payerReference(INVOICE, 'DEPOSITPAYMENT').length).toBeLessThanOrEqual(PAYER_REF_MAX);
  });

  it('falls back to RENT for an empty or junk prefix', () => {
    expect(payerReference(INVOICE, '')).toMatch(/^RENT/);
    expect(payerReference(INVOICE, '---')).toMatch(/^RENT/);
  });

  it('is deterministic and distinguishes different invoices', () => {
    const other = '11112222-3333-4444-5555-666677778888';
    expect(payerReference(INVOICE)).toBe(payerReference(INVOICE));
    expect(payerReference(INVOICE)).not.toBe(payerReference(other));
    expect(beneficiaryReference(INVOICE)).not.toBe(beneficiaryReference(other));
  });

  it('strips dashes rather than wasting four of twelve characters on them', () => {
    expect(payerReference(INVOICE)).not.toContain('-');
    expect(beneficiaryReference(INVOICE)).not.toContain('-');
  });

  it('survives a malformed invoice id', () => {
    expect(() => payerReference('')).not.toThrow();
    expect(payerReference('')).toBe('RENT');
  });

  it('sends a decimal amount, not cents', () => {
    expect(moneyInput(1234.5)).toEqual({ quantity: 1234.5, currency: 'ZAR' });
    expect(moneyInput(0.1 + 0.2).quantity).toBe(0.3); // no float noise on the wire
  });
});

describe('StitchPaymentProvider', () => {
  const req = { vendorId: 'v1', invoiceId: INVOICE, amount: 2660, currency: 'ZAR' };
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; jest.restoreAllMocks(); });

  it('stubs without STITCH_LIVE, even with credentials present', async () => {
    process.env.STITCH_CLIENT_ID = 'id';
    process.env.STITCH_CLIENT_SECRET = 'secret';
    delete process.env.STITCH_LIVE;
    const fetchSpy = jest.spyOn(global, 'fetch' as any);

    const r = await new StitchPaymentProvider().collect(req);

    expect(r).toEqual({ providerRef: `stitch_${INVOICE}`, status: 'pending' });
    expect(fetchSpy).not.toHaveBeenCalled(); // no network on an unarmed rail
  });

  it('stubs when armed but not configured', async () => {
    process.env.STITCH_LIVE = 'true';
    delete process.env.STITCH_CLIENT_ID;
    const r = await new StitchPaymentProvider().collect(req);
    expect(r.status).toBe('pending');
    expect(r.redirectUrl).toBeUndefined();
  });

  it('exchanges credentials for a token, then creates a payment request', async () => {
    process.env.STITCH_LIVE = 'true';
    process.env.STITCH_CLIENT_ID = 'id';
    process.env.STITCH_CLIENT_SECRET = 'secret';
    process.env.STITCH_REDIRECT_URI = 'https://app.locare.co.za/pay/return';

    const calls: any[] = [];
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('/connect/token')) {
        return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) } as any;
      }
      return {
        ok: true,
        json: async () => ({
          data: { clientPaymentInitiationRequestCreate: { paymentInitiationRequest: { id: 'pr-1', url: 'https://secure.stitch.money/connect/payment-request/pr-1' } } },
        }),
      } as any;
    });

    const r = await new StitchPaymentProvider().collect(req);

    expect(r.status).toBe('pending');
    expect(r.providerRef).toBe('pr-1'); // Stitch's id — what the webhook quotes
    expect(r.redirectUrl).toContain('redirect_uri=https%3A%2F%2Fapp.locare.co.za%2Fpay%2Freturn');

    const [tokenCall, gqlCall] = calls;
    expect(tokenCall.init.body).toContain('grant_type=client_credentials');
    expect(tokenCall.init.body).toContain('scope=client_paymentrequest');
    const vars = JSON.parse(gqlCall.init.body).variables;
    expect(vars.externalReference).toBe(INVOICE); // full id for matching
    expect(vars.amount).toEqual({ quantity: 2660, currency: 'ZAR' });
    expect(vars.expireAt).toBeTruthy();
    expect(gqlCall.init.headers.Authorization).toBe('Bearer tok');
  });

  it('caches the token across calls', async () => {
    process.env.STITCH_LIVE = 'true';
    process.env.STITCH_CLIENT_ID = 'id';
    process.env.STITCH_CLIENT_SECRET = 'secret';
    let tokenCalls = 0;
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any) => {
      if (String(url).includes('/connect/token')) {
        tokenCalls += 1;
        return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) } as any;
      }
      return { ok: true, json: async () => ({ data: { clientPaymentInitiationRequestCreate: { paymentInitiationRequest: { id: 'pr', url: 'https://x' } } } }) } as any;
    });

    const p = new StitchPaymentProvider();
    await p.collect(req);
    await p.collect({ ...req, invoiceId: 'another-invoice-id' });

    expect(tokenCalls).toBe(1);
  });

  // GraphQL returns HTTP 200 with an errors array, so `res.ok` proves nothing.
  it('treats a GraphQL errors array as a failure', async () => {
    process.env.STITCH_LIVE = 'true';
    process.env.STITCH_CLIENT_ID = 'id';
    process.env.STITCH_CLIENT_SECRET = 'secret';
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any) => {
      if (String(url).includes('/connect/token')) {
        return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) } as any;
      }
      return { ok: true, json: async () => ({ errors: [{ message: 'BAD_USER_INPUT' }] }) } as any;
    });

    const r = await new StitchPaymentProvider().collect(req);
    expect(r.status).toBe('failed');
    expect(r.redirectUrl).toBeUndefined();
  });

  it('never reports success from collect — only a webhook can do that', async () => {
    process.env.STITCH_LIVE = 'true';
    process.env.STITCH_CLIENT_ID = 'id';
    process.env.STITCH_CLIENT_SECRET = 'secret';
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any) => {
      if (String(url).includes('/connect/token')) {
        return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) } as any;
      }
      return { ok: true, json: async () => ({ data: { clientPaymentInitiationRequestCreate: { paymentInitiationRequest: { id: 'pr', url: 'https://x' } } } }) } as any;
    });
    const r = await new StitchPaymentProvider().collect(req);
    expect(r.status).not.toBe('succeeded');
  });

  // Payout behaviour has its own suite (stitch-payout.spec.ts); this pins the
  // one property that must never regress — it refuses rather than reporting
  // money as scheduled when it cannot actually send it.
  it('refuses payouts rather than pretending money moved', async () => {
    await expect(new StitchPaymentProvider().payout({ vendorId: 'v', ownerId: 'o', amount: 1, currency: 'ZAR' }))
      .rejects.toThrow();
  });
});
