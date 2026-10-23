import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';
import { withRetry } from '../common/retry.js';

export interface ChunkMetadata {
  url: string;
  title: string;
  text: string;
  type: 'html' | 'pdf';
  [key: string]: string;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: ChunkMetadata;
}

export interface QueryMatch {
  id: string;
  score: number;
  metadata: ChunkMetadata;
}

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);
  private _client?: Pinecone;

  constructor(private readonly config: ConfigService) {}

  // Created lazily so the server can boot before PINECONE_API_KEY is configured.
  private get client(): Pinecone {
    this._client ??= new Pinecone({ apiKey: this.config.get<string>('pineconeApiKey')! });
    return this._client;
  }

  private get index() {
    return this.client.index(this.config.get<string>('pineconeIndex')!);
  }

  async ensureIndex(): Promise<void> {
    const indexName = this.config.get<string>('pineconeIndex')!;
    const dimension = this.config.get<number>('voyageDimension')!;
    const existing = await this.client.listIndexes();
    if (existing.indexes?.some((i) => i.name === indexName)) return;

    await this.client.createIndex({
      name: indexName,
      dimension,
      metric: 'cosine',
      spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
      waitUntilReady: true,
    });
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await withRetry(() => this.index.upsert({ records: batch }), {
        label: 'Pinecone upsert',
        logger: this.logger,
        baseDelayMs: 5_000,
      });
    }
  }

  /** All record ids (optionally with a prefix). Ids only, so this is much cheaper than fetching records. */
  async listIds(prefix?: string): Promise<string[]> {
    const ids: string[] = [];
    let paginationToken: string | undefined;
    do {
      const page = await withRetry(() => this.index.listPaginated({ prefix, limit: 100, paginationToken }), {
        label: 'Pinecone list',
        logger: this.logger,
        baseDelayMs: 5_000,
      });
      ids.push(...(page.vectors ?? []).map((v) => v.id!).filter(Boolean));
      paginationToken = page.pagination?.next;
    } while (paginationToken);
    return ids;
  }

  /** Metadata for the given ids, fetched in pages of 100. */
  async fetchByIds(ids: string[]): Promise<{ id: string; metadata: ChunkMetadata }[]> {
    const out: { id: string; metadata: ChunkMetadata }[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const res = await withRetry(() => this.index.fetch({ ids: ids.slice(i, i + 100) }), {
        label: 'Pinecone fetch',
        logger: this.logger,
        baseDelayMs: 5_000,
      });
      for (const [id, record] of Object.entries(res.records ?? {})) {
        if (record.metadata) out.push({ id, metadata: record.metadata as unknown as ChunkMetadata });
      }
    }
    return out;
  }

  /** Deletes every record whose id starts with `prefix`. Returns how many were removed. */
  async deleteByPrefix(prefix: string): Promise<number> {
    // Collect all ids first; deleting while paginating would shift the pages.
    const ids = await this.listIds(prefix);
    for (let i = 0; i < ids.length; i += 1000) {
      await this.index.deleteMany({ ids: ids.slice(i, i + 1000) });
    }
    return ids.length;
  }

  async query(vector: number[], topK = 6): Promise<QueryMatch[]> {
    const res = await withRetry(() => this.index.query({ vector, topK, includeMetadata: true }), {
      label: 'Pinecone query',
      logger: this.logger,
      baseDelayMs: 5_000,
    });
    return (res.matches ?? []).map((m) => ({
      id: m.id,
      score: m.score ?? 0,
      metadata: m.metadata as unknown as ChunkMetadata,
    }));
  }
}
