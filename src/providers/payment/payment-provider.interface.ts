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

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProvider {
  readonly name: string;
  collect(req: CollectRequest): Promise<CollectResult>;
  payout(req: PayoutRequest): Promise<PayoutResult>;
}
