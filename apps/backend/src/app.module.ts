import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { DocumentsController } from './documents/documents.controller.js';
import configuration from './config/configuration.js';
import { ScraperModule } from './scraper/scraper.module.js';
import { EmbeddingsModule } from './embeddings/embeddings.module.js';
import { VectorStoreModule } from './vectorstore/vectorstore.module.js';
import { IngestionModule } from './ingestion/ingestion.module.js';
import { RagModule } from './rag/rag.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScraperModule,
    EmbeddingsModule,
    VectorStoreModule,
    IngestionModule,
    RagModule,
  ],
  controllers: [AppController, DocumentsController],
})
export class AppModule {}
