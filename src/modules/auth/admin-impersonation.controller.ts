import { Body, Controller, Get, Post, Ip, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { CurrentTenant } from './current-tenant.decorator';

/** Platform-admin: list agencies, open one's back office (impersonate), audit log. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin')
export class AdminImpersonationController {
  constructor(private readonly auth: AuthService) {}

  @Get('agencies')
  agencies() {
    return this.auth.listAgencies();
  }

  @Get('impersonation-events')
  events() {
    return this.auth.impersonationEvents();
  }

  @Post('impersonate')
  impersonate(
    @CurrentTenant() admin: { userId: string; roles: string[]; act?: unknown },
    @Body() body: { vendorId: string; reason?: string },
    @Ip() ip: string,
  ) {
    return this.auth.impersonate(admin, body?.vendorId, body?.reason, ip);
  }
}
