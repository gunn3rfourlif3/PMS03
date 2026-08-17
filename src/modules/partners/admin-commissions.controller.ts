import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PartnerCommissionsService } from './commissions.service';
import { PartnerCommissionsScheduler } from './commissions.scheduler';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

/** Platform-admin: review, run, approve and pay partner commissions. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin/commissions')
export class AdminCommissionsController {
  constructor(
    private readonly commissions: PartnerCommissionsService,
    private readonly scheduler: PartnerCommissionsScheduler,
  ) {}

  @Get() list(@Query('status') status?: string) { return this.commissions.adminList(status); }

  /** Accrue a period now (defaults to the current month). */
  @Post('run') run(@Body() body: { period?: string }) { return this.commissions.accrue(body?.period); }

  /** This month's run sheet: who is payable, who is held, and why (§4.1). */
  @Get('payout-run') payoutRun() { return this.commissions.payoutRun(); }

  /** Record that a partner's approved balance has been paid out by EFT. */
  @Post('payout-run/:partnerId/pay')
  payPartner(@Param('partnerId') partnerId: string, @Body() body: { ref?: string }) {
    return this.commissions.payPartner(partnerId, body?.ref);
  }

  /** Partner/agency pairs showing signs of self-dealing (§7.4). */
  @Get('self-dealing') selfDealing() { return this.commissions.selfDealingReport(); }

  @Post(':id/approve') approve(@Param('id') id: string) { return this.commissions.approve(id); }
  @Post(':id/pay') pay(@Param('id') id: string, @Body() body: { ref?: string }) { return this.commissions.pay(id, body?.ref); }
  @Post(':id/cancel') cancel(@Param('id') id: string) { return this.commissions.cancel(id); }
}
