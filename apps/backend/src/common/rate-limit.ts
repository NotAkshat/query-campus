import type { NextFunction, Request, Response } from 'express';

/**
 * Small in-memory limiter per client address. It protects the paid API keys behind /query from being
 * drained by one visitor; a shared proxy or load balancer in front should still add its own limits.
 */
export function rateLimit(maxPerMinute: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, 60_000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (maxPerMinute <= 0) return next();
    const now = Date.now();
    const ip = req.ip ?? 'unknown';
    const hit = hits.get(ip);
    if (!hit || hit.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    hit.count += 1;
    if (hit.count > maxPerMinute) {
      res.setHeader('Retry-After', String(Math.ceil((hit.resetAt - now) / 1000)));
      res.status(429).json({ message: 'Too many questions. Please wait a minute and try again.' });
      return;
    }
    next();
  };
}
