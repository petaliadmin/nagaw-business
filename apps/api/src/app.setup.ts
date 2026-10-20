import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { ENV, type Env } from './config/env.js';

export const API_PREFIX = 'api/v1';

/**
 * Applies the cross-cutting HTTP configuration. Shared by main.ts and the
 * integration tests so tests exercise the same pipeline as production.
 */
export function setupApp(app: INestApplication): void {
  const env = app.get<Env>(ENV);

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: false,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Organization-Id',
      'Idempotency-Key',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (env.APP_ENV !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Nagaw Business API')
        .setVersion('v1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);
  }
}
