import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UtilitiesService, CreateMeterInput, CaptureReadingInput } from './utilities.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

/**
 * Staff only. Utility capture is back-office work: a clerk walks a building and
 * types what the dials say. Tenants do not self-read here — a tenant-submitted
 * reading is a different feature with a verification problem attached.
 */
@Controller('utilities')
export class UtilitiesController {
  constructor(private readonly service: UtilitiesService) {}

  @Get('health')
  health() {
    return { status: this.service.ping() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('meters')
  listMeters(
    @Query('unitId') unitId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listMeters({ unitId, propertyId, limit: Number(limit), offset: Number(offset) });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('meters')
  createMeter(@Body() body: CreateMeterInput) {
    return this.service.createMeter(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('meters/:id/remove')
  removeMeter(@Param('id') id: string) {
    return this.service.removeMeter(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('meters/:id/readings')
  listReadings(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.service.listReadings(id, Number(limit) || 50);
  }

  /** Bulk against the sum of its submeters: what was paid for and not recovered. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('recovery-gap')
  recoveryGap(
    @Query('propertyId') propertyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.recoveryGap({ propertyId, from, to });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('readings')
  capture(@Body() body: CaptureReadingInput, @CurrentTenant() p: { userId: string }) {
    return this.service.captureReading(body, p.userId);
  }
}
