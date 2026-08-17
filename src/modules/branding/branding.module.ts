import { Module } from '@nestjs/common';
import { BrandingController } from './branding.controller';
import { SettingsController } from './settings.controller';
import { BrandingService } from './branding.service';
import { EmailMarkController } from './email-mark.controller';

@Module({
  controllers: [BrandingController, SettingsController, EmailMarkController],
  providers: [BrandingService],
})
export class BrandingModule {}
