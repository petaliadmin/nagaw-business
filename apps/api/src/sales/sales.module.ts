import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CustomersService } from './customers.service.js';
import { DevicesService } from './devices.service.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [SalesController, SyncController],
  providers: [SalesService, CustomersService, DevicesService, SyncService],
})
export class SalesModule {}
