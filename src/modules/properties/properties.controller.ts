import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PropertiesService } from './properties.service';
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

  @UseGuards(JwtAuthGuard)
  @Get('units')
  listUnits() {
    return this.service.listUnits(); // RLS-scoped to caller's vendor
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post()
  create(@Body() body: { name: string }) {
    return this.service.createProperty(body);
  }
}
