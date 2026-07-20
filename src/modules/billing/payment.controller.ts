import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { WebhookSignatureGuard } from '@common/webhooks/webhook-signature.guard';
import { PayfastPaymentProvider } from '@providers/payment/payfast.provider';

@Controller('payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  /** Tenant initiates payment for an invoice; returns a gateway redirect/ref. */
  @UseGuards(JwtAuthGuard)
  @Post('invoices/:invoiceId/initiate')
  initiate(
    @Param('invoiceId') invoiceId: string,
    @Body() body: { method?: 'eft' | 'card' },
  ) {
    return this.payments.initiate(invoiceId, body?.method ?? 'eft');
  }

  // ---- Provider webhooks (money-in confirmation). Each is HMAC/signature-verified. ----

  /** Stitch webhook — HMAC over raw body via STITCH_WEBHOOK_SECRET. */
  @UseGuards(WebhookSignatureGuard('STITCH_WEBHOOK_SECRET'))
  @Post('webhook/stitch')
  stitch(@Body() body: { gatewayRef: string; status: 'succeeded' | 'failed' }) {
    return this.payments.confirm(body.gatewayRef, body.status === 'succeeded');
  }

  /** Yoco webhook — HMAC over raw body via YOCO_WEBHOOK_SECRET. */
  @UseGuards(WebhookSignatureGuard('YOCO_WEBHOOK_SECRET'))
  @Post('webhook/yoco')
  yoco(@Body() body: any) {
    const ref = body?.payload?.metadata?.checkoutId ?? body?.id ?? body?.gatewayRef;
    const ok = (body?.type ?? body?.status ?? '').toString().includes('succeeded');
    return this.payments.confirm(ref, ok);
  }

  /** Peach webhook — HMAC over raw body via PEACH_WEBHOOK_SECRET. */
  @UseGuards(WebhookSignatureGuard('PEACH_WEBHOOK_SECRET'))
  @Post('webhook/peach')
  peach(@Body() body: any) {
    const ref = body?.checkoutId ?? body?.id ?? body?.merchantTransactionId ?? body?.gatewayRef;
    const code: string = body?.result?.code ?? body?.status ?? '';
    // Peach success result codes start with 000.000 / 000.100.
    const ok = /^000\.(000|100)/.test(code) || String(body?.status).toLowerCase() === 'succeeded';
    return this.payments.confirm(ref, ok);
  }

  /**
   * PayFast ITN (Instant Transaction Notification). Form-posted with an md5
   * signature (not HMAC), so it's verified here against PAYFAST_PASSPHRASE.
   * m_payment_id is our invoice id; the stored ref is `pf_<invoiceId>`.
   */
  @Post('webhook/payfast')
  payfast(@Body() body: Record<string, string>) {
    const { signature, ...fields } = body ?? {};
    const passphrase = process.env.PAYFAST_PASSPHRASE;
    const valid = !passphrase || PayfastPaymentProvider.sign(fields, passphrase) === signature;
    if (!valid) return; // silently drop forged notifications
    const ref = `pf_${body.m_payment_id}`;
    return this.payments.confirm(ref, (body.payment_status ?? '').toUpperCase() === 'COMPLETE');
  }
}
