import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service.js';
import { StatsService } from './stats.service.js';
import { TreasuryController } from './treasury.controller.js';
import { TreasuryService } from './treasury.service.js';

@Module({
  controllers: [TreasuryController],
  providers: [TreasuryService, ExpensesService, StatsService],
})
export class TreasuryModule {}
