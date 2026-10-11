import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

/**
 * Reject anything that is not a real 'YYYY-MM-DD' rather than passing it on.
 * The shape check alone is not enough: `Date.parse('2026-02-29T00:00:00Z')`
 * rolls over to 1 March instead of failing, so an impossible date would be
 * accepted and quietly answer for a different day. Round-trip to catch it.
 */
function isIsoDate(v?: string): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

@Controller('reporting')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('rent-roll')
  rentRoll() {
    return this.service.rentRoll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('arrears')
  arrears() {
    return this.service.arrearsAging();
  }

  /**
   * Per-unit portfolio state for the god's-eye view. RLS keeps it to the
   * caller's own agency. `?asOf=YYYY-MM-DD` fixes the date the state is judged
   * against, so a recorded scene replays identically.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('portfolio-state')
  portfolioState(@Query('asOf') asOf?: string) {
    return this.service.portfolioState(isIsoDate(asOf) ? asOf : undefined);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('collection/:period')
  collection(@Param('period') period: string) {
    return this.service.collectionSummary(period);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('income/:period')
  income(@Param('period') period: string) {
    return this.service.incomeStatement(period);
  }
}
