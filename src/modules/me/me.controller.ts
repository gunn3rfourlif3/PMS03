import { Controller, Get, UseGuards } from '@nestjs/common';
import { MeService } from './me.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

/** Tenant-facing self-service API (any authenticated user). */
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('profile')
  profile(@CurrentTenant() principal: { userId: string }) {
    return this.me.profile(principal.userId);
  }

  @Get('notifications')
  notifications(@CurrentTenant() principal: { userId: string }) {
    return this.me.notifications(principal.userId);
  }

  @Get('invoices')
  invoices(@CurrentTenant() principal: { userId: string }) {
    return this.me.invoices(principal.userId);
  }

  @Get('lease')
  lease(@CurrentTenant() principal: { userId: string }) {
    return this.me.activeLease(principal.userId);
  }
}
