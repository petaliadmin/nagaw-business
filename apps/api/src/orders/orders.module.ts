import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PublicCatalogController } from './public-catalog.controller.js';

@Module({
  imports: [CatalogModule, OrganizationsModule, SalesModule],
  controllers: [PublicCatalogController, OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
