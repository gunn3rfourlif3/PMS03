import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { emailMarkPng, EmailMarkVariant } from '@common/email/email-mark';

/**
 * Serves the fallback logo mark used in email headers.
 *
 * Deliberately unguarded: the recipient's mail client fetches this with no
 * credentials, from an IP we know nothing about. There is nothing tenant-
 * specific in it — it is the same neutral mark for every agency, which is why
 * it can be public and cached hard.
 */
@Controller('brand')
export class EmailMarkController {
  @Get('email-mark-:variant.png')
  serve(@Param('variant') variant: string, @Res() res: Response) {
    if (variant !== 'white' && variant !== 'ink') throw new NotFoundException();
    const png = emailMarkPng(variant as EmailMarkVariant);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', png.length);
    // Immutable: the mark only changes with a deploy, and a new deploy can ship
    // a new filename if it ever needs to.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(png);
  }
}
