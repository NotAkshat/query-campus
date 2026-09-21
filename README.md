# Query Campus

Ask questions about IET DAVV in plain English instead of digging through the college website. Query Campus scrapes the site, indexes it with embeddings, and answers questions using a RAG (retrieval-augmented generation) pipeline powered by Gemini.

## Stack

- **Frontend**: React + Vite + Tailwind (`apps/frontend`)
- **Backend**: Nest.js (`apps/backend`)
- **Embeddings**: Voyage AI
- **Vector store**: Pinecone
- **Generation**: Google Gemini

## Setup

1. Install dependencies from the repo root:

   ```bash
   pnpm install
   ```

2. Configure the backend:

   ```bash
   cp apps/backend/.env.example apps/backend/.env
   ```

   Fill in `apps/backend/.env` with:
   - `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
   - `VOYAGE_API_KEY` — from https://dash.voyageai.com
   - `PINECONE_API_KEY` — from https://app.pinecone.io

   (The Pinecone index is created automatically on first ingest if it doesn't exist.)

3. Configure the frontend:

   ```bash
   cp apps/frontend/.env.example apps/frontend/.env
   ```

## Scrape and index the site

From `apps/backend`:

```bash
pnpm run scrape   # crawls the site, writes apps/backend/data/scraped.json
pnpm run ingest   # chunks + embeds + upserts into Pinecone
```

Re-run both whenever the college website content changes.

## Run the app

```bash
pnpm run dev:backend    # http://localhost:3001
pnpm run dev:frontend   # http://localhost:5173
```

## How it works

1. **Scraper** (`apps/backend/src/scraper`) crawls the target site (same-origin only), extracting text from HTML pages and PDFs (notices, forms, etc.).
2. **Ingestion** (`apps/backend/src/ingestion`) splits scraped documents into overlapping chunks, embeds them with Voyage AI, and upserts them into Pinecone with source metadata.
3. **RAG** (`apps/backend/src/rag`) embeds the user's question, retrieves the most relevant chunks from Pinecone, and asks Gemini to answer using only that context — citing sources and declining to guess when the answer isn't there.
