import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { LedgerService } from './ledger.service';
import { Account } from './account.entity';
import { LedgerEntry } from './ledger-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Account, LedgerEntry])],
  controllers: [AccountingController],
  providers: [AccountingService, LedgerService],
  exports: [LedgerService, AccountingService], // other modules use these
})
export class AccountingModule {}
