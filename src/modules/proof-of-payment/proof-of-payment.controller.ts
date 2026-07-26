import {
  Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProofOfPaymentService, SubmitProofInput } from './proof-of-payment.service';
import { UploadedFileLike } from '@modules/media/media.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';

@Controller('proof-of-payment')
export class ProofOfPaymentController {
  constructor(private readonly service: ProofOfPaymentService) {}

  // ---- Tenant ----
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  submit(
    @CurrentTenant() p: { userId: string },
    @UploadedFile() file: UploadedFileLike,
    @Body() body: SubmitProofInput,
  ) {
    return this.service.submit(p.userId, body, file);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  mine(@CurrentTenant() p: { userId: string }) {
    return this.service.mine(p.userId);
  }

  // ---- Staff ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Get()
  list(@Query('status') status?: string) {
    return this.service.listForStaff(status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentTenant() p: { userId: string }) {
    return this.service.accept(id, p.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentTenant() p: { userId: string }, @Body() body: { reason?: string }) {
    return this.service.reject(id, p.userId, body?.reason);
  }
}
