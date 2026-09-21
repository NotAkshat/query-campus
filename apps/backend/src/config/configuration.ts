export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  scrapeBaseUrl: process.env.SCRAPE_BASE_URL ?? 'https://www.ietdavv.edu.in/',
  scrapeMaxPages: parseInt(process.env.SCRAPE_MAX_PAGES ?? '600', 10),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
  voyageApiKey: process.env.VOYAGE_API_KEY ?? '',
  voyageModel: process.env.VOYAGE_MODEL ?? 'voyage-3',
  voyageDimension: parseInt(process.env.VOYAGE_DIMENSION ?? '1024', 10),
  pineconeApiKey: process.env.PINECONE_API_KEY ?? '',
  pineconeIndex: process.env.PINECONE_INDEX ?? 'query-campus',
});
