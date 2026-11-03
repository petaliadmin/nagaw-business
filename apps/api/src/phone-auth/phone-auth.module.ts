import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import {
  AUTH_ADMIN,
  GoTrueAuthAdmin,
  UnconfiguredAuthAdmin,
} from './auth-admin.js';
import { PhoneAuthController } from './phone-auth.controller.js';
import { PhoneAuthService } from './phone-auth.service.js';

@Module({
  controllers: [PhoneAuthController],
  providers: [
    PhoneAuthService,
    {
      provide: AUTH_ADMIN,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.SUPABASE_URL && env.SUPABASE_SECRET_KEY
          ? new GoTrueAuthAdmin(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY)
          : new UnconfiguredAuthAdmin(),
    },
  ],
  exports: [PhoneAuthService],
})
export class PhoneAuthModule {}
