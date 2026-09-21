import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { VectorStoreService, VectorRecord } from '../vectorstore/vectorstore.service.js';
import { ScrapedDocument } from '../scraper/types.js';
import { chunkDocument } from './chunker.js';

// Voyage AI's default free-tier rate limit is 3 requests/min, 10K tokens/min
// until a payment method is on file, so batches stay small and paced.
const EMBED_BATCH_SIZE = 5;
const BATCH_DELAY_MS = 21_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface IngestOptions {
  startIndex?: number;
  onBatchComplete?: (nextIndex: number, total: number) => void | Promise<void>;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  async ingest(documents: ScrapedDocument[], options: IngestOptions = {}): Promise<void> {
    await this.vectorStore.ensureIndex();

    const chunks = documents.flatMap(chunkDocument);
    this.logger.log(`Chunked ${documents.length} documents into ${chunks.length} chunks`);

    const startIndex = options.startIndex ?? 0;
    if (startIndex > 0) {
      this.logger.log(`Resuming from chunk ${startIndex}/${chunks.length}`);
    }

    for (let i = startIndex; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const vectors = await this.embeddings.embed(
        batch.map((c) => c.text),
        'document',
      );

      const records: VectorRecord[] = batch.map((chunk, idx) => ({
        id: chunk.id,
        values: vectors[idx],
        metadata: { url: chunk.url, title: chunk.title, text: chunk.text, type: chunk.type },
      }));

      await this.vectorStore.upsert(records);
      const nextIndex = Math.min(i + EMBED_BATCH_SIZE, chunks.length);
      this.logger.log(`Upserted ${nextIndex}/${chunks.length} chunks`);
      await options.onBatchComplete?.(nextIndex, chunks.length);

      if (nextIndex < chunks.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }
  }
}
