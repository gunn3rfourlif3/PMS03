import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider, CollectRequest, CollectResult, PayoutRequest, PayoutResult,
} from './payment-provider.interface';

/**
 * ZA card + marketplace rail (Paystack). Real HTTP integration, gated on
 * PAYSTACK_SECRET_KEY: with a key it calls the live API; without one it degrades
 * to a safe local stub so dev/CI keep working. Amounts are ZAR, sent in cents.
 */
@Injectable()
export class PaystackPaymentProvider implements PaymentProvider {
  readonly name = 'paystack';
  private readonly logger = new Logger('Paystack');
  private readonly base = process.env.PAYSTACK_BASE ?? 'https://api.paystack.co';
  private get key(): string | undefined { return process.env.PAYSTACK_SECRET_KEY || undefined; }

  private async call<T = any>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.status === false) {
      throw new Error(`Paystack ${path} failed: ${json?.message ?? res.statusText}`);
    }
    return json.data as T;
  }

  async collect(req: CollectRequest): Promise<CollectResult> {
    const reference = `inv_${req.invoiceId}`;
    // Stubbed unless explicitly enabled (first deploy uses iKhokha only).
    if (process.env.PAYSTACK_LIVE !== 'true' || !this.key) return { providerRef: reference, status: 'pending' };
    // Payer email would come from the invoice's tenant in production; kept generic here.
    const email = req.payerEmail ?? `invoice_${req.invoiceId}@pay.local`;
    const data = await this.call<{ authorization_url: string; reference: string }>(
      '/transaction/initialize',
      { email, amount: Math.round(req.amount * 100), currency: req.currency, reference },
    );
    return { providerRef: data.reference, status: 'pending', redirectUrl: data.authorization_url };
  }

  async payout(req: PayoutRequest): Promise<PayoutResult> {
    const ref = `ps_payout_${req.ownerId}`;
    const bank = req.bankAccount;
    if (process.env.PAYSTACK_LIVE !== 'true' || !this.key || !bank?.accountNumber) return { providerRef: ref, status: 'scheduled' };

    // 1) upsert a transfer recipient (NUBAN), 2) initiate the transfer.
    const recipient = await this.call<{ recipient_code: string }>('/transferrecipient', {
      type: 'nuban',
      name: bank.accountHolder ?? 'Owner',
      account_number: bank.accountNumber,
      bank_code: bank.branchCode,
      currency: req.currency,
    });
    const transfer = await this.call<{ transfer_code: string; status: string }>('/transfer', {
      source: 'balance',
      amount: Math.round(req.amount * 100),
      recipient: recipient.recipient_code,
      reason: `Owner payout ${req.ownerId}`,
    });
    this.logger.log(`Paystack transfer ${transfer.transfer_code} (${transfer.status}) for owner ${req.ownerId}`);
    return { providerRef: transfer.transfer_code, status: transfer.status === 'success' ? 'paid' : 'scheduled' };
  }
}
