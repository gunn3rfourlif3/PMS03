import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionBillingService } from './subscription-billing.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

/** Vendor-facing: an agency sees its own plan (tier, units, MRR) and bills. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner', 'property_manager')
@Controller('subscription')
export class SubscriptionsController {
  constructor(
    private readonly subs: SubscriptionsService,
    private readonly billing: SubscriptionBillingService,
  ) {}

  @Get()
  mine(@CurrentTenant() principal: { vendorId: string }) {
    return this.subs.mine(principal.vendorId);
  }

  @Get('invoices')
  invoices(@CurrentTenant() principal: { vendorId: string }) {
    return this.billing.listForVendor(principal.vendorId);
  }

  @Post('invoices/:id/checkout')
  checkout(@CurrentTenant() principal: { vendorId: string }, @Param('id') id: string) {
    return this.billing.createCheckout(principal.vendorId, id);
  }
}
