import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  PaymentProvider, CollectRequest, CollectResult, PayoutRequest, PayoutResult,
} from './payment-provider.interface';

/**
 * iKhokha iK Pay API — the live collection rail for the first deploy. Creates a
 * hosted paylink and returns its redirect URL; the tenant pays there and iKhokha
 * confirms via the callback webhook.
 *
 * Auth (per iKhokha's official examples): `IK-APPID` header = Application Key ID,
 * `IK-SIGN` = HMAC-SHA256 of (endpoint path + JSON body), escaped, signed with the
 * Application Key Secret. Gated on IKHOKHA_APP_ID + IKHOKHA_APP_SECRET (blank ->
 * safe stub). Collection only — payout() is unsupported.
 */
@Injectable()
export class IkhokhaPaymentProvider implements PaymentProvider {
  readonly name = 'ikhokha';
  private readonly logger = new Logger('iKhokha');

  private get appId() { return process.env.IKHOKHA_APP_ID || undefined; }
  private get secret() { return process.env.IKHOKHA_APP_SECRET || ''; }
  private get base() { return process.env.IKHOKHA_BASE ?? 'https://api.ikhokha.com'; }
  private get path() { return process.env.IKHOKHA_PAYMENT_PATH ?? '/public-api/v1/api/payment'; }

  /**
   * iKhokha payload escaping (from their sample): escape backslash, double-quote
   * and apostrophe. Their sample also escapes null bytes, which never occur in
   * compact JSON, so that no-op step is omitted (escaping anything else, e.g.
   * spaces, would produce a payload that doesn't match iKhokha's own signature).
   */
  private static escape(s: string): string {
    return s.replace(/[\\"']/g, '\\$&');
  }

  /** Signature over (endpoint path + JSON body), HMAC-SHA256 hex. */
  static sign(path: string, body: string, secret: string): string {
    return createHmac('sha256', secret.trim())
      .update(IkhokhaPaymentProvider.escape(path + body))
      .digest('hex');
  }

  /**
   * Verify an inbound callback signature (IK-SIGN) over the callback path + raw
   * body. Timing-safe. `path` should be the callback URL's pathname (the value
   * iKhokha signed), and `rawBody` the exact bytes received.
   */
  static verify(path: string, rawBody: string, secret: string, provided?: string): boolean {
    if (!provided) return false;
    const expected = IkhokhaPaymentProvider.sign(path, rawBody, secret);
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async collect(req: CollectRequest): Promise<CollectResult> {
    const providerRef = `ik_${req.invoiceId}`;
    if (!this.appId || !this.secret) {
      return { providerRef, status: 'pending' }; // dev / unconfigured stub
    }
    const endpoint = `${this.base}${this.path}`;
    const signPath = new URL(endpoint).pathname;

    const request = {
      entityID: process.env.IKHOKHA_ENTITY_ID || req.vendorId, // free-text (our ref)
      externalEntityID: req.vendorId,
      amount: Math.round(req.amount * 100), // cents
      currency: req.currency,
      requesterUrl: process.env.IKHOKHA_REQUESTER_URL ?? process.env.IKHOKHA_SUCCESS_URL ?? '',
      description: `Rent invoice ${req.invoiceId}`,
      paymentReference: req.invoiceId,
      mode: process.env.IKHOKHA_MODE ?? 'live', // only 'live' works currently
      externalTransactionID: req.invoiceId,
      urls: {
        callbackUrl: process.env.IKHOKHA_CALLBACK_URL,
        successPageUrl: process.env.IKHOKHA_SUCCESS_URL,
        failurePageUrl: process.env.IKHOKHA_FAIL_URL,
        cancelUrl: process.env.IKHOKHA_CANCEL_URL,
      },
    };
    const body = JSON.stringify(request);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'IK-APPID': this.appId.trim(),
          'IK-SIGN': IkhokhaPaymentProvider.sign(signPath, body, this.secret),
        },
        body,
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || !json?.paylinkUrl) {
        throw new Error(json?.responseMessage ?? json?.message ?? `ikhokha ${res.status} (code ${json?.responseCode})`);
      }
      return { providerRef, status: 'pending', redirectUrl: json.paylinkUrl };
    } catch (e: any) {
      this.logger.error(`collect failed: ${e.message}`);
      return { providerRef, status: 'failed' };
    }
  }

  async payout(_req: PayoutRequest): Promise<PayoutResult> {
    throw new NotImplementedException('iKhokha does not support owner payouts — payouts are handled manually (EFT) for the first deploy.');
  }
}
