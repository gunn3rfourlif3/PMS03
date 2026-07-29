import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

/** Platform-admin: manage partners (you, via PLATFORM_ADMIN_EMAILS). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin/partners')
export class AdminPartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Get() list() { return this.partners.listPartners(); }

  @Post()
  create(@Body() body: { name: string; contactEmail?: string; contactPhone?: string; company?: string; commissionRate?: number; commissionMonths?: number | null }) {
    return this.partners.createPartner(body);
  }

  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: 'pending' | 'active' | 'suspended' }) {
    return this.partners.setPartnerStatus(id, body.status);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: { email: string; name?: string }) {
    return this.partners.addMember(id, body.email, body.name);
  }
}
