import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { DunningService } from './dunning.service';
import { DepositService } from './deposit.service';
import { DepositController } from './deposit.controller';
import { BillingProcessor } from './billing.processor';
import { BillingScheduler } from './billing.scheduler';
import { Invoice } from './invoice.entity';
import { Deposit } from './deposit.entity';
import { Payment } from './payment.entity';
import { AccountingModule } from '@modules/accounting/accounting.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { PaymentModule } from '@providers/payment/payment.module';
import { QUEUE_BILLING } from '@common/queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, Deposit, Payment]),
    BullModule.registerQueue({ name: QUEUE_BILLING }),
    AccountingModule,
    NotificationsModule,
    PaymentModule,
  ],
  controllers: [BillingController, PaymentController, DepositController],
  providers: [
    BillingService,
    InvoiceService,
    PaymentService,
    DunningService,
    DepositService,
    BillingProcessor,
    BillingScheduler,
  ],
  exports: [InvoiceService, PaymentService, DepositService],
})
export class BillingModule {}
