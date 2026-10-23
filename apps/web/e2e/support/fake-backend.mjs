// Test double for the two external boundaries of the web app: Supabase Auth
// (JWKS + logout) and the Nagaw API. Tokens are real ES256 JWTs signed with a
// key generated at startup, so the web app verifies them exactly as in
// production. Started by Playwright; never used outside end-to-end tests.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  createLocalJWKSet,
} from 'jose';

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
  return { organizations, memberships, audit, nextAuditId: id };
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

  if (path === '/api/v1/me' && req.method === 'GET') {
    return send(res, 200, {
      id: user.id,
      email: user.email,
      displayName: null,
      locale: 'fr',
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
