import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AgentsService, AgentInput, RecordCommissionInput } from './agents.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner', 'property_manager')
@Controller('agents')
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  // ---- Commissions (literal routes first) ----
  @Get('commissions')
  listCommissions(@Query('agentId') agentId?: string, @Query('status') status?: string) {
    return this.service.listCommissions(agentId, status);
  }

  @Post('commissions')
  record(@CurrentTenant() p: { userId: string }, @Body() body: RecordCommissionInput) {
    return this.service.recordCommission(p.userId, body);
  }

  @Post('commissions/:id/approve')
  approve(@Param('id') id: string) {
    return this.service.approve(id);
  }

  @Post('commissions/:id/pay')
  pay(@Param('id') id: string, @Body() body: { reference?: string }) {
    return this.service.pay(id, body?.reference);
  }

  @Post('commissions/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  // ---- Agents ----
  @Get()
  list() {
    return this.service.listAgents();
  }

  @Post()
  create(@Body() body: AgentInput) {
    return this.service.createAgent(body);
  }

  @Get(':id/statement')
  statement(@Param('id') id: string) {
    return this.service.statement(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: AgentInput) {
    return this.service.updateAgent(id, body);
  }

  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: 'active' | 'inactive' }) {
    return this.service.setStatus(id, body.status);
  }
}
