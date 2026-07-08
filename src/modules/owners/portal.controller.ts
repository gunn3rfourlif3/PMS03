import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { PortalService } from './portal.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

/** Property-owner self-service portal. Owner role only. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner')
@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('me')
  me(@CurrentTenant() p: { userId: string }) {
    return this.portal.me(p.userId);
  }

  @Get('summary')
  summary(@CurrentTenant() p: { userId: string }) {
    return this.portal.summary(p.userId);
  }

  @Get('properties')
  properties(@CurrentTenant() p: { userId: string }) {
    return this.portal.properties(p.userId);
  }

  @Get('statements')
  statements(@CurrentTenant() p: { userId: string }) {
    return this.portal.statements(p.userId);
  }

  @Get('banking')
  getBanking(@CurrentTenant() p: { userId: string }) {
    return this.portal.getBanking(p.userId);
  }

  @Put('banking')
  updateBanking(@CurrentTenant() p: { userId: string }, @Body() body: Record<string, unknown>) {
    return this.portal.updateBanking(p.userId, body);
  }
}
