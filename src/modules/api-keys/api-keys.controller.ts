import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

/** Key management — authenticated vendor owners only. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Post()
  create(@Body() body: { name: string; scopes?: string[]; expiresAt?: string }) {
    return this.service.create(body.name, body.scopes ?? [], body.expiresAt);
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string) {
    return this.service.revoke(id);
  }
}
