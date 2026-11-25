import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { PhoneAuthModule } from '../phone-auth/phone-auth.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { AdminDataService } from './admin-data.service.js';
import { AdminPlansService } from './admin-plans.service.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { PlatformAdminGuard } from './platform-admin.guard.js';

@Module({
  imports: [
    PhoneAuthModule,
    SubscriptionsModule,
    CatalogModule,
    SalesModule,
    DocumentsModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminDataService,
    AdminPlansService,
    PlatformAdminGuard,
  ],
})
export class AdminModule {}
