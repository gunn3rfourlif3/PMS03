import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';
import { Unit } from './unit.entity';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly service: PropertiesService) {}

  @Get('health')
  health(): { status: string } {
    return { status: this.service.ping() };
  }

  // ---- Units (literal path segments first so they don't collide with :id) ----
  @UseGuards(JwtAuthGuard)
  @Get('units')
  listUnits(@Query('propertyId') propertyId?: string) {
    return this.service.listUnits(propertyId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Put('units/:id')
  updateUnit(@Param('id') id: string, @Body() body: Partial<Unit>) {
    return this.service.updateUnit(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Delete('units/:id')
  removeUnit(@Param('id') id: string) {
    return this.service.removeUnit(id);
  }

  // ---- Properties ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get()
  list() {
    return this.service.listProperties();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post()
  create(@Body() body: Partial<Property>) {
    return this.service.createProperty(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post(':id/units')
  createUnit(@Param('id') id: string, @Body() body: Partial<Unit>) {
    return this.service.createUnit({ ...body, propertyId: id });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<Property>) {
    return this.service.updateProperty(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.removeProperty(id);
  }
}
