// Test double for the two external boundaries of the web app: Supabase Auth
// (JWKS + logout) and the Nagaw API. Tokens are real ES256 JWTs signed with a
// key generated at startup, so the web app verifies them exactly as in
// production. Started by Playwright; never used outside end-to-end tests.
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  createLocalJWKSet,
} from 'jose';
import { handleCatalog, resetCatalog } from './fake-catalog.mjs';
import { handleDocuments, resetDocuments } from './fake-documents.mjs';
import { handleSales, resetSales } from './fake-sales.mjs';
import {
  handleTreasury,
  resetTreasury,
  shopsSummary,
} from './fake-treasury.mjs';

const PORT = Number(process.env.FAKE_BACKEND_PORT ?? 54400);
const ORIGIN = `http://localhost:${PORT}`;
const ISSUER = `${ORIGIN}/auth/v1`;
const kid = randomUUID();
const { privateKey, publicKey } = await generateKeyPair('ES256');
const jwks = {
  keys: [{ ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' }],
};
const verifyKey = createLocalJWKSet(jwks);

const ACME = '11111111-1111-4111-8111-111111111111';
const GLOBEX = '22222222-2222-4222-8222-222222222222';
const USERS = {
  awa: { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'awa@acme.test' },
  moussa: {
    id: 'aaaaaaaa-0000-4000-8000-000000000002',
    email: 'moussa@acme.test',
  },
  binta: {
    id: 'aaaaaaaa-0000-4000-8000-000000000003',
    email: 'binta@new.test',
  },
  broken: {
    id: 'aaaaaaaa-0000-4000-8000-000000000004',
    email: 'broken@x.test',
  },
};

const PLANS = [
  {
    key: 'free',
    name: 'Gratuit',
    monthlyPrice: 0,
    currency: 'XOF',
    limits: { products: 50, members: 2, devices: 1 },
  },
  {
    key: 'essential',
    name: 'Essentiel',
    monthlyPrice: 5000,
    currency: 'XOF',
    limits: { products: 500, members: 5, devices: 3 },
  },
  {
    key: 'pro',
    name: 'Pro',
    monthlyPrice: 15000,
    currency: 'XOF',
    limits: { products: 5000, members: 20, devices: 10 },
  },
];

const DOCUMENT_SETTINGS = {
  legalName: '',
  address: '',
  phone: '',
  email: '',
  taxId: '',
  tradeRegister: '',
  invoiceFooter: '',
  invoiceDueDays: 30,
  quoteValidityDays: 30,
};

function makeState() {
  const created = '2026-10-01T09:00:00.000Z';
  const organizations = {
    [ACME]: {
      id: ACME,
      name: 'Acme Dakar',
      slug: 'acme-dakar-1a2b3c',
      status: 'active',
      timezone: 'Africa/Dakar',
      defaultCurrency: 'XOF',
      invitationTtlHours: 168,
      ...DOCUMENT_SETTINGS,
      createdAt: created,
      updatedAt: created,
    },
    [GLOBEX]: {
      id: GLOBEX,
      name: 'Globex Sénégal',
      slug: 'globex-4d5e6f',
      status: 'active',
      timezone: 'UTC',
      defaultCurrency: 'EUR',
      invitationTtlHours: 168,
      ...DOCUMENT_SETTINGS,
      createdAt: created,
      updatedAt: created,
    },
  };
  const memberships = [
    {
      organizationId: ACME,
      userId: USERS.awa.id,
      role: 'owner',
      status: 'active',
      joinedAt: created,
    },
    {
      organizationId: ACME,
      userId: USERS.moussa.id,
      role: 'member',
      status: 'active',
      joinedAt: '2026-10-05T09:00:00.000Z',
    },
    {
      organizationId: GLOBEX,
      userId: USERS.awa.id,
      role: 'member',
      status: 'active',
      joinedAt: created,
    },
    {
      organizationId: GLOBEX,
      userId: USERS.moussa.id,
      role: 'owner',
      status: 'active',
      joinedAt: created,
    },
  ];
  // 27 entries for Acme so that the audit page needs two pages of 25.
  const audit = [];
  let id = 1;
  audit.push({
    id: String(id++),
    organizationId: ACME,
    actorType: 'user',
    actorId: USERS.awa.id,
    action: 'organization.created',
    targetType: 'organization',
    targetId: ACME,
    metadata: {},
    requestId: 'req-0001',
    createdAt: created,
  });
  for (let i = 0; i < 26; i++) {
    audit.push({
      id: String(id++),
      organizationId: ACME,
      actorType: 'user',
      actorId: USERS.awa.id,
      action: 'organization.updated',
      targetType: 'organization',
      targetId: ACME,
      metadata: {},
      requestId: `req-${String(i + 2).padStart(4, '0')}`,
      createdAt: new Date(
        Date.parse(created) + (i + 1) * 3600_000,
      ).toISOString(),
    });
  }
  audit.push({
    id: String(id++),
    organizationId: GLOBEX,
    actorType: 'user',
    actorId: USERS.moussa.id,
    action: 'organization.created',
    targetType: 'organization',
    targetId: GLOBEX,
    metadata: {},
    requestId: 'req-globex',
    createdAt: created,
  });
  return {
    organizations,
    memberships,
    audit,
    nextAuditId: id,
    // { id, organizationId, email, role, status, token, expiresAt, ... }
    invitations: [],
    // Feedback of the shops (ADR-032).
    feedback: [],
    subscriptions: {
      [ACME]: { planKey: 'pro', pending: null },
      [GLOBEX]: { planKey: 'free', pending: null },
    },
  };
}
let state = makeState();

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
const apiError = (res, status, code, message) =>
  send(res, status, { error: { code, message } });

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

async function sessionCookie(userKey) {
  const user = USERS[userKey];
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await new SignJWT({
    role: 'authenticated',
    email: user.email,
    aal: 'aal1',
    session_id: randomUUID(),
    is_anonymous: false,
  })
    .setProtectedHeader({ alg: 'ES256', kid, typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
  const session = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'fake-refresh-token',
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-10-01T09:00:00.000Z',
    },
  };
  return {
    name: 'sb-localhost-auth-token',
    value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
  };
}

async function authenticate(req) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], verifyKey, {
      issuer: ISSUER,
      audience: 'authenticated',
    });
    return Object.values(USERS).find((u) => u.id === payload.sub) ?? null;
  } catch {
    return null;
  }
}

