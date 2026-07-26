import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { LeaseAgreementService } from './lease-agreement.service';
import { UploadedFileLike } from '@modules/media/media.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@Controller('lease-agreements')
export class LeaseAgreementController {
  constructor(private readonly service: LeaseAgreementService) {}

  // ---- Public signing (no auth; resolved by unguessable ref) ----
  @Get('sign/:ref')
  publicGet(@Param('ref') ref: string) {
    return this.service.publicGet(ref);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('sign/:ref/complete')
  complete(@Param('ref') ref: string, @Body() body: { fullName: string }, @Req() req: any) {
    const fwd = (req.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0];
    const ip = (fwd || req.ip || '').trim();
    return this.service.complete(ref, body?.fullName, ip);
  }

  // ---- Staff ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get('template')
  getTemplate() {
    return this.service.getTemplate();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Put('template')
  setTemplate(@Body() body: { template: string }) {
    return this.service.setTemplate(body?.template);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post('template-file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadTemplateFile(@UploadedFile() file: UploadedFileLike) {
    return this.service.setTemplateFile(file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Delete('template-file')
  clearTemplateFile() {
    return this.service.clearTemplateFile();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get()
  list(@Query('leaseId') leaseId?: string) {
    return this.service.list(leaseId);
  }
}
