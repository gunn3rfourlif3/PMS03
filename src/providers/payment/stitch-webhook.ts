/**
 * Parsing of Stitch webhook payloads into an outcome our billing code
 * understands. Pure, so the decision table is testable without a live gateway.
 *
 * Two event types matter for pay-by-bank, and the difference is money:
 *
 *   `payment`              — the payment REQUEST changed state. `Completed`
 *                            means the payer finished the flow at their bank.
 *                            It does not mean funds have arrived.
 *   `payment.confirmation` — funds were RECEIVED in the Stitch intermediary
 *                            account (`PaymentReceived`), or subsequently went
 *                            unsettled (`PaymentUnsettled`).
 *
 * Which one marks an invoice paid is a real decision, not a detail. Marking on
 * `Completed` credits a tenant's account before the money exists, and an
 * immutable ledger makes that expensive to unwind — corrections are new
 * postings, never edits. So the default is `received`.
 *
 * The catch: `payment.confirmation` is only dispatched when a Stitch
 * intermediary account is in the flow. If settlement runs directly to the
 * agency's bank account, that event never arrives and nothing would ever
 * reconcile. `STITCH_CONFIRM_ON=completed` exists for that configuration, and
 * is a deliberate acceptance of settlement risk rather than a default.
 */

export type StitchOutcome = 'paid' | 'failed' | 'ignore';

export interface StitchWebhookResult {
  /** Stitch's payment request id — matches the stored gateway ref. */
  providerRef?: string;
  /** Our invoice id, echoed back from the request. */
  externalReference?: string;
  outcome: StitchOutcome;
  /** For logs: what the payload actually said. */
  detail: string;
}

/** `payment` request states that end the request unsuccessfully. */
const TERMINAL_FAILURES = new Set([
  'PaymentInitiationRequestCancelled',
  'PaymentInitiationRequestExpired',
]);

const node = (body: any) => body?.data?.client?.paymentInitiationRequests?.node;

/**
 * `refund` webhook → outcome. Separate from payments because a refund reaching
 * a terminal state is not the same event as a payment doing so, and conflating
 * them would let a completed refund look like a completed payment.
 *
 * `RefundPaused` means an under-funded intermediary float, which resolves on
 * top-up — so it is reported as still in flight rather than failed.
 */
export interface StitchRefundResult {
  refundRef?: string;
  /** The original payment's external reference, i.e. our invoice id. */
  externalReference?: string;
  outcome: 'refunded' | 'failed' | 'ignore';
  detail: string;
}

export function parseStitchRefundWebhook(body: any): StitchRefundResult {
  const n = body?.data?.client?.refunds?.node;
  if (!n) return { outcome: 'ignore', detail: 'no refunds node' };

  const base = {
    refundRef: n.id,
    externalReference: n.paymentInitiationRequest?.externalReference,
  };
  switch (n.status?.__typename) {
    case 'RefundCompleted': return { ...base, outcome: 'refunded', detail: 'RefundCompleted' };
    case 'RefundError': return { ...base, outcome: 'failed', detail: `RefundError: ${n.status?.reason ?? 'unknown'}` };
    case 'RefundPaused': return { ...base, outcome: 'ignore', detail: `RefundPaused: ${n.status?.reason ?? 'unknown'}` };
    default: return { ...base, outcome: 'ignore', detail: `status=${n.status?.__typename ?? 'none'}` };
  }
}

/** True when the payload is a refund event rather than a payment one. */
export const isRefundWebhook = (body: any) => !!body?.data?.client?.refunds?.node;

export function parseStitchWebhook(
  body: any,
  confirmOn: 'received' | 'completed' = 'received',
): StitchWebhookResult {
  const n = node(body);
  if (!n) return { outcome: 'ignore', detail: 'no paymentInitiationRequests node' };

  const providerRef = n.id;
  const externalReference = n.externalReference;
  const state = n.state?.__typename as string | undefined;
  const confirmation = n.paymentConfirmation?.__typename as string | undefined;

  const base = { providerRef, externalReference };

  // Funds actually moved — or came back.
  if (confirmation === 'PaymentReceived') {
    return { ...base, outcome: 'paid', detail: 'PaymentReceived' };
  }
  if (confirmation === 'PaymentUnsettled') {
    // Money that arrived and then did not settle. Reported as a failure so the
    // invoice reopens rather than staying paid on funds that never landed.
    return { ...base, outcome: 'failed', detail: 'PaymentUnsettled' };
  }

  if (state && TERMINAL_FAILURES.has(state)) {
    return { ...base, outcome: 'failed', detail: state };
  }

  if (state === 'PaymentInitiationRequestCompleted') {
    return confirmOn === 'completed'
      ? { ...base, outcome: 'paid', detail: 'Completed (confirmOn=completed)' }
      : { ...base, outcome: 'ignore', detail: 'Completed — awaiting PaymentReceived' };
  }

  return { ...base, outcome: 'ignore', detail: `state=${state ?? 'none'} confirmation=${confirmation ?? 'none'}` };
}
