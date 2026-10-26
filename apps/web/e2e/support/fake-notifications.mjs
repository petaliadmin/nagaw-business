// Notifications part of the fake API (see fake-backend.mjs). Same shared
// rules as the real API (ADR-036): categories by role, thresholds per
// shop, changed by managers only. Push messages are not configured here,
// as on a server without VAPID keys.
import {
  NOTIFICATION_CATEGORY_RULES,
  notificationCategoriesFor,
  roleHasPermission,
  updateNotificationPreferencesSchema,
  updateNotificationSettingsSchema,
} from '@nagaw/shared';

const DEFAULT_SETTINGS = {
  sellerStockCorrectionMax: 20,
  stockForecastDays: 3,
  stockForecastWindowDays: 14,
  creditOverdueDays: 30,
  creditNearLimitPercent: 80,
  dailySummaryHour: 20,
};

function seed() {
  return { settings: {}, preferences: {}, notifications: [] };
}
let state = seed();
export function resetNotifications() {
  state = seed();
}

/** For the sales part (stock corrections at the counter). */
export const shopSettings = (orgId) => ({
  ...DEFAULT_SETTINGS,
  ...state.settings[orgId],
});

/**
 * Routes of a person, whatever the shop: push messages are not configured
 * on the fake server (publicKey null), like the real one without keys.
 */
export function handlePush({ req, res, path, send }) {
  if (path === '/api/v1/push/config' && req.method === 'GET') {
    send(res, 200, { publicKey: null });
    return true;
  }
  if (path === '/api/v1/push/subscriptions' && req.method === 'POST') {
    send(res, 200, { subscribed: true });
    return true;
  }
  if (path === '/api/v1/push/subscriptions/remove' && req.method === 'POST') {
    send(res, 200, { subscribed: false });
    return true;
  }
  return false;
}

/** `ctx`: { req, res, path, user, orgId, role, send, apiError, readJson, forbidden }. */
export async function handleNotifications(ctx) {
  const { req, res, path, user, orgId, role, send, apiError } = ctx;
  if (!path.startsWith('/api/v1/notifications')) return false;
  const reply = (status, body) => {
    send(res, status, body);
    return true;
  };
  const mine = state.notifications.filter(
    (n) => n.organizationId === orgId && n.recipientId === user.id,
  );
  const unread = () => mine.filter((n) => !n.read).length;

  if (path === '/api/v1/notifications' && req.method === 'GET')
    return reply(200, { items: mine, unread: unread(), nextCursor: null });
  if (path === '/api/v1/notifications/unread-count' && req.method === 'GET')
    return reply(200, { unread: unread() });
  if (path === '/api/v1/notifications/read' && req.method === 'POST') {
    const body = await ctx.readJson(req);
    for (const n of mine)
      if (!body?.ids || body.ids.includes(n.id)) n.read = true;
    return reply(200, { unread: unread() });
  }
  if (path === '/api/v1/notifications/preferences') {
    const key = `${orgId}:${user.id}`;
    const current = () =>
      notificationCategoriesFor(role).map((category) => ({
        category,
        enabled:
          NOTIFICATION_CATEGORY_RULES[category].defaultRoles.includes(role),
        push: true,
        ...state.preferences[key]?.[category],
      }));
    if (req.method === 'GET') return reply(200, current());
    if (req.method === 'PUT') {
      const parsed = updateNotificationPreferencesSchema.safeParse(
        await ctx.readJson(req),
      );
      if (!parsed.success)
        return reply(400, {
          error: { code: 'VALIDATION_FAILED', message: 'Données invalides.' },
        });
      const allowed = notificationCategoriesFor(role);
      if (parsed.data.preferences.some((p) => !allowed.includes(p.category)))
        return reply(400, {
          error: { code: 'VALIDATION_FAILED', message: 'Données invalides.' },
        });
      state.preferences[key] ??= {};
      for (const p of parsed.data.preferences)
        state.preferences[key][p.category] = {
          enabled: p.enabled,
          push: p.push,
        };
      return reply(200, current());
    }
  }
  if (path === '/api/v1/notifications/settings') {
    if (req.method === 'GET') return reply(200, shopSettings(orgId));
    if (req.method === 'PATCH') {
      if (!roleHasPermission(role, 'organization.update')) {
        ctx.forbidden(res);
        return true;
      }
      const parsed = updateNotificationSettingsSchema.safeParse(
        await ctx.readJson(req),
      );
      if (!parsed.success) {
        apiError(res, 400, 'VALIDATION_FAILED', 'Données invalides.');
        return true;
      }
      state.settings[orgId] = { ...shopSettings(orgId), ...parsed.data };
      return reply(200, shopSettings(orgId));
    }
  }
  return false;
}
