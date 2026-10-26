import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  listNotificationsQuerySchema,
  markNotificationsReadSchema,
  pushSubscriptionSchema,
  removePushSubscriptionSchema,
  updateNotificationPreferencesSchema,
  updateNotificationSettingsSchema,
  type ListNotificationsQuery,
  type MarkNotificationsReadInput,
  type NotificationListDto,
  type NotificationPreferenceDto,
  type NotificationSettingsDto,
  type PushConfigDto,
  type PushSubscriptionInput,
  type RemovePushSubscriptionInput,
  type UpdateNotificationPreferencesInput,
  type UpdateNotificationSettingsInput,
} from '@nagaw/shared';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { DailyService } from './daily.service.js';
import { NotificationsService } from './notifications.service.js';
import { PushService } from './push.service.js';

/**
 * A person's notifications in the active shop (ADR-036). Every member
 * reads and marks only their own; the shop's thresholds are changed by
 * those who manage the shop.
 */
@Controller()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly daily: DailyService,
    private readonly push: PushService,
  ) {}

  /**
   * Opening the application prepares the shop's day if the scheduled run
   * has not done it yet; a failure there never hides the notifications.
   */
  private async catchUp(organizationId: string): Promise<void> {
    try {
      await this.daily.runForOrganization(organizationId);
    } catch (error) {
      this.logger.error(
        { err: error, organizationId },
        'Notifications du jour non préparées',
      );
    }
  }

  @Get('notifications')
  @RequirePermission('organization.read')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Query(new ZodValidationPipe(listNotificationsQuerySchema))
    query: ListNotificationsQuery,
  ): Promise<NotificationListDto> {
    if (!query.cursor) await this.catchUp(tenant.organizationId);
    return this.notifications.list(tenant, user, query);
  }

  @Get('notifications/unread-count')
  @RequirePermission('organization.read')
  async unread(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
  ): Promise<{ unread: number }> {
    await this.catchUp(tenant.organizationId);
    return { unread: await this.notifications.unreadCount(tenant, user) };
  }

  @Post('notifications/read')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('organization.read')
  markRead(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(markNotificationsReadSchema))
    body: MarkNotificationsReadInput,
  ): Promise<{ unread: number }> {
    return this.notifications.markRead(tenant, user, body.ids);
  }

  @Get('notifications/preferences')
  @RequirePermission('organization.read')
  preferences(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
  ): Promise<NotificationPreferenceDto[]> {
    return this.notifications.preferences(tenant, user);
  }

  @Put('notifications/preferences')
  @RequirePermission('organization.read')
  updatePreferences(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(updateNotificationPreferencesSchema))
    body: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferenceDto[]> {
    return this.notifications.updatePreferences(tenant, user, body);
  }

  @Get('notifications/settings')
  @RequirePermission('organization.read')
  settings(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<NotificationSettingsDto> {
    return this.notifications.settings(tenant.organizationId);
  }

  @Patch('notifications/settings')
  @RequirePermission('organization.update')
  updateSettings(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(updateNotificationSettingsSchema))
    body: UpdateNotificationSettingsInput,
    @RequestId() requestId: string | null,
  ): Promise<NotificationSettingsDto> {
    return this.notifications.updateSettings(tenant, user, body, requestId);
  }

  // Push: a browser belongs to a person, whatever the shop.

  @Get('push/config')
  config(): PushConfigDto {
    return { publicKey: this.push.publicKey };
  }

  @Post('push/subscriptions')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(pushSubscriptionSchema))
    body: PushSubscriptionInput,
  ): Promise<{ subscribed: true }> {
    await this.push.subscribe(user, body);
    return { subscribed: true };
  }

  @Post('push/subscriptions/remove')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(removePushSubscriptionSchema))
    body: RemovePushSubscriptionInput,
  ): Promise<{ subscribed: false }> {
    await this.push.unsubscribe(user, body);
    return { subscribed: false };
  }
}
