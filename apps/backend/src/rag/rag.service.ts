import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { VectorStoreService } from '../vectorstore/vectorstore.service.js';
import { withRetry } from '../common/retry.js';

export interface RagSource {
  url: string;
  title: string;
}

export interface RagAnswer {
  answer: string;
  sources: RagSource[];
}

const SYSTEM_PROMPT = `You are the Query Campus assistant for the Institute of Engineering & Technology, DAVV (IET DAVV).
Answer the student's question using ONLY the context excerpts provided below, which were scraped from the official college website.
Rules:
- If the context does not contain the answer, say you don't have that information and suggest checking the official website or contacting the college directly. Do not make anything up.
- Be concise and direct. Use bullet points for lists (timetables, fees, dates, documents required, etc.).
- When you use a fact, it should be traceable to one of the provided sources; do not invent URLs, dates, or numbers not present in the context.`;

function isRetryable(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  if (err.response) return err.response.status === 429 || err.response.status >= 500;
  return true;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly embeddings: EmbeddingsService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  async answer(question: string): Promise<RagAnswer> {
    const queryVector = await this.embeddings.embedOne(question, 'query');
    const matches = await this.vectorStore.query(queryVector, 6);

    if (matches.length === 0) {
      return {
        answer: "I couldn't find anything relevant on the college website for that. Try rephrasing, or check the official site directly.",
        sources: [],
      };
    }

    const context = matches
      .map((m, i) => `[${i + 1}] Source: ${m.metadata.url}\nTitle: ${m.metadata.title}\n${m.metadata.text}`)
      .join('\n\n---\n\n');

    const answerText = await this.generate(question, context);

    const seen = new Set<string>();
    const sources: RagSource[] = [];
    for (const m of matches) {
      if (seen.has(m.metadata.url)) continue;
      seen.add(m.metadata.url);
      sources.push({ url: m.metadata.url, title: m.metadata.title });
    }

    return { answer: answerText, sources };
  }

  private async generate(question: string, context: string): Promise<string> {
    const apiKey = this.config.get<string>('geminiApiKey');
    const model = this.config.get<string>('geminiModel');

    return withRetry(
      async () => {
        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              {
                role: 'user',
                parts: [{ text: `Context excerpts:\n\n${context}\n\nQuestion: ${question}` }],
              },
            ],
            generationConfig: { maxOutputTokens: 2048 },
          },
          {
            headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
            timeout: 60_000,
          },
        );

        const parts = res.data.candidates?.[0]?.content?.parts ?? [];
        return parts.map((p: { text?: string }) => p.text ?? '').join('');
      },
      { label: 'Gemini generate request', logger: this.logger, isRetryable },
    );
  }
}
