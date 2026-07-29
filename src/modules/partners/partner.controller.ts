import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnerDealsService } from './deals.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

type P = { partnerId?: string | null };

/** Partner-facing portal API. Every method is scoped to the token's partnerId. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('partner')
@Controller('partner')
export class PartnerController {
  constructor(
    private readonly partners: PartnersService,
    private readonly deals: PartnerDealsService,
  ) {}

  @Get('overview') overview(@CurrentTenant() p: P) { return this.partners.overview(p.partnerId); }
  @Get('me') me(@CurrentTenant() p: P) { return this.partners.me(p.partnerId); }
  @Get('agencies') agencies(@CurrentTenant() p: P) { return this.partners.agencies(p.partnerId); }
  @Get('referral') referral(@CurrentTenant() p: P) { return this.partners.referral(p.partnerId); }
  @Get('leaderboard') leaderboard() { return this.deals.leaderboard(); }

  @Post('agencies')
  onboard(@CurrentTenant() p: P, @Body() body: { agencyName: string; slug?: string; ownerName: string; ownerEmail: string; expectedUnits?: number }) {
    return this.partners.onboardAgency(p.partnerId, body);
  }

  // ── Pipeline ──
  @Get('deals') deals_(@CurrentTenant() p: P) { return this.deals.list(p.partnerId); }
  @Post('deals') createDeal(@CurrentTenant() p: P, @Body() body: any) { return this.deals.create(p.partnerId, body); }
  @Put('deals/:id') updateDeal(@CurrentTenant() p: P, @Param('id') id: string, @Body() body: any) { return this.deals.update(p.partnerId, id, body); }
  @Post('deals/:id/stage') moveStage(@CurrentTenant() p: P, @Param('id') id: string, @Body() body: { stage: string; lostReason?: string }) {
    return this.deals.moveStage(p.partnerId, id, body.stage, body.lostReason);
  }

  // ── Activity ──
  @Get('activities') activities(@CurrentTenant() p: P) { return this.deals.activityFeed(p.partnerId); }
  @Post('activities') logActivity(@CurrentTenant() p: P, @Body() body: { type: any; summary?: string; dealId?: string }) {
    return this.deals.logActivity(p.partnerId, body);
  }
}
