import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';

@Module({
  controllers: [SalesController],
  providers: [SalesService, CustomersService],
})
export class SalesModule {}
