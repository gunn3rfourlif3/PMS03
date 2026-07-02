import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DocumentsService, RequestUploadInput } from './documents.service';
import { EsignService } from './esign.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { CurrentTenant } from '@modules/auth/current-tenant.decorator';
import { WebhookSignatureGuard } from '@common/webhooks/webhook-signature.guard';
import { DocOwnerType } from './document.entity';
import { SignatureStatus } from './signature-request.entity';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly esign: EsignService,
  ) {}

  @Get('health')
  health() {
    return { status: this.docs.ping() };
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-url')
  requestUpload(@Body() body: RequestUploadInput) {
    return this.docs.requestUpload(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.docs.confirmUpload(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/download-url')
  download(@Param('id') id: string, @CurrentTenant() principal: { roles: string[] }) {
    return this.docs.getDownloadUrl(id, principal?.roles ?? []);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Query('ownerType') ownerType: DocOwnerType, @Query('ownerId') ownerId: string) {
    return this.docs.listForEntity(ownerType, ownerId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/signature')
  requestSignature(@Param('id') id: string, @Body() body: { signerEmail: string; signerName?: string }) {
    return this.esign.requestSignature(id, body.signerEmail, body.signerName);
  }

  /** E-sign provider webhook. HMAC-verified via ESIGN_WEBHOOK_SECRET. */
  @UseGuards(WebhookSignatureGuard('ESIGN_WEBHOOK_SECRET'))
  @Post('signature/webhook')
  signatureWebhook(@Body() body: { providerRef: string; status: SignatureStatus }) {
    return this.esign.handleCallback(body.providerRef, body.status);
  }
}
