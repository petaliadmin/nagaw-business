import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadEnv } from '../config/env.js';
import { HttpWaveClient } from './wave.client.js';
import { verifyWaveSignature } from './wave-signature.js';

interface Seen {
  method: string;
  url: string;
  authorization: string | undefined;
  signature: string | undefined;
  body: string;
}

/** A local stand-in for api.wave.com: what our client really sends. */
describe('HttpWaveClient', () => {
  let server: Server;
  let seen: Seen[] = [];
  let reply: { status: number; body: unknown } = { status: 200, body: {} };
  let client: HttpWaveClient;

  const read = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let data = '';
      req.on('data', (chunk: Buffer) => (data += chunk.toString('utf8')));
      req.on('end', () => resolve(data));
    });

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      seen.push({
        method: req.method ?? '',
        url: req.url ?? '',
        authorization: req.headers.authorization,
        signature: req.headers['wave-signature'] as string | undefined,
        body: await read(req),
      });
      res.writeHead(reply.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reply.body));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    client = new HttpWaveClient(
      loadEnv({ WAVE_API_URL: `http://127.0.0.1:${port}` }),
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    seen = [];
  });

  const session = {
    id: 'cos-18qq25rgr100a',
    amount: '1000',
    currency: 'XOF',
    checkout_status: 'open',
    payment_status: 'processing',
    client_reference: 'order-1',
    transaction_id: null,
    wave_launch_url: 'https://pay.wave.com/c/cos-18qq25rgr100a',
    when_expires: '2026-11-05T12:30:00Z',
  };

  it('creates a session as the Wave docs describe it', async () => {
    reply = { status: 200, body: session };
    const created = await client.createSession(
      { apiKey: 'wave_sn_prod_key', signingSecret: null },
      {
        amount: '1000',
        currency: 'XOF',
        successUrl: 'https://nagaw.test/b/s/paiement/1',
        errorUrl: 'https://nagaw.test/b/s/paiement/1?echec=1',
        clientReference: 'order-1',
      },
    );
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: '/v1/checkout/sessions',
      authorization: 'Bearer wave_sn_prod_key',
      signature: undefined,
    });
    expect(JSON.parse(seen[0]!.body)).toEqual({
      amount: '1000',
      currency: 'XOF',
      success_url: 'https://nagaw.test/b/s/paiement/1',
      error_url: 'https://nagaw.test/b/s/paiement/1?echec=1',
      client_reference: 'order-1',
    });
    expect(created).toEqual({
      id: 'cos-18qq25rgr100a',
      amount: '1000',
      currency: 'XOF',
      checkoutStatus: 'open',
      paymentStatus: 'processing',
      clientReference: 'order-1',
      transactionId: null,
      launchUrl: 'https://pay.wave.com/c/cos-18qq25rgr100a',
      expiresAt: '2026-11-05T12:30:00Z',
    });
  });

  it('signs the request when the key asks for it, GET included', async () => {
    reply = { status: 200, body: session };
    const signing = 'wave_sn_AKS_signing_secret_0001';
    await client.getSession(
      { apiKey: 'wave_sn_prod_key', signingSecret: signing },
      'cos-18qq25rgr100a',
    );
    expect(seen[0]).toMatchObject({
      method: 'GET',
      url: '/v1/checkout/sessions/cos-18qq25rgr100a',
      body: '',
    });
    expect(
      verifyWaveSignature(
        signing,
        seen[0]!.signature,
        '',
        Math.floor(Date.now() / 1000),
      ),
    ).toBe(true);
  });

  it('tells a refused key from an absent Wave, without the key in the error', async () => {
    reply = { status: 401, body: { code: 'invalid-auth', message: 'x' } };
    const refused = await client
      .probe({ apiKey: 'wave_sn_prod_secret_key', signingSecret: null })
      .catch((error: unknown) => error);
    expect(refused).toMatchObject({ code: 'WAVE_KEY_REFUSED' });
    expect(JSON.stringify(refused)).not.toContain('secret_key');
    expect(seen[0]!.url).toBe(
      '/v1/checkout/sessions/search?client_reference=nagaw-probe',
    );

    reply = { status: 500, body: {} };
    await expect(
      client.probe({ apiKey: 'wave_sn_prod_key', signingSecret: null }),
    ).rejects.toMatchObject({ code: 'WAVE_UNAVAILABLE' });
  });
});
