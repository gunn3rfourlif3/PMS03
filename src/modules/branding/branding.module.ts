import { Module } from '@nestjs/common';
import { BrandingController } from './branding.controller';
import { SettingsController } from './settings.controller';
import { BrandingService } from './branding.service';

@Module({
  controllers: [BrandingController, SettingsController],
  providers: [BrandingService],
})
export class BrandingModule {}
