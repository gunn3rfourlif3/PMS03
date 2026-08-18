import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { DebitMandate } from './debit-mandate.entity';
import { MandatesService } from './mandates.service';
import { DebiCheckController } from './debicheck.controller';

/**
 * DebiCheck — authenticated debit-order mandates.
 * See docs/LOCARE_DEBIT_ORDER_DESIGN.md.
 *
 * Mandate lifecycle only at this stage. Collection submission is deliberately
 * not here yet (§11 build order): the lifecycle should be observable and
 * correct before any money moves through it, because §6 notes a debit order can
 * fail days after appearing to succeed.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DebitMandate]), NotificationsModule],
  controllers: [DebiCheckController],
  providers: [MandatesService],
  exports: [MandatesService],
})
export class DebiCheckModule {}
