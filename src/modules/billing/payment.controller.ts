import { Body, Controller, Logger, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { WebhookSignatureGuard } from '@common/webhooks/webhook-signature.guard';
import { PayfastPaymentProvider } from '@providers/payment/payfast.provider';
import { IkhokhaPaymentProvider } from '@providers/payment/ikhokha.provider';

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
   * iKhokha payment callback. The stored ref is `ik_<invoiceId>`, reconstructed
   * from the returned externalTransactionID. Success is responseCode "00" (or a
   * SUCCESS/COMPLETE status). Signature verification is opt-in via
   * IKHOKHA_VERIFY_CALLBACK once the exact inbound scheme is confirmed.
   */
  @Post('webhook/ikhokha')
  ikhokha(@Req() req: RawBodyRequest<Request>, @Body() body: any) {
    // Optional signature verification (enable IKHOKHA_VERIFY_CALLBACK=true once the
    // inbound IK-SIGN scheme is confirmed with a real callback). iKhokha signs over
    // the callback URL's path + raw body with the app secret.
    if (process.env.IKHOKHA_VERIFY_CALLBACK === 'true') {
      const secret = process.env.IKHOKHA_APP_SECRET ?? '';
      const path = process.env.IKHOKHA_CALLBACK_URL
        ? new URL(process.env.IKHOKHA_CALLBACK_URL).pathname
        : (req.originalUrl || '').split('?')[0];
      const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});
      const provided = (req.headers['ik-sign'] ?? req.headers['IK-SIGN']) as string | undefined;
      if (!IkhokhaPaymentProvider.verify(path, raw, secret, provided)) {
        new Logger('iKhokhaWebhook').warn('Rejected callback: invalid IK-SIGN signature');
        throw new UnauthorizedException('Invalid signature');
      }
    }
    const ref = `ik_${body?.externalTransactionID ?? body?.paymentReference ?? body?.externalEntityID}`;
    const code = String(body?.responseCode ?? '');
    const status = String(body?.status ?? '').toUpperCase();
    const ok = code === '00' || status === 'SUCCESS' || status === 'COMPLETE' || status === 'SUCCEEDED';
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
