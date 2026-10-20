import { Module } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import { ENV, type Env } from '../config/env.js';
import { AUTH_PROBE, JwksAuthProbe } from './auth-probe.js';
import {
  JWT_VERIFIER,
  SupabaseJwtVerifier,
  UnconfiguredJwtVerifier,
  supabaseIssuer,
} from './jwt-verifier.js';

@Module({
  providers: [
    {
      provide: JWT_VERIFIER,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (!env.SUPABASE_URL) return new UnconfiguredJwtVerifier();
        const issuer = supabaseIssuer(env.SUPABASE_URL);
        const jwks = createRemoteJWKSet(
          new URL(`${issuer}/.well-known/jwks.json`),
        );
        return new SupabaseJwtVerifier(jwks, issuer);
      },
    },
    {
      provide: AUTH_PROBE,
      inject: [ENV],
      useFactory: (env: Env) =>
        new JwksAuthProbe(
          env.SUPABASE_URL
            ? `${supabaseIssuer(env.SUPABASE_URL)}/.well-known/jwks.json`
            : undefined,
        ),
    },
  ],
  exports: [JWT_VERIFIER, AUTH_PROBE],
})
export class AuthModule {}
