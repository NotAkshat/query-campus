import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  const config = app.get(ConfigService);
  await app.listen(config.get<number>('port') ?? 3001);
}
await bootstrap();
