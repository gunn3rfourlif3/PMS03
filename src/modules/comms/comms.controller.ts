import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CommsService, Principal } from './comms.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

@Controller('messages')
export class CommsController {
  constructor(private readonly service: CommsService) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }

  // ---- Any authenticated user ----
  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  unread(@CurrentTenant() p: Principal) {
    return this.service.unreadCount(p);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  mine(@CurrentTenant() p: Principal) {
    return this.service.mine(p.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations')
  start(@CurrentTenant() p: Principal, @Body() body: { subject: string; body: string; unitId?: string; tenantUserId?: string }) {
    return this.service.start(p, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id')
  thread(@Param('id') id: string, @CurrentTenant() p: Principal) {
    return this.service.thread(id, p);
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/reply')
  reply(@Param('id') id: string, @CurrentTenant() p: Principal, @Body() body: { body: string }) {
    return this.service.reply(id, p, body.body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/status')
  setStatus(@Param('id') id: string, @CurrentTenant() p: Principal, @Body() body: { status: 'open' | 'closed' }) {
    return this.service.setStatus(id, p, body.status);
  }

  // ---- Staff only ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('inbox')
  inbox() {
    return this.service.inbox();
  }
}
