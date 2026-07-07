import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ServiceProvidersService } from './service-providers.service';
import { ServiceProvider } from './service-provider.entity';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner', 'property_manager')
@Controller('service-providers')
export class ServiceProvidersController {
  constructor(private readonly service: ServiceProvidersService) {}

  @Get()
  list(@Query('category') category?: string) {
    return this.service.list(category);
  }

  @Post()
  create(@Body() body: Partial<ServiceProvider>) {
    return this.service.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<ServiceProvider>) {
    return this.service.update(id, body);
  }

  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.service.setStatus(id, body.status);
  }
}
