import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { VectorStoreModule } from '../vectorstore/vectorstore.module.js';
import { IngestionService } from './ingestion.service.js';

@Module({
  imports: [EmbeddingsModule, VectorStoreModule],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
