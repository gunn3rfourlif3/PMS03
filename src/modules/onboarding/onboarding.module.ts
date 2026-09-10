import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgencyOnboardingItem } from './agency-onboarding-item.entity';
import { OnboardingService } from './onboarding.service';
import { AdminOnboardingController } from './admin-onboarding.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AgencyOnboardingItem])],
  providers: [OnboardingService],
  controllers: [AdminOnboardingController],
  exports: [OnboardingService],
})
export class OnboardingModule {}
