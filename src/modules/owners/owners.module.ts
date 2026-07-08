import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnersController } from './owners.controller';
import { PortalController } from './portal.controller';
import { OwnersService } from './owners.service';
import { OwnerStatementService } from './owner-statement.service';
import { PortalService } from './portal.service';
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
  controllers: [OwnersController, PortalController],
  providers: [OwnersService, OwnerStatementService, PortalService],
  exports: [OwnersService],
})
export class OwnersModule {}
