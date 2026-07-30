import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_SUBSCRIPTION } from '@common/queue/queue.constants';
import { PaymentModule } from '@providers/payment/payment.module';
import { VendorSubscription } from './vendor-subscription.entity';
import { SubscriptionInvoice } from './subscription-invoice.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionBillingService } from './subscription-billing.service';
import { SubscriptionBillingScheduler } from './subscription-billing.scheduler';
import { SubscriptionBillingProcessor } from './subscription-billing.processor';
import { SubscriptionsController } from './subscriptions.controller';
import { AdminSubscriptionInvoicesController } from './admin-subscription-invoices.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([VendorSubscription, SubscriptionInvoice]),
    BullModule.registerQueue({ name: QUEUE_SUBSCRIPTION }),
    PaymentModule,
  ],
  providers: [SubscriptionsService, SubscriptionBillingService, SubscriptionBillingScheduler, SubscriptionBillingProcessor],
  controllers: [SubscriptionsController, AdminSubscriptionInvoicesController],
  exports: [SubscriptionsService, SubscriptionBillingService],
})
export class SubscriptionsModule {}
