import {
  Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { MediaService, UploadedFileLike } from './media.service';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Authenticated image upload → returns the public URL to store/display. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor_owner', 'property_manager')
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@UploadedFile() file: UploadedFileLike) {
    return this.media.save(file);
  }

  /** Public read — images are shown on the rentals site and in-app. */
  @Get(':key')
  serve(@Param('key') key: string, @Res() res: Response) {
    const { path, contentType } = this.media.resolve(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    createReadStream(path).pipe(res);
  }
}
