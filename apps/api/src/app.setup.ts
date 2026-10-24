import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PRODUCT_PHOTO_MAX_BYTES, PRODUCT_PHOTO_TYPES } from '@nagaw/shared';
import * as helmetModule from 'helmet';
import type { HelmetOptions } from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { interopDefault } from './common/interop-default.js';
import { ENV, type Env } from './config/env.js';

export const API_PREFIX = 'api/v1';

type Middleware = (
  req: unknown,
  res: unknown,
  next: (err?: unknown) => void,
) => void;
const helmet = interopDefault<(options?: HelmetOptions) => Middleware>(
  helmetModule,
  'helmet',
);

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
  // Product photos are sent as raw image bytes. The parser accepts twice the
  // maximum so that the service answers PHOTO_TOO_LARGE in the usual
  // envelope; the service checks the real limit and the image signature.
  (app as NestExpressApplication).useBodyParser('raw', {
    type: [...PRODUCT_PHOTO_TYPES],
    limit: PRODUCT_PHOTO_MAX_BYTES * 2,
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
