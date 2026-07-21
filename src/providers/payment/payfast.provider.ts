import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  PaymentProvider, CollectRequest, CollectResult, PayoutRequest, PayoutResult,
} from './payment-provider.interface';

/**
 * PayFast (ZA) — redirect / hosted-page collection. No server call to start: we
 * build a signed redirect URL to PayFast's process page; the tenant pays there
 * and PayFast confirms via an ITN webhook. Owner payouts are NOT supported by
 * PayFast (use a payout rail such as Paystack) — payout() therefore refuses.
 */
@Injectable()
export class PayfastPaymentProvider implements PaymentProvider {
  readonly name = 'payfast';
  private readonly logger = new Logger('PayFast');

  private get sandbox() { return process.env.PAYFAST_SANDBOX !== 'false'; }
  private get processUrl() {
    return this.sandbox ? 'https://sandbox.payfast.co.za/eng/process' : 'https://www.payfast.co.za/eng/process';
  }

  /** PayFast signature: md5 of the urlencoded param string (+ optional passphrase). */
  static sign(fields: Record<string, string>, passphrase?: string): string {
    const enc = (v: string) => encodeURIComponent(v.trim()).replace(/%20/g, '+');
    let str = Object.entries(fields).filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => `${k}=${enc(String(v))}`).join('&');
    if (passphrase) str += `&passphrase=${enc(passphrase)}`;
    return createHash('md5').update(str).digest('hex');
  }

  async collect(req: CollectRequest): Promise<CollectResult> {
    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
    const providerRef = `pf_${req.invoiceId}`;
    // Stubbed unless explicitly enabled (first deploy uses iKhokha only).
    if (process.env.PAYFAST_LIVE !== 'true' || !merchantId || !merchantKey) {
      return { providerRef, status: 'pending' };
    }
    const fields: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: process.env.PAYFAST_RETURN_URL ?? '',
      cancel_url: process.env.PAYFAST_CANCEL_URL ?? '',
      notify_url: process.env.PAYFAST_NOTIFY_URL ?? '',
      m_payment_id: req.invoiceId,
      amount: req.amount.toFixed(2),
      item_name: `Invoice ${req.invoiceId}`,
      ...(req.payerEmail ? { email_address: req.payerEmail } : {}),
    };
    fields.signature = PayfastPaymentProvider.sign(fields, process.env.PAYFAST_PASSPHRASE);
    const query = Object.entries(fields).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return { providerRef, status: 'pending', redirectUrl: `${this.processUrl}?${query}` };
  }

  async payout(_req: PayoutRequest): Promise<PayoutResult> {
    throw new NotImplementedException('PayFast does not support owner payouts — set PAYOUT_PROVIDER to a payout-capable rail (e.g. paystack).');
  }
}
