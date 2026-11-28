import { Module } from '@nestjs/common';
import { StorefrontPublicController } from './storefront-public.controller.js';
import { StorefrontController } from './storefront.controller.js';
import { StorefrontService } from './storefront.service.js';

/** Ma vitrine (ADR-075). */
@Module({
  controllers: [StorefrontPublicController, StorefrontController],
  providers: [StorefrontService],
})
export class StorefrontModule {}
