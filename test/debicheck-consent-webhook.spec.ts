import {
  parseConsentWebhook, isConsentWebhook, requiresTenantFallbackNotice,
} from '../src/modules/debicheck/consent-webhook';
import { canTransition, isCollectable } from '../src/modules/debicheck/mandate-calc';

// Shape from docs.stitch.money/webhooks/types → payment-consent-request.
const consent = (status: string, statusReason?: string) => ({
  type: 'payment-consent-request',
  id: `payment-consent-request:status:${status.toLowerCase()}:abc`,
  data: {
    id: 'cmVjdXJyaW5nUGF5bWVudENvbnNlbnRSZXF1ZXN0L2NiNmYyYmQ5',
    status,
    type: 'DEBICHECK',
    externalReference: '3f2a7c81-9b44-4d2e-8a11-7c6d5e4f3a2b',
    ...(statusReason ? { statusReason } : {}),
    consentDetails: { mandateReferenceNumber: '098765432123456789' },
  },
});

describe('consent webhook detection', () => {
  it('recognises a consent payload', () => {
    expect(isConsentWebhook(consent('GRANTED'))).toBe(true);
  });

  it('does not claim a payment payload', () => {
    expect(isConsentWebhook({ data: { client: { paymentInitiationRequests: { node: {} } } } })).toBe(false);
    expect(isConsentWebhook({})).toBe(false);
  });
});

describe('consent status → mandate state', () => {
  it.each([
    ['GRANTED', 'active'],
    ['FAILED', 'rejected'],
    ['CANCELLED', 'cancelled'],
    ['REVOKED', 'cancelled'],
    ['EXPIRED', 'expired'],
    ['PAUSED', 'suspended'],
  ])('%s → %s', (status, expected) => {
    expect(parseConsentWebhook(consent(status)).state).toBe(expected);
  });

  // Interim status carrying no new information — we are already in `requested`.
  it('PROCESSING produces no transition', () => {
    const r = parseConsentWebhook(consent('PROCESSING'));
    expect(r.state).toBeUndefined();
    expect(r.detail).toContain('no state change');
  });

  it('carries the reason, provider ref and bank mandate number', () => {
    const r = parseConsentWebhook(consent('REVOKED', 'CONTRACT_EXPIRED'));
    expect(r.statusReason).toBe('CONTRACT_EXPIRED');
    expect(r.providerRef).toBe('cmVjdXJyaW5nUGF5bWVudENvbnNlbnRSZXF1ZXN0L2NiNmYyYmQ5');
    expect(r.externalReference).toBe('3f2a7c81-9b44-4d2e-8a11-7c6d5e4f3a2b');
    expect(r.mandateReferenceNumber).toBe('098765432123456789'); // dispute evidence
    expect(r.detail).toContain('CONTRACT_EXPIRED');
  });

  it('handles junk without throwing', () => {
    expect(parseConsentWebhook({}).state).toBeUndefined();
    expect(parseConsentWebhook(null).detail).toBe('no data node');
    expect(parseConsentWebhook({ data: {} }).state).toBeUndefined();
  });
});

describe('suspended is a real state, not active or cancelled', () => {
  // The gap this closed: PAUSED had nowhere to go in the original §4 machine.
  // Mapping it to active would collect against a suspended mandate.
  it('is not collectable', () => {
    expect(isCollectable('suspended')).toBe(false);
  });

  it('can resume to active, unlike a terminal state', () => {
    expect(canTransition('active', 'suspended')).toBe(true);
    expect(canTransition('suspended', 'active')).toBe(true);
    expect(canTransition('cancelled', 'active')).toBe(false);
  });
});

describe('tenant fallback notice (§11.9)', () => {
  // A tenant whose mandate stopped must be told to pay manually, or they land
  // in arrears through an administrative event rather than a decision.
  it.each(['cancelled', 'suspended', 'expired', 'rejected'] as const)(
    'active → %s requires telling the tenant', (to) => {
      expect(requiresTenantFallbackNotice('active', to)).toBe(true);
    },
  );

  it('amending does not — collection continues at the old ceiling', () => {
    expect(requiresTenantFallbackNotice('active', 'amending')).toBe(false);
    expect(requiresTenantFallbackNotice('amending', 'active')).toBe(false);
  });

  it('is not triggered by a mandate that was never collecting', () => {
    expect(requiresTenantFallbackNotice('requested', 'rejected')).toBe(false);
    expect(requiresTenantFallbackNotice('drafted', 'cancelled')).toBe(false);
  });
});
