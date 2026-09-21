import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import { withRetry } from '../common/retry.js';

type VoyageInputType = 'query' | 'document';

function isRetryable(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  if (err.response) return err.response.status === 429 || err.response.status >= 500;
  // No response at all means a transport-level failure (ECONNRESET, ETIMEDOUT, DNS, etc.)
  return true;
}

function retryAfterMs(err: unknown): number | undefined {
  if (!isAxiosError(err)) return undefined;
  const header = err.response?.headers?.['retry-after'];
  return header ? Number(header) * 1000 : undefined;
}

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(private readonly config: ConfigService) {}

  async embed(texts: string[], inputType: VoyageInputType): Promise<number[][]> {
    const apiKey = this.config.get<string>('voyageApiKey');
    const model = this.config.get<string>('voyageModel');

    return withRetry(
      async () => {
        const res = await axios.post(
          'https://api.voyageai.com/v1/embeddings',
          { input: texts, model, input_type: inputType },
          { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30_000 },
        );

        return res.data.data
          .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
          .map((d: { embedding: number[] }) => d.embedding);
      },
      { label: 'Voyage embed request', logger: this.logger, isRetryable, retryAfterMs },
    );
  }

  async embedOne(text: string, inputType: VoyageInputType): Promise<number[]> {
    const [vector] = await this.embed([text], inputType);
    return vector;
  }
}
