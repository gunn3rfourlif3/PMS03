import { Controller, Get, Param } from '@nestjs/common';
import { BrandingService } from './branding.service';

/**
 * Public, unauthenticated white-label theme lookup. Apps call this at boot
 * (before login) so the login screen is already branded.
 *   GET /branding/:slug  ->  complete Branding theme
 */
@Controller('branding')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.branding.resolve(slug);
  }
}
