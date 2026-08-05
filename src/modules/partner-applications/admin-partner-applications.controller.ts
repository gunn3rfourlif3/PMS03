import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PartnerApplicationsService } from './partner-applications.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';
import { ApproveApplicationDto, DecisionDto } from './partner-applications.dto';

/** Platform-admin review queue for partner vetting applications. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin/partner-applications')
export class AdminPartnerApplicationsController {
  constructor(private readonly svc: PartnerApplicationsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.svc.list(status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.detail(id);
  }

  @Post(':id/review')
  review(@Param('id') id: string, @CurrentTenant() p: { userId: string }) {
    return this.svc.review(id, p.userId);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentTenant() p: { userId: string }, @Body() dto: ApproveApplicationDto) {
    return this.svc.approve(id, p.userId, { commissionRate: dto.commissionRate, commissionMonths: dto.commissionMonths ?? null });
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentTenant() p: { userId: string }, @Body() dto: DecisionDto) {
    return this.svc.reject(id, p.userId, dto.reason);
  }

  @Post(':id/request-info')
  requestInfo(@Param('id') id: string, @CurrentTenant() p: { userId: string }, @Body() dto: DecisionDto) {
    return this.svc.requestInfo(id, p.userId, dto.note);
  }
}
