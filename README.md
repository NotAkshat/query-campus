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

Re-run both whenever the college website content changes. To save time and quota, add `--incremental` to `ingest`: it embeds only pages that are new since the last run (an existing page that was edited keeps its old text; run a plain `pnpm run ingest` to refresh everything).

Current class timetables live on a separate portal (timetable.ietonline.in). Re-index them each semester:

```bash
pnpm run timetables   # scrapes the portal and replaces only the timetable chunks
```

## Accuracy eval

`apps/backend/eval/cases.json` holds real questions with expected results (faculty, timetables, fees, document requests, an unanswerable question). Run it after changing the prompt, model, retrieval settings or scrapers. From `apps/backend`:

```bash
pnpm run eval                    # full: retrieval + Gemini answers
pnpm run eval --retrieval-only   # just checks the right pages are retrieved (no Gemini quota)
pnpm run eval --only rohit       # cases whose id or question matches
```

Each case reports retrieval (R, with the rank of the expected page), answer content (A) and attachments (D), and why it failed. Results are compared with the previous full run, and regressions are listed (the command exits non-zero if any). Question embeddings are cached in `data/eval-embeddings.json`, so only the first run waits on Voyage's free-tier rate limit.

To add a case, copy one in `cases.json` and fill in what must appear. Expected facts were taken from the live site; timetable cases need updating when the semester changes.

## Deploy

The backend and the frontend are deployed separately.

**Backend** (any Node host, for example Render or Railway). From the repo root:

```bash
pnpm install --frozen-lockfile
pnpm --filter backend build
pnpm --filter backend start:prod     # listens on $PORT (default 3001)
```

Set these environment variables on the host (see `apps/backend/.env.example`): `GEMINI_API_KEY`, `VOYAGE_API_KEY`, `PINECONE_API_KEY`, and for production also `CORS_ORIGIN` (your website address, e.g. `https://query-campus.example.com`), `RATE_LIMIT_PER_MINUTE` (default 20 questions per visitor) and `TRUST_PROXY=1` when the host puts one proxy in front of the app. The Pinecone index must already be filled (run `scrape` and `ingest` once from your computer). Check `GET /health` after deploying.

**Frontend** (any static host, for example Netlify, Vercel or Cloudflare Pages):

```bash
VITE_API_URL=https://your-backend-address pnpm --filter frontend build   # output: apps/frontend/dist
```

Upload `apps/frontend/dist`. `VITE_API_URL` is read at build time, so rebuild when the backend address changes.

## Run the app

```bash
pnpm run dev:backend    # http://localhost:3001
pnpm run dev:frontend   # http://localhost:5173
```

## How it works

1. **Scraper** (`apps/backend/src/scraper`) crawls the target site (same-origin only), extracting text from HTML pages and PDFs (notices, forms, etc.).
2. **Ingestion** (`apps/backend/src/ingestion`) splits scraped documents into overlapping chunks, embeds them with Voyage AI, and upserts them into Pinecone with source metadata.
3. **RAG** (`apps/backend/src/rag`) embeds the user's question, retrieves the most relevant chunks from Pinecone, and asks Gemini to answer using only that context — citing sources and declining to guess when the answer isn't there.
