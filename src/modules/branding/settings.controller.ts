import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { BrandingService } from './branding.service';
import { Branding } from './branding.types';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { Roles } from '@modules/auth/roles.decorator';

/**
 * Authenticated self-service branding for the caller's own vendor.
 *   GET /settings/branding   -> current theme (to populate the form)
 *   PUT /settings/branding   -> update logo/colors/font/contact, returns theme
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor_owner', 'property_manager')
@Controller('settings/branding')
export class SettingsController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  get() {
    return this.branding.getSettings();
  }

  @Put()
  update(@Body() body: Partial<Branding>) {
    return this.branding.updateSettings(body);
  }
}
