import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';
import { OwnerStatementService } from './owner-statement.service';
import { Owner } from './owner.entity';
import { OwnerStatement } from './owner-statement.entity';
import { Payout } from './payout.entity';
import { AccountingModule } from '@modules/accounting/accounting.module';
import { ExpensesModule } from '@modules/expenses/expenses.module';
import { PaymentModule } from '@providers/payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Owner, OwnerStatement, Payout]),
    AccountingModule,
    ExpensesModule,
    PaymentModule,
  ],
  controllers: [OwnersController],
  providers: [OwnersService, OwnerStatementService],
  exports: [OwnersService],
})
export class OwnersModule {}