const forbidden = (res) =>
  apiError(
    res,
    403,
    'PERMISSION_DENIED',
    'Votre rôle ne permet pas cette action.',
  );

function recordAudit(organizationId, actorId, action, targetId, metadata) {
  state.audit.push({
    id: String(state.nextAuditId++),
    organizationId,
    actorType: 'user',
    actorId,
    action,
    targetType: action.split('.')[0],
    targetId,
    metadata,
    requestId: `req-${state.nextAuditId}`,
    createdAt: new Date().toISOString(),
  });
}

const userById = (id) => Object.values(USERS).find((u) => u.id === id);

function invitationDto(invitation) {
  const expired =
    invitation.status === 'pending' &&
    Date.parse(invitation.expiresAt) <= Date.now();
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: expired ? 'expired' : invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    invitedBy: {
      userId: invitation.invitedBy,
      email: userById(invitation.invitedBy).email,
    },
  };
}

// Same rule as memberChangeRefusal in @nagaw/shared.
function memberChangeRefusal(actor, target, change) {
  if (actor.userId === target.userId) return 'SELF_CHANGE_FORBIDDEN';
  if (actor.role === 'owner') return null;
  if (target.role === 'owner') return 'OWNER_PROTECTED';
  if (change.role === 'owner') return 'OWNER_PROMOTION_FORBIDDEN';
  return null;
}

