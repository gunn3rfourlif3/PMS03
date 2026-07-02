import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { WebhookSignatureGuard } from '@common/webhooks/webhook-signature.guard';

@Controller('payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  /** Tenant initiates payment for an invoice; returns a pay-by-bank redirect. */
  @UseGuards(JwtAuthGuard)
  @Post('invoices/:invoiceId/initiate')
  initiate(
    @Param('invoiceId') invoiceId: string,
    @Body() body: { method?: 'eft' | 'card' },
  ) {
    return this.payments.initiate(invoiceId, body?.method ?? 'eft');
  }

  /**
   * Provider webhook. HMAC-verified over the raw body via STITCH_WEBHOOK_SECRET
   * before the body is trusted; vendor context is resolved from the reference.
   */
  @UseGuards(WebhookSignatureGuard('STITCH_WEBHOOK_SECRET'))
  @Post('webhook/stitch')
  webhook(@Body() body: { gatewayRef: string; status: 'succeeded' | 'failed' }) {
    return this.payments.confirm(body.gatewayRef, body.status === 'succeeded');
  }
}
