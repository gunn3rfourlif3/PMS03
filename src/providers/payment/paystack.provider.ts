import { Injectable } from '@nestjs/common';
import {
  PaymentProvider, CollectRequest, CollectResult, PayoutRequest, PayoutResult,
} from './payment-provider.interface';

/**
 * ZA Phase-2 rail: card-heavy + Transaction Splits / subaccounts for
 * marketplace owner settlement. Stub — wire to Paystack API.
 */
@Injectable()
export class PaystackPaymentProvider implements PaymentProvider {
  readonly name = 'paystack';

  async collect(req: CollectRequest): Promise<CollectResult> {
    return { providerRef: `ps_${req.invoiceId}`, status: 'pending' };
  }

  async payout(req: PayoutRequest): Promise<PayoutResult> {
    // TODO: use Transaction Splits so platform + owner settle simultaneously.
    return { providerRef: `ps_payout_${req.ownerId}`, status: 'scheduled' };
  }
}
