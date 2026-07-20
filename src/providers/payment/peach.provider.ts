import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import {
  PaymentProvider, CollectRequest, CollectResult, PayoutRequest, PayoutResult,
} from './payment-provider.interface';

/**
 * Peach Payments (ZA) — hosted Checkout. Creates a checkout via the configured
 * endpoint (PEACH_CHECKOUT_URL) with a bearer token and returns the hosted
 * redirect URL; Peach confirms via webhook. Endpoint/token are configurable
 * because Peach's auth (OAuth token exchange) is environment-specific. Gated on
 * PEACH_CHECKOUT_URL + PEACH_BEARER_TOKEN (blank -> safe local stub).
 */
@Injectable()
export class PeachPaymentProvider implements PaymentProvider {
  readonly name = 'peach';
  private readonly logger = new Logger('Peach');
  private get url() { return process.env.PEACH_CHECKOUT_URL || undefined; }
  private get token() { return process.env.PEACH_BEARER_TOKEN || ''; }

  async collect(req: CollectRequest): Promise<CollectResult> {
    const ref = `peach_${req.invoiceId}`;
    if (!this.url) return { providerRef: ref, status: 'pending' };
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: req.amount.toFixed(2),
          currency: req.currency,
          merchantTransactionId: req.invoiceId,
          entityId: process.env.PEACH_ENTITY_ID,
          shopperResultUrl: process.env.PEACH_RESULT_URL,
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      const redirectUrl = json?.redirectUrl ?? json?.redirect_url ?? json?.url;
      if (!res.ok || !redirectUrl) throw new Error(json?.message ?? `peach ${res.status}`);
      return { providerRef: json.checkoutId ?? json.id ?? ref, status: 'pending', redirectUrl };
    } catch (e: any) {
      this.logger.error(`collect failed: ${e.message}`);
      return { providerRef: ref, status: 'failed' };
    }
  }

  async payout(_req: PayoutRequest): Promise<PayoutResult> {
    throw new NotImplementedException('Peach does not support owner payouts — set PAYOUT_PROVIDER to a payout-capable rail (e.g. paystack).');
  }
}
