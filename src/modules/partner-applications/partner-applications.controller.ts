import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { PartnerApplicationsService } from './partner-applications.service';
import { UploadedFileLike } from '@modules/media/media.service';
import { SaveDetailsDto, StartApplicationDto, SubmitDto, UploadDocDto } from './partner-applications.dto';

/**
 * PUBLIC partner-vetting application, in two stages:
 *   1. POST /            → contact details only; emails a link to continue.
 *   2. GET/PATCH /:id    → the KYC/KYB detail, gated by the emailed token.
 * Uploads + submit use the same token, so no login is needed to apply.
 */
@Controller('partner-applications')
export class PartnerApplicationsController {
  constructor(private readonly svc: PartnerApplicationsService) {}

  /** Stage 1. Returns no token — the applicant must open the emailed link,
   *  which doubles as verification that the address is real. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  start(@Body() dto: StartApplicationDto) {
    return this.svc.start(dto);
  }

  /** Stage 2 — load the saved draft to prefill the form. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':id')
  resume(@Param('id') id: string, @Query('token') token: string) {
    return this.svc.resume(id, token);
  }

  /** Stage 2 — save vetting details (repeatable, partial). */
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Patch(':id')
  saveDetails(@Param('id') id: string, @Body() dto: SaveDetailsDto) {
    const { token, ...rest } = dto;
    return this.svc.saveDetails(id, token, rest);
  }

  /** Re-send the continue link if theirs expired or never arrived. */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post(':id/resend')
  resend(@Param('id') id: string) {
    return this.svc.resendLink(id);
  }

  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  upload(@Param('id') id: string, @Body() dto: UploadDocDto, @UploadedFile() file: UploadedFileLike) {
    return this.svc.addDocument(id, dto.token, dto.docType ?? 'other', file);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() dto: SubmitDto) {
    return this.svc.submit(id, dto.token);
  }
}
