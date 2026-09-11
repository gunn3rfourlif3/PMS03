import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ChangelogService } from './changelog.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

/** Platform-admin: what changed, who hears about it, and the one button. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@Controller('admin/changelog')
export class AdminChangelogController {
  constructor(private readonly svc: ChangelogService) {}

  @Get() list() { return this.svc.list(); }

  /** Renders the exact email without sending it. */
  @Post('preview') preview(@Body() body: { ids: string[] }) {
    return this.svc.preview(body?.ids ?? []);
  }

  @Post('send')
  send(@CurrentTenant() principal: { userId: string }, @Body() body: { ids: string[] }) {
    return this.svc.send(body?.ids ?? [], principal.userId);
  }
}
