import { createHmac } from 'node:crypto';
import { verifySvixSignature } from '../src/providers/payment/svix-verify';
import { parseStitchWebhook } from '../src/providers/payment/stitch-webhook';

const SECRET = 'whsec_5WbX5kEWLlfzsGNjH64I8lOOqUB6e8FH';
const RAW = JSON.stringify({ hello: 'world' });
const ID = 'msg_2b068bd5';

const sign = (id: string, ts: string, body: string, secret = SECRET) =>
  createHmac('sha256', Buffer.from(secret.split('_')[1], 'base64'))
    .update(`${id}.${ts}.${body}`)
    .digest('base64');

const nowSec = () => Math.floor(Date.now() / 1000).toString();

describe('Svix signature verification', () => {
  it('accepts a correctly signed payload', () => {
    const ts = nowSec();
    const r = verifySvixSignature({
      id: ID, timestamp: ts, rawBody: RAW, secret: SECRET,
      signatureHeader: `v1,${sign(ID, ts, RAW)}`,
    });
    expect(r.ok).toBe(true);
  });

  it('rejects a tampered body', () => {
    const ts = nowSec();
    const header = `v1,${sign(ID, ts, RAW)}`;
    const r = verifySvixSignature({
      id: ID, timestamp: ts, rawBody: JSON.stringify({ hello: 'tampered' }), secret: SECRET,
      signatureHeader: header,
    });
    expect(r).toEqual({ ok: false, reason: 'bad_signature' });
  });

  // Re-serialising JSON changes bytes; the signature is over bytes.
  it('rejects a body that was parsed and re-stringified with different spacing', () => {
    const ts = nowSec();
    const header = `v1,${sign(ID, ts, RAW)}`;
    const r = verifySvixSignature({
      id: ID, timestamp: ts, rawBody: JSON.stringify(JSON.parse(RAW), null, 2), secret: SECRET,
      signatureHeader: header,
    });
    expect(r.ok).toBe(false);
  });

  it('accepts when any signature in the list matches, as during a secret rotation', () => {
    const ts = nowSec();
    const header = `v1,bm90LXRoZS1yaWdodC1vbmU= v1,${sign(ID, ts, RAW)}`;
    expect(verifySvixSignature({ id: ID, timestamp: ts, rawBody: RAW, secret: SECRET, signatureHeader: header }).ok)
      .toBe(true);
  });

  it('rejects a replayed payload outside the tolerance window', () => {
    const old = (Math.floor(Date.now() / 1000) - 3600).toString();
    const r = verifySvixSignature({
      id: ID, timestamp: old, rawBody: RAW, secret: SECRET,
      signatureHeader: `v1,${sign(ID, old, RAW)}`,
    });
    expect(r).toEqual({ ok: false, reason: 'stale_timestamp' }); // valid signature, still refused
  });

  it('distinguishes an unset secret from a bad signature', () => {
    const ts = nowSec();
    expect(verifySvixSignature({ id: ID, timestamp: ts, rawBody: RAW, signatureHeader: 'v1,x' }))
      .toEqual({ ok: false, reason: 'missing_secret' });
    expect(verifySvixSignature({ rawBody: RAW, secret: SECRET }))
      .toEqual({ ok: false, reason: 'missing_headers' });
  });

  it('tolerates a secret pasted without its whsec_ prefix', () => {
    const ts = nowSec();
    const bare = SECRET.slice('whsec_'.length);
    const r = verifySvixSignature({
      id: ID, timestamp: ts, rawBody: RAW, secret: bare,
      signatureHeader: `v1,${sign(ID, ts, RAW)}`,
    });
    expect(r.ok).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    const ts = nowSec();
    const other = 'whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const r = verifySvixSignature({
      id: ID, timestamp: ts, rawBody: RAW, secret: SECRET,
      signatureHeader: `v1,${sign(ID, ts, RAW, other)}`,
    });
    expect(r).toEqual({ ok: false, reason: 'bad_signature' });
  });
});

// Shapes taken from docs.stitch.money/webhooks/types.
const payload = (state?: string, confirmation?: string) => ({
  data: {
    client: {
      paymentInitiationRequests: {
        node: {
          id: 'cGF5cmVxLzk2YjUyODU1',
          externalReference: '79261d16-c53b-48eb-9019-dc9cfb6c5126',
          ...(state ? { state: { __typename: state } } : {}),
          ...(confirmation ? { paymentConfirmation: { __typename: confirmation } } : {}),
        },
      },
    },
  },
});

describe('Stitch webhook payloads', () => {
  it('marks paid only when funds were received', () => {
    const r = parseStitchWebhook(payload('PaymentInitiationRequestCompleted', 'PaymentReceived'));
    expect(r.outcome).toBe('paid');
    expect(r.providerRef).toBe('cGF5cmVxLzk2YjUyODU1');
    expect(r.externalReference).toBe('79261d16-c53b-48eb-9019-dc9cfb6c5126');
  });

  // The distinction that matters: the payer finished at their bank, but the
  // money has not arrived. Crediting here credits an account against nothing.
  it('does not mark paid on Completed alone', () => {
    const r = parseStitchWebhook(payload('PaymentInitiationRequestCompleted', 'PaymentPending'));
    expect(r.outcome).toBe('ignore');
    expect(r.detail).toMatch(/awaiting PaymentReceived/);
  });

  it('marks paid on Completed when explicitly configured to', () => {
    const r = parseStitchWebhook(payload('PaymentInitiationRequestCompleted', 'PaymentPending'), 'completed');
    expect(r.outcome).toBe('paid');
  });

  it('reopens the invoice when received funds go unsettled', () => {
    expect(parseStitchWebhook(payload('PaymentInitiationRequestCompleted', 'PaymentUnsettled')).outcome)
      .toBe('failed');
  });

  it.each(['PaymentInitiationRequestCancelled', 'PaymentInitiationRequestExpired'])(
    'treats %s as a failure', (state) => {
      expect(parseStitchWebhook(payload(state)).outcome).toBe('failed');
    },
  );

  it('ignores an unrecognised or empty payload without throwing', () => {
    expect(parseStitchWebhook({}).outcome).toBe('ignore');
    expect(parseStitchWebhook(null).outcome).toBe('ignore');
    expect(parseStitchWebhook(payload()).outcome).toBe('ignore');
  });

  it('an unsettled confirmation outranks a completed state', () => {
    // Ordering matters: both fields are present on the same payload.
    expect(parseStitchWebhook(payload('PaymentInitiationRequestCompleted', 'PaymentUnsettled'), 'completed').outcome)
      .toBe('failed');
  });
});
