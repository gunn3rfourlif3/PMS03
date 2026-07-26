import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProofOfPaymentController } from './proof-of-payment.controller';
import { ProofOfPaymentService } from './proof-of-payment.service';
import { ProofOfPayment } from './proof-of-payment.entity';
import { BillingModule } from '@modules/billing/billing.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProofOfPayment]), BillingModule],
  controllers: [ProofOfPaymentController],
  providers: [ProofOfPaymentService],
})
export class ProofOfPaymentModule {}
