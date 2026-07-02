import { computeSignature, verifySignature } from '../src/common/webhooks/signature';

describe('webhook signature', () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ gatewayRef: 'stitch_1', status: 'succeeded' });

  it('verifies a correct signature', () => {
    expect(verifySignature(body, computeSignature(body, secret), secret)).toBe(true);
  });
  it('rejects a tampered body', () => {
    const sig = computeSignature(body, secret);
    expect(verifySignature(body + 'x', sig, secret)).toBe(false);
  });
  it('rejects wrong secret and missing signature', () => {
    const sig = computeSignature(body, secret);
    expect(verifySignature(body, sig, 'other')).toBe(false);
    expect(verifySignature(body, undefined, secret)).toBe(false);
  });
});
