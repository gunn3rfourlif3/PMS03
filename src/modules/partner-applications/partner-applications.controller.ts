import { Body, Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { PartnerApplicationsService } from './partner-applications.service';
import { UploadedFileLike } from '@modules/media/media.service';
import { CreateApplicationDto, SubmitDto, UploadDocDto } from './partner-applications.dto';

/** PUBLIC partner-vetting application. Uploads + submit are gated by the upload
 *  token returned from create (no login needed to apply). */
@Controller('partner-applications')
export class PartnerApplicationsController {
  constructor(private readonly svc: PartnerApplicationsService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateApplicationDto) {
    return this.svc.create(dto);
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
