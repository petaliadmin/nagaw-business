import { Module } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import { ENV, type Env } from '../config/env.js';
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
  ],
  exports: [JWT_VERIFIER],
})
export class AuthModule {}
