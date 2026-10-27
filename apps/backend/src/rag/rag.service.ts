import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import type { Readable } from 'stream';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { ChunkMetadata, VectorStoreService } from '../vectorstore/vectorstore.service.js';
import { withRetry } from '../common/retry.js';
import { KeywordSearchService } from './keyword-search.service.js';
import { limitPerKey } from '../common/text.js';
import { unsafeReply } from './safety.js';

// Candidates pulled from each retriever, and how many fused chunks go to the model.
const CANDIDATES_PER_RETRIEVER = 25;
const CONTEXT_CHUNKS = 16;
// Standard Reciprocal Rank Fusion constant; dampens the advantage of the very top ranks.
const RRF_K = 60;
// One long document (e.g. a class timetable) must not take every slot; other pages may hold the answer.
const MAX_CHUNKS_PER_PAGE = 3;
// Questions like "Who is Dr. X?" are best answered by the faculty pages, not by the many timetables that mention X.
const PERSON_QUESTION = /\b(who is|who's|who are|tell me about|designation|research (interest|area)|email of|contact (of|details))\b/i;
const FACULTY_PAGE = /faculty|biodata|bio-data|profile/i;
const FACULTY_BOOST = 1.6;

export interface RagSource {
  url: string;
  title: string;
  type: 'html' | 'pdf';
}

export interface RagAnswer {
  answer: string;
  /** Pages the answer cites, shown as links. */
  sources: RagSource[];
  /** Documents the student asked for (timetables, syllabi, forms), shown as attachment cards. */
  attachments: RagSource[];
}

export type RagStreamEvent = { type: 'delta'; text: string } | ({ type: 'done' } & RagAnswer);

const SYSTEM_PROMPT = `You are the Query Campus assistant for the Institute of Engineering & Technology, DAVV (IET DAVV).
Answer the student's question using ONLY the context excerpts provided below, which were scraped from the official college website and its timetable portal.
Rules:
- First decide whether the context directly contains what the student asked for. A general sentence such as "visit the website for updates" is NOT an answer.
- If it does not, your reply must start with exactly "I cannot answer this question." After that, if the context has closely related information (for example class timetables when the student asked for an exam timetable), say in one short sentence what you do have and cite it, and never present a class timetable as an exam timetable. Otherwise add one short sentence suggesting that the student checks the official website or contacts the college. Do not make anything up.
- If the question asks for something harmful, dangerous or illegal (weapons, violence, self-harm, hacking), reply with only: "I can't help with that. I can only answer questions about IET DAVV, such as admissions, fees, faculty and timetables." Do not suggest the college website and do not cite anything.
- If the question has nothing to do with the college, reply with only: "I can only answer questions about IET DAVV, such as admissions, fees, faculty and timetables."
- If the question assumes something that does not exist or makes no sense for the college (for example a campus on Mars), reply with only "I cannot answer this question." Do not add other facts and do not cite anything.
- Never mention "excerpts", "context", "provided documents" or "records" to the student. Speak as the assistant for the college website.
- Be concise and direct. Use bullet points for lists (timetables, fees, dates, documents required, etc.).
- When you use a fact, it should be traceable to one of the provided sources; do not invent URLs, dates, or numbers not present in the context.
- Questions about a person: the excerpts can include faculty lists, timetables, student roll lists and results that mention people with similar names. Match the full name, and state who they are (designation, department, research interests, classes and subjects taught) exactly as written in the excerpts. When asked what or whom someone teaches, list every class and subject found across all excerpts, not just the first.
- Excerpts can come from different sessions (e.g. an older timetable PDF and the current timetable portal). Prefer the most recent session, and say which session the information is from.
- Cite the excerpts you used with their bracketed numbers, e.g. [2] or [1][3], right after the facts they support. Cite nothing if the context doesn't answer the question.
- Attachments: ONLY when the student explicitly asks to get, see, send, share or download a document (a timetable, syllabus, form, notice, result, scheme, list), end your reply with one final line "ATTACH: [n]" listing the excerpts that are the requested documents (e.g. "ATTACH: [3][5]" for sections A and B). If the student does not say which section, attach every matching section. Never add an ATTACH line otherwise, including for questions that merely use information from a document. Always write a short reply before the ATTACH line (e.g. "Here's the timetable for IV Year CSE Section B, Jul–Dec 2026:" plus a key detail or two), never the ATTACH line alone. Don't paste document URLs in the text.`;

const CITATION = /\[(\d+)\]/g;
const ATTACH_LINE = /\n?\s*ATTACH:([^\n]*)\s*$/i;

function isRetryable(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  if (err.response) return err.response.status === 429 || err.response.status >= 500;
  return true;
}

// After a model fails, skip it for a while instead of paying for the failed attempt on every question.
const SKIP_AFTER_RATE_LIMIT_MS = 10 * 60_000; // 429: quota/rate limit
const SKIP_AFTER_OVERLOAD_MS = 60_000; // 5xx or no first token in time: temporarily overloaded
// Under load a model can accept the request yet sit silent for ~50s before streaming; give up and fall back.
const FIRST_TOKEN_TIMEOUT_MS = 12_000;
// Overall limit for finding a working model, so a visitor never waits minutes on a bad connection.
const GENERATION_DEADLINE_MS = 40_000;

class FirstTokenTimeout extends Error {}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly skipModelUntil = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly embeddings: EmbeddingsService,
    private readonly vectorStore: VectorStoreService,
    private readonly keywordSearch: KeywordSearchService,
  ) {}

  async answer(question: string): Promise<RagAnswer> {
    for await (const event of this.stream(question)) {
      if (event.type === 'done') return event;
    }
    throw new Error('Answer stream ended without a result');
  }

  /** Yields the answer text as Gemini writes it, then a final event with the cleaned answer and sources. */
  async *stream(question: string, signal?: AbortSignal): AsyncGenerator<RagStreamEvent> {
    this.assertConfigured();
    const started = Date.now();

    const refusal = unsafeReply(question);
    if (refusal) {
      yield { type: 'delta', text: refusal };
      yield { type: 'done', answer: refusal, sources: [], attachments: [] };
      return;
    }

    const matches = await this.retrieve(question);
    const retrievedAt = Date.now();

    if (matches.length === 0) {
      const answer =
        "I cannot answer this question. Try rephrasing it, or check the official college website.";
      yield { type: 'delta', text: answer };
      yield { type: 'done', answer, sources: [], attachments: [] };
      return;
    }

    const context = matches
      .map((m, i) => `[${i + 1}] Source: ${m.metadata.url}\nTitle: ${m.metadata.title}\n${m.metadata.text}`)
      .join('\n\n---\n\n');

    let raw = '';
    let firstTokenAt = 0;
    for await (const text of this.generate(question, context, signal)) {
      firstTokenAt ||= Date.now();
      raw += text;
      yield { type: 'delta', text };
    }
    this.logger.log(
      `Answered in ${Date.now() - started}ms (retrieval ${retrievedAt - started}ms, first token ${firstTokenAt - retrievedAt}ms)`,
    );

    yield { type: 'done', ...this.finalize(raw, matches) };
  }

  private assertConfigured() {
    const missing = [
      ['GEMINI_API_KEY', 'geminiApiKey'],
      ['VOYAGE_API_KEY', 'voyageApiKey'],
      ['PINECONE_API_KEY', 'pineconeApiKey'],
    ]
      .filter(([, key]) => !this.config.get<string>(key))
      .map(([name]) => name);
    if (missing.length > 0) {
      throw new ServiceUnavailableException(`Backend is not configured: set ${missing.join(', ')} in apps/backend/.env`);
    }
  }

  /** Splits off the ATTACH line, maps citation markers to sources, and strips markers from the text. */
  private finalize(raw: string, matches: { metadata: ChunkMetadata }[]): RagAnswer {
    const attachLine = raw.match(ATTACH_LINE)?.[1] ?? '';
    const body = raw.replace(ATTACH_LINE, '');

    const toSources = (text: string) => {
      const seen = new Set<string>();
      const out: RagSource[] = [];
      for (const [, n] of text.matchAll(CITATION)) {
        const m = matches[Number(n) - 1];
        if (!m || seen.has(m.metadata.url)) continue;
        seen.add(m.metadata.url);
        out.push({ url: m.metadata.url, title: m.metadata.title, type: m.metadata.type });
      }
      return out;
    };

    const attachments = toSources(attachLine);
    const attached = new Set(attachments.map((a) => a.url));
    const answer = body.replace(CITATION, '').replace(/[ \t]+([.,;:])/g, '$1').replace(/[ \t]+\n/g, '\n').trim();
    return {
      // The model occasionally replies with only the ATTACH line.
      answer: answer || (attachments.length ? `Here's the document${attachments.length > 1 ? 's' : ''} you asked for:` : answer),
      sources: toSources(body).filter((s) => !attached.has(s.url)),
      attachments,
    };
  }

  /**
   * Hybrid retrieval: dense (semantic) and BM25 (exact keywords, e.g. names) result lists merged
   * with Reciprocal Rank Fusion, so a chunk ranked highly by either retriever reaches the model.
   * Public so the accuracy eval (src/scripts/eval.ts) can score retrieval on its own.
   */
  async retrieve(question: string): Promise<{ id: string; metadata: ChunkMetadata }[]> {
    // Each retriever may fail or not be ready (rate-limited embeddings, keyword index still loading);
    // the other one still gives an answer, so the question is only refused when both are unavailable.
    if (!this.keywordSearch.isReady()) this.keywordSearch.warmUp();
    const [dense, keyword] = await Promise.all([
      this.embeddings
        .embedOne(question, 'query')
        .then((vector) => this.vectorStore.query(vector, CANDIDATES_PER_RETRIEVER))
        .catch((err) => {
          this.logger.warn(`Semantic search unavailable, using keyword results only: ${(err as Error).message}`);
          return null;
        }),
      this.keywordSearch.isReady()
        ? this.keywordSearch.search(question, CANDIDATES_PER_RETRIEVER).catch((err) => {
            this.logger.warn(`Keyword search unavailable, using dense results only: ${(err as Error).message}`);
            return null;
          })
        : Promise.resolve(null),
    ]);
    if (dense === null && keyword === null) {
      throw new ServiceUnavailableException('The search service is busy right now. Please try again in a minute.');
    }

    const fused = new Map<string, { score: number; metadata: ChunkMetadata }>();
    for (const list of [dense ?? [], keyword ?? []]) {
      list.forEach((m, rank) => {
        const entry = fused.get(m.id) ?? { score: 0, metadata: m.metadata };
        entry.score += 1 / (RRF_K + rank + 1);
        fused.set(m.id, entry);
      });
    }

    const boostFaculty = PERSON_QUESTION.test(question);
    if (boostFaculty) {
      for (const entry of fused.values()) if (FACULTY_PAGE.test(entry.metadata.url)) entry.score *= FACULTY_BOOST;
    }

    const ranked = [...fused.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .map(([id, { metadata }]) => ({ id, metadata }));
    return limitPerKey(ranked, (m) => m.metadata.url, MAX_CHUNKS_PER_PAGE).slice(0, CONTEXT_CHUNKS);
  }

  /**
   * Streams answer text from Gemini. Model fallback and retries happen while opening the stream
   * (overload and rate limits are reported before any text), so text is never duplicated.
   */
  private async *generate(question: string, context: string, signal?: AbortSignal): AsyncGenerator<string> {
    const apiKey = this.config.get<string>('geminiApiKey')!;
    const models = [this.config.get<string>('geminiModel')!, ...this.config.get<string[]>('geminiFallbackModels')!];

    const deadline = Date.now() + GENERATION_DEADLINE_MS;
    const { first, rest } = await withRetry(
      async () => {
        // Models that recently failed go last rather than first (still tried if nothing else works).
        const now = Date.now();
        const ordered = [...models].sort(
          (a, b) => Number((this.skipModelUntil.get(a) ?? 0) > now) - Number((this.skipModelUntil.get(b) ?? 0) > now),
        );
        let lastErr: unknown;
        for (const model of ordered) {
          if (Date.now() > deadline) break;
          try {
            const opened = await this.openFirstChunk(model, apiKey, question, context, signal);
            this.skipModelUntil.delete(model);
            return opened;
          } catch (err) {
            const slow = err instanceof FirstTokenTimeout;
            if ((!slow && !isRetryable(err)) || signal?.aborted) throw err;
            const rateLimited = isAxiosError(err) && err.response?.status === 429;
            this.skipModelUntil.set(model, Date.now() + (rateLimited ? SKIP_AFTER_RATE_LIMIT_MS : SKIP_AFTER_OVERLOAD_MS));
            this.logger.warn(`Gemini model ${model} unavailable (${err instanceof Error ? err.message : err}), trying next`);
            lastErr = err;
          }
        }
        throw lastErr ?? new FirstTokenTimeout("no model answered in time");
      },
      {
        label: 'Gemini generate request',
        logger: this.logger,
        isRetryable: (err) => Date.now() < deadline && (err instanceof FirstTokenTimeout || isRetryable(err)),
        maxRetries: 2,
        baseDelayMs: 3_000,
      },
    );

    // Server-sent events: "data: {json}" lines separated by blank lines.
    let buffer = '';
    for await (const chunk of (async function* () {
      yield first;
      yield* rest;
    })()) {
      buffer += chunk;
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith('data:')) continue;
        const payload = JSON.parse(line.slice(5));
        const parts: { text?: string; thought?: boolean }[] = payload.candidates?.[0]?.content?.parts ?? [];
        const text = parts
          .filter((p) => !p.thought)
          .map((p) => p.text ?? '')
          .join('');
        if (text) yield text;
      }
    }
  }

  /** Opens a model's stream and waits (bounded) for its first chunk, so a stalled model can be skipped. */
  private async openFirstChunk(
    model: string,
    apiKey: string,
    question: string,
    context: string,
    signal?: AbortSignal,
  ): Promise<{ first: string; rest: AsyncIterable<string> }> {
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    let timer: NodeJS.Timeout | undefined;

    try {
      const stream = await this.openStream(model, apiKey, question, context, abort.signal);
      stream.setEncoding('utf8'); // decode across chunk boundaries so multi-byte characters aren't split
      const iterator = stream[Symbol.asyncIterator]() as AsyncIterator<string>;
      const first = await Promise.race([
        iterator.next(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new FirstTokenTimeout(`no response within ${FIRST_TOKEN_TIMEOUT_MS}ms`)), FIRST_TOKEN_TIMEOUT_MS);
        }),
      ]);
      clearTimeout(timer);
      const rest = { [Symbol.asyncIterator]: () => iterator };
      return { first: first.done ? '' : first.value, rest };
    } catch (err) {
      clearTimeout(timer);
      abort.abort(); // close the stalled connection
      signal?.removeEventListener('abort', onAbort);
      throw err;
    }
  }

  private async openStream(
    model: string,
    apiKey: string,
    question: string,
    context: string,
    signal?: AbortSignal,
  ): Promise<Readable> {
    const thinkingLevel = this.config.get<string>('geminiThinkingLevel');
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: `Context excerpts:\n\n${context}\n\nQuestion: ${question}` }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2048,
          ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
        },
      },
      {
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        responseType: 'stream',
        timeout: 60_000,
        signal,
      },
    );
    return res.data;
  }
}
