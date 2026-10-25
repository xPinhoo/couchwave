import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { corsOrigins } from './config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: corsOrigins() });
  app.enableShutdownHooks();
  // 0.0.0.0 so phones on the same Wi-Fi can reach the dev server
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
