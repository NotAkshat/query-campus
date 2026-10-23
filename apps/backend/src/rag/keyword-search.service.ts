import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import MiniSearch, { type SearchOptions } from 'minisearch';
import { ChunkMetadata, VectorStoreService } from '../vectorstore/vectorstore.service.js';
import { expandQuery, normalizeText, urlWords } from '../common/text.js';

export interface KeywordMatch {
  id: string;
  score: number;
  metadata: ChunkMetadata;
}

const STOPWORDS = new Set(
  'a an and are as at be by can do does for from has have how i in is it its me my of on or the this to was what when where which who whom why will with you your about tell give show list please'.split(
    ' ',
  ),
);

function processTerm(term: string): string | null {
  const t = term.toLowerCase();
  return STOPWORDS.has(t) ? null : t;
}

// Local copy of the chunk texts, so restarts don't re-download every chunk from Pinecone (~40s).
const CACHE_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../data/keyword-chunks.json');

const REFRESH_AFTER_MS = 10 * 60_000;

const SEARCH_OPTIONS: SearchOptions = {
  // Words in the page address (e.g. "exam-time-table") count a little more than body text.
  boost: { title: 2, slug: 1.5 },
  // Typos/prefixes only on longer terms, so short words like "fee" don't match "feedback"
  fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
  prefix: (term) => term.length >= 5,
};

interface IndexedChunk {
  id: string;
  title: string;
  text: string;
  slug: string;
}

/**
 * BM25 keyword index over every chunk in Pinecone. Embeddings capture meaning but are weak on
 * exact tokens such as people's names, course codes and numbers; this catches those.
 */
type Chunk = { id: string; metadata: ChunkMetadata };
type BuiltIndex = { search: MiniSearch<IndexedChunk>; metadata: Map<string, ChunkMetadata> };

@Injectable()
export class KeywordSearchService {
  private readonly logger = new Logger(KeywordSearchService.name);
  private ready?: Promise<BuiltIndex>;
  private built?: BuiltIndex;
  private builtAt = 0;
  private refreshing = false;

  constructor(private readonly vectorStore: VectorStoreService) {}

  /** True once an index exists, so callers can skip keyword search instead of waiting for a first build. */
  isReady(): boolean {
    return this.built !== undefined;
  }

  /** Resolves when the index can be searched. */
  async whenReady(): Promise<void> {
    await this.load();
  }

  async search(query: string, limit: number): Promise<KeywordMatch[]> {
    const { search, metadata } = await this.load();
    query = normalizeText(expandQuery(query));
    // Chunks containing every query term (e.g. both "rohit" and "pathak") rank above partial matches.
    const all = search.search(query, { ...SEARCH_OPTIONS, combineWith: 'AND' });
    const seen = new Set(all.map((r) => r.id));
    const any = search.search(query, { ...SEARCH_OPTIONS, combineWith: 'OR' }).filter((r) => !seen.has(r.id));
    return [...all, ...any]
      .slice(0, limit)
      .map((r) => ({ id: String(r.id), score: r.score, metadata: metadata.get(String(r.id))! }));
  }

  /** Builds the index in the background so the first question doesn't pay for it. */
  warmUp() {
    this.load().catch((err) => this.logger.warn(`Keyword index warm-up failed: ${(err as Error).message}`));
  }

  private load(): Promise<BuiltIndex> {
    this.ready ??= this.initialBuild().catch((err) => {
      this.ready = undefined; // let the next request retry
      throw err;
    });
    // Stale-while-revalidate: keep serving the current index while a fresh one is synced, so
    // newly ingested content (e.g. re-indexed timetables) appears without restarting the server.
    if (this.builtAt && Date.now() - this.builtAt > REFRESH_AFTER_MS) void this.refresh();
    return this.ready;
  }

  /**
   * Starts from the copy on disk when there is one (fast, so the server answers well right after a
   * restart) and syncs with Pinecone in the background. Without a copy it must download every chunk first.
   */
  private async initialBuild(): Promise<BuiltIndex> {
    const cached = this.readCache();
    if (cached.length > 0) {
      const index = this.buildIndex(cached);
      this.builtAt = Date.now();
      void this.refresh();
      return index;
    }
    const { chunks } = await this.syncWithPinecone([]);
    const index = this.buildIndex(chunks);
    this.builtAt = Date.now();
    return index;
  }

  private async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const { chunks, changed } = await this.syncWithPinecone(this.readCache());
      if (changed) this.ready = Promise.resolve(this.buildIndex(chunks));
    } catch (err) {
      this.logger.warn(`Keyword index refresh failed: ${(err as Error).message}`);
    } finally {
      this.builtAt = Date.now();
      this.refreshing = false;
    }
  }

  private buildIndex(chunks: Chunk[]): BuiltIndex {
    const started = Date.now();
    const search = new MiniSearch<IndexedChunk>({ fields: ['title', 'text', 'slug'], idField: 'id', processTerm });
    search.addAll(
      chunks.map((c) => ({
        id: c.id,
        title: normalizeText(c.metadata.title),
        text: normalizeText(c.metadata.text),
        slug: urlWords(c.metadata.url),
      })),
    );
    this.logger.log(`Keyword index built over ${chunks.length} chunks in ${Date.now() - started}ms`);
    this.built = { search, metadata: new Map(chunks.map((c) => [c.id, c.metadata])) };
    return this.built;
  }

  private readCache(): Chunk[] {
    try {
      return existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) : [];
    } catch {
      return []; // a damaged cache file is rebuilt from Pinecone
    }
  }

  /**
   * Syncs the on-disk cache with Pinecone: lists ids (cheap), downloads only chunks not cached yet,
   * and drops ones that were deleted. A first run downloads everything (about a minute); later runs are quick.
   */
  private async syncWithPinecone(cached: Chunk[]): Promise<{ chunks: Chunk[]; changed: boolean }> {
    const ids = await this.vectorStore.listIds();
    const live = new Set(ids);
    const have = new Set(cached.map((c) => c.id));
    const missing = ids.filter((id) => !have.has(id));
    const kept = cached.filter((c) => live.has(c.id));

    if (missing.length === 0 && kept.length === cached.length) return { chunks: cached, changed: false };

    const added = await this.vectorStore.fetchByIds(missing);
    const chunks = [...kept, ...added];
    this.logger.log(`Keyword cache synced: +${added.length} new, -${cached.length - kept.length} removed`);
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(chunks));
    return { chunks, changed: true };
  }
}
