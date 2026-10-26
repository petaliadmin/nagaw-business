import { Global, Module } from '@nestjs/common';
import { AlertsService } from './alerts.service.js';
import { CronController } from './cron.controller.js';
import { DailyService } from './daily.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { PushService } from './push.service.js';

/** Global: sales, stock, documents and treasury tell their events. */
@Global()
@Module({
  controllers: [NotificationsController, CronController],
  providers: [NotificationsService, PushService, AlertsService, DailyService],
  exports: [AlertsService],
})
export class NotificationsModule {}
