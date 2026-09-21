import { Logger } from '@nestjs/common';

const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_BASE_DELAY_MS = 21_000;
const MAX_DELAY_MS = 90_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  label: string;
  logger: Logger;
  maxRetries?: number;
  baseDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
  retryAfterMs?: (err: unknown) => number | undefined;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = options.isRetryable ? options.isRetryable(err) : true;
      if (!retryable || attempt === maxRetries) throw err;

      const delayMs = options.retryAfterMs?.(err) ?? Math.min(MAX_DELAY_MS, baseDelayMs * (attempt + 1));
      const message = err instanceof Error ? err.message : String(err);
      options.logger.warn(`${options.label} failed (${message}), attempt ${attempt + 1}/${maxRetries}, retrying in ${delayMs}ms`);
      await sleep(delayMs);
    }
  }

  throw new Error('unreachable');
}
