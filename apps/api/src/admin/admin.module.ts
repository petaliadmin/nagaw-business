import { Module } from '@nestjs/common';
import { PhoneAuthModule } from '../phone-auth/phone-auth.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { PlatformAdminGuard } from './platform-admin.guard.js';

@Module({
  imports: [PhoneAuthModule, SubscriptionsModule],
  controllers: [AdminController],
  providers: [AdminService, PlatformAdminGuard],
})
export class AdminModule {}
