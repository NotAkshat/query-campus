import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
  score: number;
  metadata: ChunkMetadata;
}

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private client!: Pinecone;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Pinecone({ apiKey: this.config.get<string>('pineconeApiKey')! });
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

  async query(vector: number[], topK = 6): Promise<QueryMatch[]> {
    const res = await withRetry(() => this.index.query({ vector, topK, includeMetadata: true }), {
      label: 'Pinecone query',
      logger: this.logger,
      baseDelayMs: 5_000,
    });
    return (res.matches ?? []).map((m) => ({
      score: m.score ?? 0,
      metadata: m.metadata as unknown as ChunkMetadata,
    }));
  }
}
