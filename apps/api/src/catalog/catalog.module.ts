import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { ReferencesController } from './references.controller.js';
import { ReferencesService } from './references.service.js';
import { StockService } from './stock.service.js';

@Module({
  controllers: [ReferencesController, ProductsController],
  providers: [ReferencesService, ProductsService, StockService],
})
export class CatalogModule {}
