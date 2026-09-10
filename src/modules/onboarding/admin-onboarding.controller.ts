import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';
import { OnboardingStatus, WaitingOn } from './agency-onboarding-item.entity';

/**
 * Platform-admin only. The console is Locare's view across agencies, so it must
 * never be reachable from an agency's own branded host or by their staff.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin/onboarding')
export class AdminOnboardingController {
  // ParseUUIDPipe so a bad id returns a plain 400 instead of Postgres'
  // "invalid input syntax for type uuid" surfacing in the UI — which is what a
  // caller reading the wrong field name produced the first time this shipped.

  constructor(private readonly svc: OnboardingService) {}

  /** Every agency with an onboarding, longest-stalled first. */
  @Get() portfolio() { return this.svc.portfolio(); }

  @Get(':vendorId') detail(@Param('vendorId', ParseUUIDPipe) vendorId: string) {
    return this.svc.detail(vendorId);
  }

  /** Idempotent — safe on an agency that already has a checklist. */
  @Post(':vendorId/seed') seed(@Param('vendorId', ParseUUIDPipe) vendorId: string) {
    return this.svc.seed(vendorId);
  }

  @Patch(':vendorId/items/:itemKey')
  update(
    @CurrentTenant() principal: { userId: string },
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Param('itemKey') itemKey: string,
    @Body() body: { status?: OnboardingStatus; waitingOn?: WaitingOn; ownerUserId?: string | null; notes?: string | null },
  ) {
    return this.svc.updateItem(vendorId, itemKey, principal.userId, body);
  }
}
