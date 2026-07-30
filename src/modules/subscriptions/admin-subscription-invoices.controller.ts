import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SubscriptionBillingService } from './subscription-billing.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

/** Platform-admin: generate, review, mark-paid and void subscription invoices. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin/subscription-invoices')
export class AdminSubscriptionInvoicesController {
  constructor(private readonly billing: SubscriptionBillingService) {}

  @Get() list(@Query('status') status?: string) { return this.billing.adminList(status); }
  @Post('run') run(@Body() body: { period?: string }) { return this.billing.generate(body?.period); }
  @Post(':id/paid') paid(@Param('id') id: string, @Body() body: { ref?: string }) { return this.billing.markPaid(id, body?.ref); }
  @Post(':id/void') void_(@Param('id') id: string) { return this.billing.void(id); }
}
