import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { Expense } from './expense.entity';
import { AccountingModule } from '@modules/accounting/accounting.module';

@Module({
  imports: [TypeOrmModule.forFeature([Expense]), AccountingModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService], // owner statements fold in owner-billable expenses
})
export class ExpensesModule {}
