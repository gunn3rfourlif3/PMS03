import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PartnersService } from './partners.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

/** PUBLIC: referral self-signup (no auth). Rate-limited — it creates records. */
@Controller('partners')
export class PartnerSignupController {
  constructor(private readonly partners: PartnersService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('ref/:code')
  validate(@Param('code') code: string) { return this.partners.validateRef(code); }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  signup(@Body() body: { ref: string; agencyName: string; ownerName: string; ownerEmail: string }) {
    return this.partners.publicSignup(body.ref, body);
  }
}

/** Platform-admin: approve pending referral signups. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin/signups')
export class AdminSignupsController {
  constructor(private readonly partners: PartnersService) {}

  @Get() list() { return this.partners.listPendingSignups(); }

  @Post(':vendorId/approve')
  approve(@Param('vendorId') vendorId: string) { return this.partners.approveSignup(vendorId); }
}
