import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeasingController } from './leasing.controller';
import { LeasingService } from './leasing.service';
import { Lease } from './lease.entity';
import { IdentityModule } from '@modules/identity/identity.module';
import { BillingModule } from '@modules/billing/billing.module';

@Module({
  imports: [TypeOrmModule.forFeature([Lease]), IdentityModule, BillingModule],
  controllers: [LeasingController],
  providers: [LeasingService],
  exports: [LeasingService],
})
export class LeasingModule {}
