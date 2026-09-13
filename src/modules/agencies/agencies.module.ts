import { Module } from '@nestjs/common';
import { OnboardingModule } from '@modules/onboarding/onboarding.module';
import { AdminAgenciesController } from './admin-agencies.controller';

@Module({
  imports: [OnboardingModule],
  controllers: [AdminAgenciesController],
})
export class AgenciesModule {}
