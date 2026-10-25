import { Module } from '@nestjs/common';
import { TreasuryService } from '../treasury/treasury.service.js';
import { AccountingController } from './accounting.controller.js';
import { AccountingService } from './accounting.service.js';

@Module({
  controllers: [AccountingController],
  providers: [AccountingService, TreasuryService],
})
export class AccountingModule {}
