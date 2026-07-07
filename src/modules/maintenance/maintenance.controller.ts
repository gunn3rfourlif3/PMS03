import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MaintenanceService, CreateTicketInput } from './maintenance.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get('health')
  health() {
    return { status: this.service.ping() };
  }

  // ---- Tenant (any authenticated user) ----
  @UseGuards(JwtAuthGuard)
  @Post('tickets')
  create(@Body() body: CreateTicketInput, @CurrentTenant() p: { userId: string }) {
    return this.service.createTicket(body, p.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('tickets/mine')
  mine(@CurrentTenant() p: { userId: string }) {
    return this.service.myTickets(p.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tickets/:id/approve')
  approve(@Param('id') id: string) {
    return this.service.approveTicket(id);
  }

  // ---- Manager ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('tickets')
  list() {
    return this.service.listTickets();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('work-orders')
  workOrders() {
    return this.service.listWorkOrders();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('tickets/:id/work-order')
  assign(@Param('id') id: string, @Body() body: { contractorId?: string; scheduledFor?: string }) {
    return this.service.assign(id, body.contractorId, body.scheduledFor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('work-orders/:id/progress')
  progress(@Param('id') id: string) {
    return this.service.progressWorkOrder(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('work-orders/:id/complete')
  complete(@Param('id') id: string, @Body() body: { cost?: number; ownerBillable?: boolean }) {
    return this.service.completeWorkOrder(id, body?.cost, body?.ownerBillable ?? false);
  }
}
