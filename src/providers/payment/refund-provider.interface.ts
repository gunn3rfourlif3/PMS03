/**
 * Refund capability, kept separate from `PaymentProvider`.
 *
 * Only some rails can reverse a payment — PayFast cannot, iKhokha is not wired
 * for it — so widening the core interface would force five providers to grow a
 * method that throws. A capability interface lets calling code ask "can this
 * rail refund?" with a type guard instead of a try/catch.
 */

export type RefundReason =
  | 'duplicate'
  | 'fraudulent'
  | 'requested_by_customer'
  | 'incorrect_amount'
  | 'other';

export interface RefundRequest {
  /** The gateway ref of the original payment (Stitch's payment request id). */
  paymentRef: string;
  /** Rands. Omit for a full refund; partial refunds may not exceed the original. */
  amount: number;
  currency: string;
  reason: RefundReason;
  /**
   * Stable key for this refund. Same rule as payouts: a retry must reuse it, or
   * a timeout turns into a second refund. Refunding twice is materially worse
   * than not refunding, because the money is gone and the tenant did not ask
   * for it.
   */
  idempotencyKey: string;
  /** Shown on the payer's statement. Truncated to 20 characters. */
  statementReference?: string;
}

export interface RefundResult {
  providerRef: string;
  status: 'pending' | 'paid' | 'failed';
  /** Populated on failure so the reason reaches an operator, not just a log. */
  error?: string;
}

export interface RefundCapable {
  refund(req: RefundRequest): Promise<RefundResult>;
}

export function canRefund(p: unknown): p is RefundCapable {
  return typeof (p as RefundCapable)?.refund === 'function';
}
