import { Body, Controller, Get, Param, Post, Query, Sse, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { CommsEvents } from './comms.events';
import { CommsService, Principal } from './comms.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

@Controller('messages')
export class CommsController {
  constructor(
    private readonly service: CommsService,
    private readonly events: CommsEvents,
    private readonly jwt: JwtService,
  ) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }

  /**
   * Live message stream (Server-Sent Events). EventSource can't set headers, so
   * the JWT is passed as ?token= and verified here. Staff receive all of their
   * vendor's activity; a tenant receives only their own conversations'.
   */
  @Sse('stream')
  stream(@Query('token') token: string): Observable<{ data: unknown }> {
    let principal: { userId: string; vendorId: string; roles: string[] };
    try {
      const p: any = this.jwt.verify(token, { secret: process.env.JWT_SECRET ?? 'change-me-in-prod' });
      principal = { userId: p.sub ?? p.userId, vendorId: p.vendorId, roles: p.roles ?? [] };
    } catch {
      throw new UnauthorizedException('Invalid stream token');
    }
    const staff = (principal.roles ?? []).some((r) => r === 'vendor_owner' || r === 'property_manager');
    return this.events.stream().pipe(
      filter((e) => e.vendorId === principal.vendorId && (staff || e.tenantUserId === principal.userId)),
      map((e) => ({ data: e })),
    );
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
