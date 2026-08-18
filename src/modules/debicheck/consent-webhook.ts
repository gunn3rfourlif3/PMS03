import { MandateState } from './mandate-calc';

/**
 * Stitch `payment-consent-request` webhook → mandate state.
 *
 * Payload shape (docs.stitch.money/webhooks/types):
 *   { type: 'payment-consent-request',
 *     data: { id, status, type: 'DEBICHECK', externalReference, statusReason?,
 *             consentDetails: { mandateReferenceNumber, collection: {...} } } }
 *
 * `data.id` is the provider's mandate reference; `data.externalReference` is
 * ours. Matching prefers ours — it is the one we control and it survives a
 * provider-side re-issue.
 */

export interface ConsentWebhookResult {
  /** Stitch's consent id. */
  providerRef?: string;
  /** Our mandate id, echoed back. */
  externalReference?: string;
  /** The state to move to, when the status maps to one. */
  state?: MandateState;
  statusReason?: string;
  /** Mandate reference number issued by the bank — evidence in a dispute. */
  mandateReferenceNumber?: string;
  detail: string;
}

/**
 * Provider status → our state.
 *
 * REVOKED and CANCELLED both land on `cancelled`: the distinction is who ended
 * it, which is preserved in `statusReason` rather than in a second state that
 * behaves identically.
 */
const STATE_BY_STATUS: Record<string, MandateState> = {
  GRANTED: 'active',
  FAILED: 'rejected',
  CANCELLED: 'cancelled',
  REVOKED: 'cancelled',
  EXPIRED: 'expired',
  PAUSED: 'suspended',
  // PROCESSING is an interim step while the tenant authenticates. It carries no
  // new information — we are already in `requested` — so it maps to nothing and
  // is acknowledged without a transition.
};

export function isConsentWebhook(body: any): boolean {
  return body?.type === 'payment-consent-request' || !!body?.data?.consentDetails;
}

export function parseConsentWebhook(body: any): ConsentWebhookResult {
  const d = body?.data;
  if (!d) return { detail: 'no data node' };

  const status = String(d.status ?? '').toUpperCase();
  const state = STATE_BY_STATUS[status];

  return {
    providerRef: d.id,
    externalReference: d.externalReference,
    state,
    statusReason: d.statusReason,
    mandateReferenceNumber: d.consentDetails?.mandateReferenceNumber,
    detail: state
      ? `${status}${d.statusReason ? ` (${d.statusReason})` : ''} → ${state}`
      : `${status || 'unknown'} — no state change`,
  };
}

/**
 * A mandate leaving `active` means rent stops collecting itself. §11.9: the
 * agency is notified AND the tenant is switched back to proof-of-payment and
 * told the same day — otherwise they simply do not pay and land in arrears
 * through an administrative event rather than a decision.
 */
export function requiresTenantFallbackNotice(from: MandateState, to: MandateState): boolean {
  const wasCollecting = from === 'active' || from === 'amending';
  const stillCollecting = to === 'active' || to === 'amending';
  return wasCollecting && !stillCollecting;
}
