export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  scrapeBaseUrl: process.env.SCRAPE_BASE_URL ?? 'https://www.ietdavv.edu.in/',
  scrapeMaxPages: parseInt(process.env.SCRAPE_MAX_PAGES ?? '600', 10),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
  geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.1-flash-lite,gemini-3.5-flash')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean),
  // Lower thinking = faster answers; retrieval already puts the facts in the prompt. Empty uses the model default.
  geminiThinkingLevel: process.env.GEMINI_THINKING_LEVEL ?? 'minimal',
  voyageApiKey: process.env.VOYAGE_API_KEY ?? '',
  voyageModel: process.env.VOYAGE_MODEL ?? 'voyage-3',
  voyageDimension: parseInt(process.env.VOYAGE_DIMENSION ?? '1024', 10),
  // Ingestion pace. The defaults suit Voyage's free plan (3 requests a minute); with a payment method on
  // file use e.g. EMBED_BATCH_SIZE=64 and EMBED_BATCH_DELAY_MS=0 to index much faster.
  embedBatchSize: parseInt(process.env.EMBED_BATCH_SIZE ?? '5', 10),
  embedBatchDelayMs: parseInt(process.env.EMBED_BATCH_DELAY_MS ?? '21000', 10),
  pineconeApiKey: process.env.PINECONE_API_KEY ?? '',
  pineconeIndex: process.env.PINECONE_INDEX ?? 'query-campus',
  // Comma-separated list of allowed website origins. Empty allows any origin (fine for local development only).
  corsOrigins: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Questions allowed per visitor per minute on /query (0 turns the limit off).
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? '20', 10),
  // Set to 1 when the app runs behind one proxy (Render, Railway, Nginx) so the real visitor address is used.
  trustProxy: parseInt(process.env.TRUST_PROXY ?? '0', 10),
});
