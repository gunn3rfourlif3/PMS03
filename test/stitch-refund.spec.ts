import { StitchPaymentProvider } from '../src/providers/payment/stitch.provider';
import { canRefund } from '../src/providers/payment/refund-provider.interface';
import { PayfastPaymentProvider } from '../src/providers/payment/payfast.provider';
import { parseStitchRefundWebhook, isRefundWebhook, parseStitchWebhook } from '../src/providers/payment/stitch-webhook';

const refundPayload = (statusType: string, reason?: string) => ({
  data: {
    client: {
      refunds: {
        node: {
          id: 'cmVmdW5kLzFmY2Q0N2Yw',
          nonce: '6525e472',
          status: { __typename: statusType, ...(reason ? { reason } : {}) },
          paymentInitiationRequest: { externalReference: '5596d0a6-8072-4426-ab59-38ad45ef671c' },
        },
      },
    },
  },
});

describe('refund capability', () => {
  it('is advertised by Stitch and not by PayFast', () => {
    expect(canRefund(new StitchPaymentProvider())).toBe(true);
    expect(canRefund(new PayfastPaymentProvider())).toBe(false);
    expect(canRefund(undefined)).toBe(false);
  });
});

describe('refund webhooks', () => {
  it('is recognised as a refund, not a payment', () => {
    expect(isRefundWebhook(refundPayload('RefundCompleted'))).toBe(true);
    expect(isRefundWebhook({ data: { client: { paymentInitiationRequests: { node: {} } } } })).toBe(false);
  });

  // The conflation worth guarding: a completed refund must never read as a
  // completed payment and mark an invoice paid.
  it('a completed refund is not parsed as a payment', () => {
    expect(parseStitchWebhook(refundPayload('RefundCompleted')).outcome).toBe('ignore');
  });

  it('maps refund states', () => {
    expect(parseStitchRefundWebhook(refundPayload('RefundCompleted')).outcome).toBe('refunded');
    expect(parseStitchRefundWebhook(refundPayload('RefundError', 'invalid_account')).outcome).toBe('failed');
    expect(parseStitchRefundWebhook(refundPayload('RefundError', 'invalid_account')).detail).toContain('invalid_account');
    expect(parseStitchRefundWebhook(refundPayload('RefundSubmitted')).outcome).toBe('ignore');
  });

  // Paused means an under-funded float, which a top-up resolves — not a failure.
  it('treats RefundPaused as in-flight, not failed', () => {
    const r = parseStitchRefundWebhook(refundPayload('RefundPaused', 'insufficient_funds'));
    expect(r.outcome).toBe('ignore');
    expect(r.detail).toContain('insufficient_funds');
  });

  it('carries the original invoice reference through', () => {
    expect(parseStitchRefundWebhook(refundPayload('RefundCompleted')).externalReference)
      .toBe('5596d0a6-8072-4426-ab59-38ad45ef671c');
  });

  it('ignores an empty payload without throwing', () => {
    expect(parseStitchRefundWebhook({}).outcome).toBe('ignore');
    expect(parseStitchRefundWebhook(null).outcome).toBe('ignore');
  });
});

describe('StitchPaymentProvider.refund', () => {
  const req = {
    paymentRef: 'cGF5cmVxLzk2YjUyODU1', amount: 1500, currency: 'ZAR',
    reason: 'requested_by_customer' as const, idempotencyKey: 'refund-inv-9',
  };
  const env = { ...process.env };
  const arm = () => {
    process.env.STITCH_LIVE = 'true';
    process.env.STITCH_CLIENT_ID = 'id';
    process.env.STITCH_CLIENT_SECRET = 'secret';
  };
  afterEach(() => { process.env = { ...env }; jest.restoreAllMocks(); });

  const mockFetch = (gqlResponse: any) => {
    const calls: any[] = [];
    jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('/connect/token')) {
        return { ok: true, json: async () => ({ access_token: `tok-${calls.length}`, expires_in: 3600 }) } as any;
      }
      return { ok: true, json: async () => gqlResponse } as any;
    });
    return calls;
  };

  it('requests the refund scope and passes the payment request id', async () => {
    arm();
    const calls = mockFetch({ data: { clientRefundInitiate: { refund: { id: 'ref-1' } } } });

    const r = await new StitchPaymentProvider().refund(req);

    expect(r).toEqual({ providerRef: 'ref-1', status: 'pending' });
    expect(calls[0].init.body).toContain('scope=client_refund');
    const vars = JSON.parse(calls[1].init.body).variables;
    expect(vars.paymentRequestId).toBe('cGF5cmVxLzk2YjUyODU1');
    expect(vars.nonce).toBe('refund-inv-9');
    expect(vars.reason).toBe('requested_by_customer');
    expect(vars.beneficiaryReference.length).toBeLessThanOrEqual(20);
  });

  // Only the webhook can complete a refund; the mutation just starts one.
  it('never reports a refund as paid from the mutation', async () => {
    arm();
    mockFetch({ data: { clientRefundInitiate: { refund: { id: 'ref-1' } } } });
    expect((await new StitchPaymentProvider().refund(req)).status).not.toBe('paid');
  });

  it('treats a duplicate nonce as already issued', async () => {
    arm();
    mockFetch({ errors: [{ message: 'already issued', extensions: { code: 'NONCE_DUPLICATE' } }] });
    expect((await new StitchPaymentProvider().refund(req)).status).toBe('pending');
  });

  it('surfaces the error code so an operator can act on it', async () => {
    arm();
    mockFetch({
      errors: [{
        message: 'The payment associated with this refund is pending.',
        extensions: { code: 'PAYMENT_INCOMPLETE', reason: 'PENDING' },
      }],
    });
    const r = await new StitchPaymentProvider().refund(req);
    expect(r.status).toBe('failed');
    expect(r.error).toContain('PAYMENT_INCOMPLETE');
  });

  it('refuses without an idempotency key', async () => {
    arm();
    await expect(new StitchPaymentProvider().refund({ ...req, idempotencyKey: '' }))
      .rejects.toThrow(/idempotencyKey is required/i);
  });

  // Regression: a single token slot would hand a paymentrequest token to a refund.
  it('does not reuse a token minted for a different scope', async () => {
    arm();
    const calls = mockFetch({
      data: {
        clientPaymentInitiationRequestCreate: { paymentInitiationRequest: { id: 'pr', url: 'https://x' } },
        clientRefundInitiate: { refund: { id: 'ref-1' } },
      },
    });

    const p = new StitchPaymentProvider();
    await p.collect({ vendorId: 'v', invoiceId: 'inv-9', amount: 10, currency: 'ZAR' });
    await p.refund(req);

    const tokenCalls = calls.filter((c) => c.url.includes('/connect/token'));
    expect(tokenCalls).toHaveLength(2);
    expect(tokenCalls[0].init.body).toContain('scope=client_paymentrequest');
    expect(tokenCalls[1].init.body).toContain('scope=client_refund');
  });
});
