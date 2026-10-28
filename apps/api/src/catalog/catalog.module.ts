import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { ReferencesController } from './references.controller.js';
import { ReferencesService } from './references.service.js';
import { StockService } from './stock.service.js';
import { UnitTemplatesController } from './unit-templates.controller.js';
import { UnitTemplatesService } from './unit-templates.service.js';

@Module({
  controllers: [
    ReferencesController,
    ProductsController,
    UnitTemplatesController,
  ],
  providers: [
    ReferencesService,
    ProductsService,
    StockService,
    UnitTemplatesService,
  ],
  // The offline checkout sends stock corrections with its sales.
  exports: [StockService],
})
export class CatalogModule {}
