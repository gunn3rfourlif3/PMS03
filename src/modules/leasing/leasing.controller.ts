import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AddTenantInput, LeasingService } from './leasing.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@Controller('leasing')
export class LeasingController {
  constructor(private readonly service: LeasingService) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get()
  list() {
    return this.service.list();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('tenants')
  addTenant(@Body() body: AddTenantInput) {
    return this.service.addTenant(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post(':id/renew')
  renew(@Param('id') id: string, @Body() body: { escalationPct?: number; months?: number; newEndDate?: string }) {
    return this.service.renew(id, body);
  }
}
