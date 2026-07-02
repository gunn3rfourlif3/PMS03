import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';

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
   * Provider webhook. In production, verify the provider signature BEFORE
   * trusting the body, and resolve vendor context from the payload/reference.
   * Left as a TODO — do not ship without signature verification.
   */
  @Post('webhook/stitch')
  webhook(@Body() body: { gatewayRef: string; status: 'succeeded' | 'failed' }) {
    return this.payments.confirm(body.gatewayRef, body.status === 'succeeded');
  }
}
