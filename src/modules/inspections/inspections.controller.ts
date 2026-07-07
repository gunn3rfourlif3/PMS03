import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { InspectionItem, InspectionType } from './inspection.entity';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner', 'property_manager')
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly service: InspectionsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() body: { unitId: string; leaseId?: string; type: InspectionType }) {
    return this.service.create(body);
  }

  @Post(':id/items')
  recordItems(@Param('id') id: string, @Body() body: { items: InspectionItem[] }) {
    return this.service.recordItems(id, body.items);
  }

  @Post(':id/signoff')
  signOff(@Param('id') id: string) {
    return this.service.signOff(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post(':id/apply-to-deposit/:depositId')
  applyToDeposit(@Param('id') id: string, @Param('depositId') depositId: string) {
    return this.service.applyToDeposit(id, depositId);
  }
}
