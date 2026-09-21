import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { VectorStoreModule } from '../vectorstore/vectorstore.module.js';
import { RagService } from './rag.service.js';
import { RagController } from './rag.controller.js';

@Module({
  imports: [EmbeddingsModule, VectorStoreModule],
  providers: [RagService],
  controllers: [RagController],
})
export class RagModule {}
