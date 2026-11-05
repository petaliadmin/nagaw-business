import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PublicCatalogController } from './public-catalog.controller.js';
import { HttpWaveClient, WAVE_CLIENT } from './wave.client.js';
import { WaveWebhookController } from './wave-webhook.controller.js';
import { WaveService } from './wave.service.js';

@Module({
  imports: [CatalogModule, OrganizationsModule, SalesModule],
  controllers: [
    PublicCatalogController,
    WaveWebhookController,
    OrdersController,
  ],
  providers: [
    OrdersService,
    WaveService,
    { provide: WAVE_CLIENT, useClass: HttpWaveClient },
  ],
})
export class OrdersModule {}