const orgsOf = (userId) =>
  state.memberships
    .filter((m) => m.userId === userId && m.status === 'active')
    .map((m) => ({ ...state.organizations[m.organizationId], role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  const path = url.pathname;

  // --- Test control endpoints -------------------------------------------
  if (path === '/health') return send(res, 200, { ok: true });
  if (path === '/__test/session')
    return send(res, 200, await sessionCookie(url.searchParams.get('user')));
  if (path === '/__test/reset') {
    state = makeState();
    resetCatalog();
    resetSales();
    resetDocuments();
    resetTreasury();
    return send(res, 200, { ok: true });
  }

  // --- Supabase Auth --------------------------------------------------------
  if (path === '/auth/v1/.well-known/jwks.json') return send(res, 200, jwks);
  if (path === '/auth/v1/logout') return send(res, 204);

  // --- Nagaw API ------------------------------------------------------------
  if (!path.startsWith('/api/v1/'))
    return apiError(res, 404, 'NOT_FOUND', 'Introuvable.');
  const user = await authenticate(req);
  if (!user)
    return apiError(res, 401, 'UNAUTHENTICATED', 'Authentification requise.');
  if (user === USERS.broken)
    return apiError(
      res,
      500,
      'INTERNAL_ERROR',
      'Une erreur interne est survenue.',
    );

  // Across the person's shops: no active shop, each membership checked.
  if (path === '/api/v1/stats/shops' && req.method === 'GET')
    return send(
      res,
      200,
      shopsSummary(
        user.id,
        state.organizations,
        state.memberships,
        Object.fromEntries(url.searchParams),
      ),
    );
  // The offer grid, the same for everyone (ADR-029).
  if (path === '/api/v1/plans' && req.method === 'GET')
    return send(res, 200, PLANS);
  // Platform administration (ADR-030): Binta administers the platform.
  if (path.startsWith('/api/v1/admin/')) {
    if (user.id !== USERS.binta.id)
      return apiError(
        res,
        403,
        'PLATFORM_ADMIN_REQUIRED',
        'Réservé à l’administration de la plateforme.',
      );
    const plan = (key) => PLANS.find((p) => p.key === key);
    const owners = (orgId) =>
      state.memberships
        .filter(
          (m) =>
            m.organizationId === orgId &&
            m.role === 'owner' &&
            m.status === 'active',
        )
        .map((m) => userById(m.userId).email);
    const listItem = (org) => ({
      id: org.id,
      name: org.name,
      status: org.status,
      plan: {
        key: state.subscriptions[org.id].planKey,
        name: plan(state.subscriptions[org.id].planKey).name,
      },
      ownerEmails: owners(org.id),
      members: state.memberships.filter(
        (m) => m.organizationId === org.id && m.status === 'active',
      ).length,
      createdAt: org.createdAt,
      lastSaleAt: null,
    });
    const requestDto = (org) => {
      const r = state.subscriptions[org.id].pending;
      return {
        id: r.id,
        shop: { id: org.id, name: org.name },
        from: {
          key: state.subscriptions[org.id].planKey,
          name: plan(state.subscriptions[org.id].planKey).name,
        },
        to: { key: r.planKey, name: plan(r.planKey).name },
        requestedBy: owners(org.id)[0] ?? '',
        status: r.status ?? 'pending',
        note: r.note ?? '',
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt ?? null,
      };
    };
    const shopDto = (org) => ({
      ...listItem(org),
      timezone: org.timezone,
      currency: org.defaultCurrency,
      usage: { products: 2, members: listItem(org).members, devices: 0 },
      limits: plan(state.subscriptions[org.id].planKey).limits,
      suspension:
        org.status === 'suspended'
          ? { at: org.suspendedAt, reason: org.suspensionReason }
          : null,
      devices: [],
      requests: state.subscriptions[org.id].pending ? [requestDto(org)] : [],
    });
    const orgs = Object.values(state.organizations);
    const pending = orgs.filter(
      (o) =>
        state.subscriptions[o.id].pending &&
        !state.subscriptions[o.id].pending.status,
    );
    if (path === '/api/v1/admin/overview')
      return send(res, 200, {
        shops: {
          active: orgs.filter((o) => o.status === 'active').length,
          suspended: orgs.filter((o) => o.status === 'suspended').length,
          createdLast30Days: 0,
          byPlan: PLANS.map((p) => ({
            key: p.key,
            name: p.name,
            count: orgs.filter(
              (o) => state.subscriptions[o.id].planKey === p.key,
            ).length,
          })),
        },
        users: { total: Object.keys(USERS).length, createdLast30Days: 0 },
        pendingRequests: pending.length,
        sync: { batches: 0, accepted: 0, rejected: 0, rejectionBasisPoints: 0 },
        alerts: pending.length
          ? [
              {
                kind: 'plan_request',
                message: `${pending.length} demande(s) de changement d’offre en attente.`,
                shop: null,
              },
            ]
          : [],
      });
    if (path === '/api/v1/admin/shops')
      return send(res, 200, orgs.map(listItem));
    if (path === '/api/v1/admin/plan-requests')
      return send(
        res,
        200,
        (url.searchParams.get('status') === 'all'
          ? orgs.filter((o) => state.subscriptions[o.id].pending)
          : pending
        ).map(requestDto),
      );
    if (path === '/api/v1/admin/sync') {
      const days = Number(url.searchParams.get('days') ?? 7);
      const today = new Date();
      return send(res, 200, {
        days: Array.from({ length: days }, (_, i) => ({
          day: new Date(today.getTime() - (days - 1 - i) * 86_400_000)
            .toISOString()
            .slice(0, 10),
          batches: 0,
          accepted: 0,
          duplicates: 0,
          rejected: 0,
        })),
        reasons: [],
        silentDevices: [],
      });
    }
    const shopMatch =
      /^\/api\/v1\/admin\/shops\/([^/]+)(\/plan|\/suspend|\/reactivate)?$/.exec(
        path,
      );
    if (shopMatch) {
      const org = state.organizations[shopMatch[1]];
      if (!org)
        return apiError(res, 404, 'SHOP_NOT_FOUND', 'Boutique introuvable.');
      if (!shopMatch[2]) return send(res, 200, shopDto(org));
      const body = await readJson(req);
      if (shopMatch[2] === '/plan') {
        if (!plan(body.planKey))
          return apiError(res, 400, 'VALIDATION_FAILED', 'Offre inconnue.');
        if (body.planKey === state.subscriptions[org.id].planKey)
          return apiError(
            res,
            409,
            'ALREADY_ON_PLAN',
            'La boutique est déjà sur cette offre.',
          );
        state.subscriptions[org.id].planKey = body.planKey;
        return send(res, 200, shopDto(org));
      }
      if (shopMatch[2] === '/suspend') {
        if (!body.reason?.trim())
          return apiError(
            res,
            400,
            'VALIDATION_FAILED',
            'Indiquez pourquoi la boutique est suspendue',
          );
        Object.assign(org, {
          status: 'suspended',
          suspendedAt: new Date().toISOString(),
          suspensionReason: body.reason,
        });
        return send(res, 200, shopDto(org));
      }
      Object.assign(org, {
        status: 'active',
        suspendedAt: null,
        suspensionReason: null,
      });
      return send(res, 200, shopDto(org));
    }
    const requestMatch =
      /^\/api\/v1\/admin\/plan-requests\/([^/]+)\/(approve|reject)$/.exec(path);
    if (requestMatch) {
      const org = orgs.find(
        (o) => state.subscriptions[o.id].pending?.id === requestMatch[1],
      );
      if (!org)
        return apiError(
          res,
          404,
          'PLAN_REQUEST_NOT_FOUND',
          'Demande introuvable.',
        );
      const subscription = state.subscriptions[org.id];
      if (subscription.pending.status)
        return apiError(
          res,
          409,
          'PLAN_REQUEST_NOT_PENDING',
          'Cette demande a déjà été traitée ou annulée.',
        );
      const { note = '' } = await readJson(req);
      const dto = requestDto(org);
      if (requestMatch[2] === 'approve')
        subscription.planKey = subscription.pending.planKey;
      Object.assign(subscription.pending, {
        status: requestMatch[2] === 'approve' ? 'done' : 'rejected',
        note,
        resolvedAt: new Date().toISOString(),
      });
      return send(res, 200, {
        ...dto,
        status: subscription.pending.status,
        note,
      });
    }
    if (path === '/api/v1/admin/feedback' && req.method === 'GET') {
      const status = url.searchParams.get('status');
      return send(
        res,
        200,
        state.feedback
          .filter((f) => !status || f.status === status)
          .reverse()
          .map(({ organizationId, authorId, ...f }) => ({
            ...f,
            shop: {
              id: organizationId,
              name: state.organizations[organizationId].name,
            },
            author: userById(authorId).email,
          })),
      );
    }
    const feedbackMatch = /^\/api\/v1\/admin\/feedback\/([^/]+)$/.exec(path);
    if (feedbackMatch && req.method === 'POST') {
      const feedback = state.feedback.find((f) => f.id === feedbackMatch[1]);
      if (!feedback)
        return apiError(res, 404, 'FEEDBACK_NOT_FOUND', 'Message introuvable.');
      const body = await readJson(req);
      feedback.status = body.status;
      if (body.answer && !feedback.answer) {
        feedback.answer = body.answer;
        feedback.answeredAt = new Date().toISOString();
      }
      const { organizationId, authorId, ...f } = feedback;
      return send(res, 200, {
        ...f,
        shop: {
          id: organizationId,
          name: state.organizations[organizationId].name,
        },
        author: userById(authorId).email,
      });
    }
    return apiError(res, 404, 'NOT_FOUND', 'Introuvable.');
  }
  if (path === '/api/v1/me' && req.method === 'GET') {
    return send(res, 200, {
      id: user.id,
      email: user.email,
      displayName: null,
      locale: 'fr',
      platformAdmin: user.id === USERS.binta.id,
      timezone: 'UTC',
      organizations: orgsOf(user.id),
    });
  }

  if (path === '/api/v1/organizations' && req.method === 'POST') {
    const body = await readJson(req);
    const id = randomUUID();
    const now = new Date().toISOString();
    state.organizations[id] = {
      id,
      name: body.name,
      slug: `org-${id.slice(0, 6)}`,
      status: 'active',
      timezone: body.timezone ?? 'UTC',
      defaultCurrency: body.defaultCurrency ?? 'XOF',
      createdAt: now,
      updatedAt: now,
    };
    state.memberships.push({
      organizationId: id,
      userId: user.id,
      role: 'owner',
      status: 'active',
      joinedAt: now,
    });
    return send(res, 201, { ...state.organizations[id], role: 'owner' });
  }

  if (
    (path === '/api/v1/invitations/preview' ||
      path === '/api/v1/invitations/accept') &&
    req.method === 'POST'
  ) {
    const { token } = await readJson(req);
    const invitation = state.invitations.find((i) => i.token === token);
    if (!invitation)
      return apiError(
        res,
        404,
        'INVITATION_NOT_FOUND',
        'Invitation introuvable.',
      );
    const dto = invitationDto(invitation);
    if (path.endsWith('/preview')) {
      return send(res, 200, {
        organizationName: state.organizations[invitation.organizationId].name,
        email: invitation.email,
        role: invitation.role,
        status: dto.status,
        expiresAt: invitation.expiresAt,
        emailMatches: invitation.email === user.email,
      });
    }
    if (dto.status !== 'pending')
      return apiError(res, 410, 'INVITATION_EXPIRED', 'Invitation expirée.');
    if (invitation.email !== user.email)
      return apiError(
        res,
        403,
        'INVITATION_EMAIL_MISMATCH',
        'Cette invitation est destinée à une autre adresse e-mail.',
      );
    invitation.status = 'accepted';
    state.memberships.push({
      organizationId: invitation.organizationId,
      userId: user.id,
      role: invitation.role,
      status: 'active',
      joinedAt: new Date().toISOString(),
    });
    recordAudit(
      invitation.organizationId,
      user.id,
      'invitation.accepted',
      invitation.id,
      { email: invitation.email, role: invitation.role },
    );
    return send(res, 201, {
      ...state.organizations[invitation.organizationId],
      role: invitation.role,
    });
  }

  // Tenant-scoped routes: same rules as the real TenantGuard.
  const orgId = req.headers['x-organization-id'];
  const membership = state.memberships.find(
    (m) =>
      m.organizationId === orgId &&
      m.userId === user.id &&
      m.status === 'active',
  );
  if (!membership)
    return apiError(
      res,
      404,
      'ORGANIZATION_NOT_FOUND',
      'Organisation introuvable.',
    );
  const canManage = membership.role === 'owner' || membership.role === 'admin';

  if (path === '/api/v1/organizations/current' && req.method === 'GET')
    return send(res, 200, state.organizations[orgId]);
  if (path === '/api/v1/organizations/current' && req.method === 'PATCH') {
    if (!canManage)
      return apiError(
        res,
        403,
        'PERMISSION_DENIED',
        'Votre rôle ne permet pas cette action.',
      );
    const body = await readJson(req);
    const org = state.organizations[orgId];
    Object.assign(org, body, { updatedAt: new Date().toISOString() });
    state.audit.push({
      id: String(state.nextAuditId++),
      organizationId: orgId,
      actorType: 'user',
      actorId: user.id,
      action: 'organization.updated',
      targetType: 'organization',
      targetId: orgId,
      metadata: {},
      requestId: 'req-patch',
      createdAt: new Date().toISOString(),
    });
    return send(res, 200, org);
  }
  if (path === '/api/v1/organizations/current/members') {
    return send(
      res,
      200,
      state.memberships
        .filter((m) => m.organizationId === orgId)
        .map((m) => {
          const member = Object.values(USERS).find((u) => u.id === m.userId);
          return {
            userId: m.userId,
            email: member.email,
            displayName: null,
            role: m.role,
            status: m.status,
            joinedAt: m.joinedAt,
          };
        }),
    );
  }
  if (path === '/api/v1/organizations/current/invitations') {
    if (!canManage) return forbidden(res);
    if (req.method === 'GET')
      return send(
        res,
        200,
        state.invitations
          .filter((i) => i.organizationId === orgId && i.status === 'pending')
          .map(invitationDto),
      );
    const body = await readJson(req);
    const email = String(body.email).trim().toLowerCase();
    const alreadyMember = state.memberships.some(
      (m) => m.organizationId === orgId && userById(m.userId)?.email === email,
    );
    if (alreadyMember)
      return apiError(
        res,
        409,
        'ALREADY_MEMBER',
        'Cette personne est déjà membre de l’organisation.',
      );
    if (
      state.invitations.some(
        (i) =>
          i.organizationId === orgId &&
          i.email === email &&
          i.status === 'pending',
      )
    )
      return apiError(
        res,
        409,
        'INVITATION_PENDING',
        'Une invitation est déjà en attente pour cette adresse.',
      );
    const now = Date.now();
    const invitation = {
      id: randomUUID(),
      organizationId: orgId,
      email,
      role: body.role,
      status: 'pending',
      token: randomBytes(32).toString('base64url'),
      invitedBy: user.id,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(
        now + state.organizations[orgId].invitationTtlHours * 3600_000,
      ).toISOString(),
    };
    state.invitations.push(invitation);
    recordAudit(orgId, user.id, 'invitation.created', invitation.id, {
      email,
      role: body.role,
    });
    return send(res, 201, {
      invitation: invitationDto(invitation),
      token: invitation.token,
    });
  }
  const revoke =
    /^\/api\/v1\/organizations\/current\/invitations\/([^/]+)\/revoke$/.exec(
      path,
    );
  if (revoke && req.method === 'POST') {
    if (!canManage) return forbidden(res);
    const invitation = state.invitations.find(
      (i) => i.id === revoke[1] && i.organizationId === orgId,
    );
    if (!invitation)
      return apiError(
        res,
        404,
        'INVITATION_NOT_FOUND',
        'Invitation introuvable.',
      );
    invitation.status = 'revoked';
    recordAudit(orgId, user.id, 'invitation.revoked', invitation.id, {
      email: invitation.email,
    });
    return send(res, 200, invitationDto(invitation));
  }
  const member = /^\/api\/v1\/organizations\/current\/members\/([^/]+)$/.exec(
    path,
  );
  if (member && req.method === 'PATCH') {
    if (!canManage) return forbidden(res);
    const target = state.memberships.find(
      (m) => m.organizationId === orgId && m.userId === member[1],
    );
    if (!target)
      return apiError(res, 404, 'MEMBER_NOT_FOUND', 'Membre introuvable.');
    const body = await readJson(req);
    const refusal = memberChangeRefusal(
      { userId: user.id, role: membership.role },
      target,
      body,
    );
    if (refusal)
      return apiError(res, 403, refusal, 'Modification non autorisée.');
    if (body.role && body.role !== target.role) {
      recordAudit(orgId, user.id, 'member.role_changed', target.userId, {
        from: target.role,
        to: body.role,
      });
      target.role = body.role;
    }
    if (body.status && body.status !== target.status) {
      recordAudit(
        orgId,
        user.id,
        body.status === 'disabled' ? 'member.disabled' : 'member.reactivated',
        target.userId,
        {},
      );
      target.status = body.status;
    }
    const profile = userById(target.userId);
    return send(res, 200, {
      userId: target.userId,
      email: profile.email,
      displayName: null,
      role: target.role,
      status: target.status,
      joinedAt: target.joinedAt,
    });
  }
  if (
    await handleSales({
      req,
      res,
      path,
      url,
      user,
      orgId,
      role: membership.role,
      timeZone: state.organizations[orgId].timezone,
      send,
      apiError,
      readJson,
      forbidden,
      userById,
    })
  )
    return;
  if (
    await handleDocuments({
      req,
      res,
      path,
      orgId,
      role: membership.role,
      organization: state.organizations[orgId],
      send,
      apiError,
      readJson,
      forbidden,
    })
  )
    return;
  if (path === '/api/v1/feedback') {
    const dto = (f) => ({
      id: f.id,
      kind: f.kind,
      message: f.message,
      page: f.page,
      status: f.status,
      answer: f.answer,
      answeredAt: f.answeredAt,
      createdAt: f.createdAt,
    });
    if (req.method === 'GET')
      return send(
        res,
        200,
        state.feedback
          .filter((f) => f.organizationId === orgId && f.authorId === user.id)
          .reverse()
          .map(dto),
      );
    const body = await readJson(req);
    if (
      !['problem', 'idea', 'question'].includes(body.kind) ||
      !body.message?.trim()
    )
      return send(res, 400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Données invalides.',
          details: [{ path: 'message', message: 'Écrivez votre message' }],
        },
      });
    const feedback = {
      id: randomUUID(),
      organizationId: orgId,
      authorId: user.id,
      kind: body.kind,
      message: body.message.trim(),
      page: (body.page ?? '').split('?')[0],
      status: 'new',
      answer: '',
      answeredAt: null,
      createdAt: new Date().toISOString(),
    };
    state.feedback.push(feedback);
    return send(res, 201, dto(feedback));
  }
  if (path.startsWith('/api/v1/subscription')) {
    const subscription = state.subscriptions[orgId];
    const role = membership.role;
    if (!['owner', 'admin'].includes(role)) return forbidden(res);
    const plan = (key) => PLANS.find((p) => p.key === key);
    const dto = () => ({
      plan: plan(subscription.planKey),
      startedAt: '2026-10-01T09:00:00.000Z',
      usage: {
        products: 2,
        members: state.memberships.filter(
          (m) => m.organizationId === orgId && m.status === 'active',
        ).length,
        devices: 0,
      },
      limits: plan(subscription.planKey).limits,
      pendingRequest:
        subscription.pending && !subscription.pending.status
          ? {
              id: subscription.pending.id,
              plan: plan(subscription.pending.planKey),
              createdAt: subscription.pending.createdAt,
            }
          : null,
    });
    if (path === '/api/v1/subscription' && req.method === 'GET')
      return send(res, 200, dto());
    if (role !== 'owner') return forbidden(res);
    if (path === '/api/v1/subscription/requests' && req.method === 'POST') {
      const { planKey } = await readJson(req);
      if (!plan(planKey))
        return apiError(res, 400, 'VALIDATION_FAILED', 'Offre inconnue.');
      if (planKey === subscription.planKey)
        return apiError(
          res,
          409,
          'ALREADY_ON_PLAN',
          `La boutique est déjà sur l’offre ${plan(planKey).name}.`,
        );
      if (subscription.pending && !subscription.pending.status)
        return apiError(
          res,
          409,
          'PLAN_CHANGE_PENDING',
          'Une demande de changement d’offre est déjà en cours : annulez-la pour en faire une autre.',
        );
      subscription.pending = {
        id: randomUUID(),
        planKey,
        createdAt: new Date().toISOString(),
      };
      return send(res, 201, dto());
    }
    if (
      path === '/api/v1/subscription/requests/cancel' &&
      req.method === 'POST'
    ) {
      if (!subscription.pending || subscription.pending.status)
        return apiError(
          res,
          409,
          'NO_PENDING_REQUEST',
          'Aucune demande de changement d’offre en cours.',
        );
      subscription.pending = null;
      return send(res, 200, dto());
    }
  }
  if (
    await handleTreasury({
      req,
      res,
      path,
      url,
      user,
      orgId,
      role: membership.role,
      organization: state.organizations[orgId],
      send,
      apiError,
      readJson,
      forbidden,
    })
  )
    return;
  if (
    await handleCatalog({
      req,
      res,
      path,
      url,
      user,
      orgId,
      canManage,
      send,
      apiError,
      readJson,
      forbidden,
      userById,
    })
  )
    return;
  if (path === '/api/v1/audit-logs') {
    if (!canManage)
      return apiError(
        res,
        403,
        'PERMISSION_DENIED',
        'Votre rôle ne permet pas cette action.',
      );
    const limit = Number(url.searchParams.get('limit') ?? 25);
    const cursor = url.searchParams.get('cursor');
    const rows = state.audit
      .filter(
        (e) =>
          e.organizationId === orgId &&
          (!cursor || Number(e.id) < Number(cursor)),
      )
      .sort((a, b) => Number(b.id) - Number(a.id));
    const page = rows.slice(0, limit);
    return send(res, 200, {
      data: page,
      nextCursor: rows.length > limit ? page.at(-1).id : null,
    });
  }
  return apiError(res, 404, 'NOT_FOUND', 'Introuvable.');
});

server.listen(PORT, () => console.log(`fake backend on ${ORIGIN}`));
