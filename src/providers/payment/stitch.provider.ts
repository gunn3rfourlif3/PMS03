import { Injectable } from '@nestjs/common';
import {
  PaymentProvider, CollectRequest, CollectResult, PayoutRequest, PayoutResult,
} from './payment-provider.interface';

/**
 * ZA Phase-1 rail: instant EFT / pay-by-bank (dominant + cheaper than cards).
 * Stub — wire to Stitch API. TRUST-MONEY RULE (PPA): do not auto-split the
 * platform fee out of client money here; route to trust first, settle fee separately.
 */
@Injectable()
export class StitchPaymentProvider implements PaymentProvider {
  readonly name = 'stitch';

  async collect(req: CollectRequest): Promise<CollectResult> {
    // TODO: create Stitch payment request; return redirect/pay-by-bank link.
    return { providerRef: `stitch_${req.invoiceId}`, status: 'pending' };
  }

  async payout(req: PayoutRequest): Promise<PayoutResult> {
    // TODO: Stitch payout to owner trust/bank account.
    return { providerRef: `stitch_payout_${req.ownerId}`, status: 'scheduled' };
  }
}
