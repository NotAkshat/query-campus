import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { KeywordSearchService } from './rag/keyword-search.service.js';
import { rateLimit } from './common/rate-limit.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const origins = config.get<string[]>('corsOrigins') ?? [];
  app.enableCors({ origin: origins.length ? origins : true });
  const trustProxy = config.get<number>('trustProxy') ?? 0;
  if (trustProxy > 0) app.set('trust proxy', trustProxy);
  app.use('/query', rateLimit(config.get<number>('rateLimitPerMinute') ?? 20));
  app.enableShutdownHooks();
  await app.listen(config.get<number>('port') ?? 3001, '0.0.0.0');
  if (config.get<string>('pineconeApiKey')) app.get(KeywordSearchService).warmUp();
}
await bootstrap();
