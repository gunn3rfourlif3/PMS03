import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import {
  PaymentProvider, CollectRequest, CollectResult, PayoutRequest, PayoutResult,
} from './payment-provider.interface';

/**
 * Yoco (ZA) — Checkout API (card). One server call creates a checkout and
 * returns a hosted redirect URL; Yoco confirms via webhook. Gated on
 * YOCO_SECRET_KEY (blank -> safe local stub). Payouts unsupported.
 */
@Injectable()
export class YocoPaymentProvider implements PaymentProvider {
  readonly name = 'yoco';
  private readonly logger = new Logger('Yoco');
  private get key() { return process.env.YOCO_SECRET_KEY || undefined; }

  async collect(req: CollectRequest): Promise<CollectResult> {
    const ref = `yoco_${req.invoiceId}`;
    if (process.env.YOCO_LIVE !== 'true' || !this.key) return { providerRef: ref, status: 'pending' };
    try {
      const res = await fetch('https://payments.yoco.com/api/checkouts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(req.amount * 100),
          currency: req.currency,
          metadata: { invoiceId: req.invoiceId, vendorId: req.vendorId },
          successUrl: process.env.YOCO_SUCCESS_URL,
          cancelUrl: process.env.YOCO_CANCEL_URL,
          failureUrl: process.env.YOCO_FAILURE_URL,
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || !json?.redirectUrl) throw new Error(json?.message ?? `yoco ${res.status}`);
      return { providerRef: json.id ?? ref, status: 'pending', redirectUrl: json.redirectUrl };
    } catch (e: any) {
      this.logger.error(`collect failed: ${e.message}`);
      return { providerRef: ref, status: 'failed' };
    }
  }

  async payout(_req: PayoutRequest): Promise<PayoutResult> {
    throw new NotImplementedException('Yoco does not support owner payouts — set PAYOUT_PROVIDER to a payout-capable rail (e.g. paystack).');
  }
}
