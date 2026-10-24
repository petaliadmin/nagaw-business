import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';
import { ENV, type Env } from './config/env.js';
import { loadLocalEnvFile } from './config/load-env-file.js';

async function bootstrap() {
  // Before the app reads its configuration (ConfigModule).
  loadLocalEnvFile();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  setupApp(app);
  await app.listen(app.get<Env>(ENV).PORT);
}

// No top-level await: Vercel's NestJS runtime captures the server from
// app.listen() while the module is still evaluating, so awaiting here
// deadlocks the function.
bootstrap().catch((error: unknown) => {
  console.error('API bootstrap failed', error);
  process.exit(1);
});
