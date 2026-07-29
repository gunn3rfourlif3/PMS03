import { Controller, Get, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

/** Vendor-facing: an agency sees its own plan (tier, units, MRR). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner', 'property_manager')
@Controller('subscription')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get()
  mine(@CurrentTenant() principal: { vendorId: string }) {
    return this.subs.mine(principal.vendorId);
  }
}
