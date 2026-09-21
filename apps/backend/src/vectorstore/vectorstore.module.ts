import { Module } from '@nestjs/common';
import { VectorStoreService } from './vectorstore.service.js';

@Module({
  providers: [VectorStoreService],
  exports: [VectorStoreService],
})
export class VectorStoreModule {}
