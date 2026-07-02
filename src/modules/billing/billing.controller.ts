import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingScheduler } from './billing.scheduler';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly service: BillingService,
    private readonly scheduler: BillingScheduler,
  ) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }

  /**
   * Manually enqueue a rent-invoice run for a period (dev/ops trigger; the
   * scheduler also runs this monthly).
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('run')
  run(@Body() body: { period: string; dueDate: string }) {
    return this.scheduler.enqueueForPeriod(body.period, body.dueDate);
  }
}
