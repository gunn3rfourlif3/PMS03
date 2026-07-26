import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaseAgreementController } from './lease-agreement.controller';
import { LeaseAgreementService } from './lease-agreement.service';
import { LeaseAgreement } from './lease-agreement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LeaseAgreement])],
  controllers: [LeaseAgreementController],
  providers: [LeaseAgreementService],
  exports: [LeaseAgreementService],
})
export class LeaseAgreementModule {}
