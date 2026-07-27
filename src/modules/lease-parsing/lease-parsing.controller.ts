import {
  Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { LeaseParsingService } from './lease-parsing.service';
import { UploadedFileLike } from '@modules/media/media.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner', 'property_manager')
@Controller('lease-parsing')
export class LeaseParsingController {
  constructor(private readonly service: LeaseParsingService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  parse(@CurrentTenant() p: { userId: string }, @UploadedFile() file: UploadedFileLike) {
    return this.service.parse(p.userId, file);
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.service.markConfirmed(id);
  }
}
