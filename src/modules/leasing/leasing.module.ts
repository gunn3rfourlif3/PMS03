import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeasingController } from './leasing.controller';
import { LeasingService } from './leasing.service';
import { Lease } from './lease.entity';
import { IdentityModule } from '@modules/identity/identity.module';
import { BillingModule } from '@modules/billing/billing.module';
import { LeaseAgreementModule } from '@modules/lease-agreement/lease-agreement.module';

@Module({
  imports: [TypeOrmModule.forFeature([Lease]), IdentityModule, BillingModule, LeaseAgreementModule],
  controllers: [LeasingController],
  providers: [LeasingService],
  exports: [LeasingService],
})
export class LeasingModule {}
