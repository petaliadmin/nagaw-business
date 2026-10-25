import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../admin/platform-admin.guard.js';
import {
  AdminFeedbackController,
  FeedbackController,
} from './feedback.controller.js';
import { FeedbackService } from './feedback.service.js';

@Module({
  controllers: [FeedbackController, AdminFeedbackController],
  providers: [FeedbackService, PlatformAdminGuard],
})
export class FeedbackModule {}
