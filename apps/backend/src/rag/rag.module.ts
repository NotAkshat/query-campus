import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { VectorStoreModule } from '../vectorstore/vectorstore.module.js';
import { RagService } from './rag.service.js';
import { RagController } from './rag.controller.js';
import { KeywordSearchService } from './keyword-search.service.js';

@Module({
  imports: [EmbeddingsModule, VectorStoreModule],
  providers: [RagService, KeywordSearchService],
  controllers: [RagController],
})
export class RagModule {}
