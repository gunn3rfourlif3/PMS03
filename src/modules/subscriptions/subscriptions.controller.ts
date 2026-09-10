import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionBillingService } from './subscription-billing.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';
import { effectivePrice, ladder, nextBand } from './subscription-calc';
import { payToDetails } from '@common/config/pay-to';

/** Vendor-facing: an agency sees its own plan (tier, units, MRR) and bills. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner', 'property_manager')
@Controller('subscription')
export class SubscriptionsController {
  constructor(
    private readonly subs: SubscriptionsService,
    private readonly billing: SubscriptionBillingService,
  ) {}

  /**
   * The agency's own plan, plus the ladder it is priced against.
   *
   * `mrr` is the tier's list price; `payable` is what they are actually billed,
   * which differs for an agency on a negotiated `priceOverride`. The back-office
   * must show the second one — telling a grandfathered customer they owe list
   * price is how a billing conversation starts badly.
   */
  @Get()
  async mine(@CurrentTenant() principal: { vendorId: string }) {
    const sub = await this.subs.mine(principal.vendorId);
    const { amount, overridden } = effectivePrice(sub);
    return {
      ...sub,
      payable: amount,
      overridden,
      ladder: ladder(),
      nextBand: nextBand(sub.unitCount ?? 0),
      // Null when unconfigured, so the UI hides the EFT panel rather than
      // showing an agency a half-filled set of banking details.
      payTo: payToDetails(),
    };
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
