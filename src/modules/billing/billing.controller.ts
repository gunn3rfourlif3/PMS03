import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { TenantContextService } from '@common/tenancy/tenant-context.service';
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
    private readonly tenant: TenantContextService,
  ) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }

  /**
   * Run billing for a month — for the CALLER'S agency only.
   *
   * This used to enqueue an unscoped job, and the worker bills every agency
   * when a job names none: any agency's owner or manager could invoice every
   * other agency's tenants for any month, and email them. The agency now comes
   * from the signed-in user's context, never from the request body.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('run')
  async run(@Body() body: { period: string; dueDate?: string }) {
    const vendorId = this.tenant.vendorId;
    if (!vendorId) throw new ForbiddenException('Billing runs belong to an agency; this session has none.');
    const period = String(body?.period ?? '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('period must be YYYY-MM');
    const dueDate = body?.dueDate ? String(body.dueDate) : `${period}-07`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) {
      throw new BadRequestException('dueDate must be YYYY-MM-DD');
    }
    await this.scheduler.enqueueForVendor(vendorId, period, dueDate);
    return { queued: true, period, dueDate };
  }
}
