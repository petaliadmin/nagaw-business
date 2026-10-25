import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { buildHttpLoggerOptions } from './common/logging.js';
import { ConfigModule } from './config/config.module.js';
import { ENV, type Env } from './config/env.js';
import { AccountingModule } from './accounting/accounting.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { HealthModule } from './health/health.module.js';
import { MeModule } from './me/me.module.js';
import { MembersModule } from './members/members.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { SalesModule } from './sales/sales.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { TenantGuard } from './tenancy/tenant.guard.js';
import { TreasuryModule } from './treasury/treasury.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: buildHttpLoggerOptions(env),
      }),
    }),
    DatabaseModule,
    AuthModule,
    AuditModule,
    HealthModule,
    OrganizationsModule,
    MeModule,
    MembersModule,
    CatalogModule,
    SalesModule,
    DocumentsModule,
    TreasuryModule,
    AccountingModule,
    SubscriptionsModule,
    AdminModule,
  ],
  providers: [
    // Order matters: authenticate first, then resolve the tenant.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
  ],
})
export class AppModule {}
