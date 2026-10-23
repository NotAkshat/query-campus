import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { VectorStoreService, VectorRecord } from '../vectorstore/vectorstore.service.js';
import { ScrapedDocument } from '../scraper/types.js';
import { chunkDocument } from './chunker.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface IngestOptions {
  startIndex?: number;
  /** Prepended to chunk ids so a source's chunks can later be listed/deleted together. */
  idPrefix?: string;
  /** Only embed chunks whose id is not in the index yet. Unchanged pages cost nothing, so re-crawls are cheap. */
  skipExisting?: boolean;
  onBatchComplete?: (nextIndex: number, total: number) => void | Promise<void>;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly embeddings: EmbeddingsService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  async ingest(documents: ScrapedDocument[], options: IngestOptions = {}): Promise<void> {
    // Voyage AI's free plan allows 3 requests/min and 10K tokens/min until a payment method is on file,
    // so the defaults are small, paced batches. Both values can be raised through the environment.
    const EMBED_BATCH_SIZE = this.config.get<number>('embedBatchSize') ?? 5;
    const BATCH_DELAY_MS = this.config.get<number>('embedBatchDelayMs') ?? 21_000;

    await this.vectorStore.ensureIndex();

    let chunks = documents.flatMap((doc) => chunkDocument(doc, options.idPrefix));
    this.logger.log(`Chunked ${documents.length} documents into ${chunks.length} chunks`);

    if (options.skipExisting) {
      const existing = new Set(await this.vectorStore.listIds(options.idPrefix));
      chunks = chunks.filter((c) => !existing.has(c.id));
      this.logger.log(`${chunks.length} chunks are new; ${existing.size} already indexed are skipped`);
    }

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

      if (nextIndex < chunks.length && BATCH_DELAY_MS > 0) {
        await sleep(BATCH_DELAY_MS);
      }
    }
  }
}
