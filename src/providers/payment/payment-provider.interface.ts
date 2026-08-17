/**
 * Domain-driven payment abstraction. Interface vocabulary is OURS
 * (collect / hold in trust / settle / pay out), NOT any one provider's API,
 * so provider-isms never leak into billing/accounting.
 *
 * Implementations: StitchPaymentProvider (EFT, Phase 1),
 * PaystackPaymentProvider (Transaction Splits, Phase 2), etc.
 */
export interface CollectRequest {
  vendorId: string;
  invoiceId: string;
  amount: number;
  currency: string; // 'ZAR'
  method?: 'eft' | 'card';
  payerEmail?: string;
}

export interface CollectResult {
  providerRef: string;
  status: 'pending' | 'succeeded' | 'failed';
  redirectUrl?: string;
}

export interface PayoutRequest {
  vendorId: string;
  ownerId: string;
  amount: number;
  currency: string;
  /**
   * Stable key identifying THIS payout, for provider-side de-duplication.
   * Must be the same value on every retry of the same payout and different for
   * every distinct one — the owner statement id is the natural choice, since a
   * statement is exactly the unit of "one payout".
   *
   * Without it a retried request pays an owner twice, and money-out has no
   * equivalent of a chargeback to undo it.
   */
  idempotencyKey?: string;
  bankAccount?: {
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    branchCode?: string;
    accountType?: string;
  };
}

export interface PayoutResult {
  providerRef: string;
  status: 'scheduled' | 'paid' | 'failed';
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER'); // collection (money-in)
export const PAYOUT_PROVIDER = Symbol('PAYOUT_PROVIDER');   // disbursement (money-out)

export interface PaymentProvider {
  readonly name: string;
  collect(req: CollectRequest): Promise<CollectResult>;
  payout(req: PayoutRequest): Promise<PayoutResult>;
}
