const { P, bullet, numbered, H1, H2, H3, table, figure, screenshot, spacer } = require('./lib');
const { Paragraph, TextRun, AlignmentType } = require('docx');
const { FONT, PT } = require('./lib');

const entityTable = (title, desc, rows) => [
  P(`**${title}**`, { keepNext: true, after: 60 }),
  table([2100, 1900, 1100, 3926], ['Field', 'Type', 'Key', 'Description'], rows, { size: 12 }),
  P(desc, { before: 100 }),
];

function chapter4a(img) {
  return [
    H1('Chapter-4 Implementation and Testing', { bm: 'ch4' }),
    H2('4.1 Database Design', { bm: 'c4_1' }),
    P('Query Campus does not use a relational (SQL) database. Its main data is a **vector index in Pinecone**, backed by JSON files on the backend computer, and chat history is kept in the **browser (localStorage)**. Fig. 4.1 shows these entities with their cardinalities. The tables after it show the fields of each entity, taken from the source code, with a short description. One scraped document is cut into one or more chunks (1 to many). Each chunk has at most one keyword-cache entry. A chat has zero or more messages. A message has zero or more sources, and each source points to exactly one document. A test case expects zero or more documents to be found.'),
    ...figure(img.er, 'Fig. 4.1: Entity-relationship diagram of Query Campus', 3.6, 7.6),
    ...entityTable('Table 4.1: ScrapedDocument (data/scraped.json and data/timetables.json)', 'One entry for every crawled HTML page or PDF and every generated timetable document. It is the raw material for chunking and is rewritten each time the crawler or timetable scraper runs.', [
      ['url', 'string', 'PK', 'Absolute, normalised address of the page or PDF (timetable documents use a fragment such as #faculty-name).'],
      ['title', 'string', '', 'Page title, PDF file name, or generated title for timetable documents.'],
      ['content', 'text', '', 'Cleaned text with whitespace collapsed to single spaces.'],
      ['type', 'enum', '', '\u201Chtml\u201D or \u201Cpdf\u201D.'],
    ]),
    spacer(),
    ...entityTable('Table 4.2: Chunk / VectorRecord (Pinecone index \u201Cquery-campus\u201D)', 'One record per chunk of at most 1,500 characters. The vector is used for semantic search and the metadata is returned with each match, so no separate lookup is needed to build citations. The index now holds 2,864 records, of which 350 are timetable chunks (ids prefixed \u201Ctt:\u201D).', [
      ['id', 'string', 'PK', 'SHA-1 hash of \u201Curl#chunkNumber\u201D, optionally prefixed (\u201Ctt:\u201D for timetables), so re-indexing overwrites instead of duplicating.'],
      ['values', 'float[1024]', '', 'Embedding vector produced by Voyage AI (voyage-3); cosine metric.'],
      ['url', 'string', 'FK', 'Address of the source document (metadata).'],
      ['title', 'string', '', 'Title of the source document (metadata).'],
      ['text', 'string', '', 'The chunk text shown to the language model (metadata).'],
      ['type', 'enum', '', '\u201Chtml\u201D or \u201Cpdf\u201D (metadata).'],
    ]),
    spacer(),
    ...entityTable('Table 4.3: KeywordCacheEntry (data/keyword-chunks.json)', 'A disk copy of every chunk\u2019s id and metadata, used to build the in-memory BM25 index quickly. It is synchronised with Pinecone: new ids are downloaded, deleted ids are dropped.', [
      ['id', 'string', 'PK, FK', 'Chunk id, same as the Pinecone record id.'],
      ['metadata', 'object', '', 'url, title, text and type of the chunk.'],
    ]),
    spacer(),
    ...entityTable('Table 4.4: Chat (browser localStorage, key \u201Cquery-campus.chats\u201D)', 'A conversation. The list of chats is stored as one JSON array and is sorted by most recent activity.', [
      ['id', 'uuid', 'PK', 'Generated with crypto.randomUUID().'],
      ['title', 'string', '', 'First question, truncated to 60 characters.'],
      ['updatedAt', 'number', '', 'Time of the last change (milliseconds).'],
      ['messages', 'Message[]', '', 'Messages in order of creation.'],
    ]),
    spacer(),
    ...entityTable('Table 4.5: Message, Source and Attachment (embedded in a Chat)', 'One entry per user question or assistant reply. Sources and attachments are stored inside the assistant message that produced them and refer to documents by URL.', [
      ['id', 'uuid', 'PK', 'Message identifier.'],
      ['role', 'enum', '', '\u201Cuser\u201D or \u201Cassistant\u201D.'],
      ['content', 'text', '', 'Question text, or the cleaned markdown answer.'],
      ['sources', 'RagSource[]', 'FK', 'Cited pages: url, title, type.'],
      ['attachments', 'RagSource[]', 'FK', 'Documents the user asked for: url, title, type.'],
      ['error', 'boolean', '', 'True when the message is an error notice.'],
    ]),
    spacer(),
    ...entityTable('Table 4.6: EvalCase (apps/backend/eval/cases.json)', 'A test question with the facts and pages that a correct run must contain. The file holds test cases for faculty, timetables, fees, branches, document requests and an unanswerable question.', [
      ['id', 'string', 'PK', 'Short name, for example \u201Cclass-coordinator-iv-cse-b\u201D.'],
      ['question', 'string', '', 'The question asked.'],
      ['expect.retrieval', 'string[]', '', 'URL fragments, one of which must appear in the retrieved chunks.'],
      ['expect.answer', 'object', '', 'Words that must appear (arrays mean any one of them) or must not appear.'],
      ['expect.attachments', 'string', '', '\u201Cnone\u201D, or groups of title/URL fragments that must be attached.'],
    ]),
  ];
}

function methodTable(rows) {
  return table([2100, 2500, 4426], ['Method', 'Parameters', 'Working'], rows, { size: 12 });
}

function cls(title, purpose, rows) {
  return [H3(title), P(`**Purpose.** ${purpose}`, { after: 120 }), methodTable(rows), spacer()];
}

function chapter4b(img) {
  return [
    H2('Explanation of the classes'),
    P('The following explains the purpose of each class of Figs. 4.2 and 4.3 and the working of its methods together with the parameters they take. The classes are NestJS providers or controllers unless stated otherwise; the interfaces at the end describe the shared data structures.'),
    ...cls('4.2.1 RagController', 'HTTP entry point of the question-answering service. It validates input and converts the answer into either a JSON response or a stream of server-sent events.', [
      ['query', 'body: QueryDto { question }', 'Checks the question with parseQuestion (HTTP 400 “question is required” if it is missing, not text or blank, and “question is too long” above 500 characters) and returns RagService.answer(question) as one JSON object.'],
      ['stream', 'body: QueryDto, res: Response', 'Validates the question, sets text/event-stream headers, creates an AbortController that fires when the client disconnects, then iterates RagService.stream(). Each text piece is sent as a \u201Cdelta\u201D event and the final result as a \u201Cdone\u201D event; failures are sent as an \u201Cerror\u201D event with a user-safe message.'],
    ]),
    ...cls('4.2.2 DocumentsController', 'Serves college PDF files as downloads, because browsers ignore the download attribute on cross-origin links.', [
      ['download', 'url: string (query), res: Response', 'Validates the URL, streams the PDF from the college site (30 s time-out, 50 MB limit) to the client with a Content-Disposition attachment header and sanitised file name; responds with HTTP 502 and a message if the college site cannot be reached.'],
      ['validate', 'url: string | undefined', 'Parses the URL and accepts it only if the protocol is http/https, the host (without \u201Cwww.\u201D) equals the configured college host and the path ends in .pdf; otherwise throws BadRequestException. This prevents use as an open proxy.'],
    ]),
    ...cls('4.2.3 AppController', 'Provides the health-check endpoint.', [['health', 'none', 'Returns { status: \u201Cok\u201D } for GET /health.']]),
    ...cls('4.2.4 RagService', 'The core of the system: it retrieves evidence, asks Gemini for an answer constrained to that evidence, and post-processes the text into answer, sources and attachments.', [
      ['answer', 'question: string', 'Consumes stream() until the \u201Cdone\u201D event and returns it as a single RagAnswer.'],
      ['stream', 'question: string, signal?: AbortSignal', 'Async generator. Checks configuration, calls retrieve(); if there are no matches yields a fixed message; otherwise builds the numbered context block, yields each text piece from generate() as a delta event and finally yields a done event produced by finalize(). Logs retrieval and first-token timings.'],
      ['retrieve', 'question: string', 'Runs search by meaning (embedOne + Pinecone, 25 results) and BM25 keyword search (25 results) at the same time. If one of them fails or is not ready, the other is used; if both fail, a “search is busy” message is returned. For questions about a person, faculty pages get a boost. The two lists are merged with Reciprocal Rank Fusion (score += 1/(60 + rank + 1)), at most 3 chunks per page are kept, and the best 16 are returned. It is public so the test tool can check search alone.'],
      ['assertConfigured', 'none', 'Throws ServiceUnavailableException naming any missing key among GEMINI_API_KEY, VOYAGE_API_KEY and PINECONE_API_KEY.'],
      ['finalize', 'raw: string, matches: chunk list', 'Splits off the trailing \u201CATTACH: [n]\u201D line, maps bracketed numbers to unique sources and attachments by URL, removes the markers and stray spaces from the text, and removes attached documents from the source list.'],
      ['generate', 'question, context: string, signal?: AbortSignal', 'Orders the configured models so recently failed ones go last, opens a stream with retry (2 retries, 3 s base delay), records failures in a skip map (10 minutes for 429, 1 minute for overload or silence) and parses the server-sent events, yielding only non-thought text parts.'],
      ['openFirstChunk', 'model, apiKey, question, context: string, signal?', 'Opens the stream for one model and waits at most 12 seconds for the first chunk; on time-out aborts the connection and throws FirstTokenTimeout so the next model is tried.'],
      ['openStream', 'model, apiKey, question, context: string, signal?', 'Posts to the Gemini streamGenerateContent endpoint with the system prompt, the context and question, maxOutputTokens 2048 and the configured thinking level; returns the response stream.'],
    ]),
    ...cls('4.2.5 KeywordSearchService', 'Maintains an in-memory BM25 index (MiniSearch) over all chunks to find exact names, codes and numbers.', [
      ['search', 'query: string, limit: number', 'Adds the college wording to the question (“2nd year IT” also searches “II Year Information Technology”), makes spelling variants equal, runs an AND query (chunks with every word) and then an OR query, and returns the best results with their metadata. Stop-words are ignored, fuzzy and prefix matching apply to words of five or more letters, and title and page-address words count more.'],
      ['warmUp', 'none', 'Builds the index in the background at server start so the first question does not wait.'],
      ['isReady', 'none', 'True when an index exists. The question search uses it to skip the keyword search instead of waiting for a first build.'],
      ['whenReady', 'none', 'Waits until the index can be searched. The test tool uses it so that all cases run with keyword search.'],
      ['load', 'none', 'Returns the cached index promise and, if it is older than ten minutes, rebuilds it in the background (stale-while-revalidate).'],
      ['initialBuild', 'none', 'Builds the index from the copy on disk at once, so the server answers well right after a restart, and then syncs with Pinecone in the background. Without a copy it downloads all chunks first.'],
      ['syncWithPinecone', 'cached chunks', 'Lists all ids in Pinecone, downloads only the chunks that are missing, drops deleted ones and rewrites the copy on disk. The index is rebuilt only if something changed.'],
    ]),
    ...cls('4.2.6 EmbeddingsService', 'Client for the Voyage AI embedding API with retry and a small cache for question vectors.', [
      ['embed', 'texts: string[], inputType: “query” | “document”, retry?', 'Sends the texts to the Voyage embeddings route (30 s time-out), puts the answer back in order and returns the vectors. It retries on HTTP 429, 5xx and network errors, honouring Retry-After. The number of retries can be set by the caller.'],
      ['embedOne', 'text: string, inputType', 'Returns one vector. For questions it first checks an in-memory cache of up to 500 questions. A question vector is tried only once: if the free limit is reached, the caller switches to keyword search at once instead of waiting.'],
    ]),
    ...cls('4.2.7 VectorStoreService', 'Client for the Pinecone index.', [
      ['ensureIndex', 'none', 'Creates the serverless cosine index with the configured dimension if it does not exist and waits until ready.'],
      ['upsert', 'records: VectorRecord[]', 'Writes records in batches of 100 with retry.'],
      ['query', 'vector: number[], topK = 6', 'Returns the topK nearest records with metadata and scores.'],
      ['listIds', 'prefix?: string', 'Pages through the ids of all records, optionally with a prefix.'],
      ['fetchByIds', 'ids: string[]', 'Fetches the metadata of the given ids in pages of 100.'],
      ['deleteByPrefix', 'prefix: string', 'Lists all ids with the prefix, then deletes them in groups of 1,000; returns how many were removed. Used to replace the timetable chunks.'],
    ]),
    ...cls('4.2.8 IngestionService', 'Turns scraped documents into indexed vectors.', [
      ['ingest', 'documents: ScrapedDocument[], options: { startIndex?, idPrefix?, skipExisting?, onBatchComplete? }', 'Makes sure the index exists, cuts all documents into chunks, and with skipExisting leaves out chunks that are already in the index. Then, for each batch (5 chunks by default), it embeds the chunks as “document”, saves the vectors with their data, calls onBatchComplete (used for the checkpoint) and waits (21 seconds by default). Batch size and wait are set by EMBED_BATCH_SIZE and EMBED_BATCH_DELAY_MS, so a paid plan can index much faster.'],
    ]),
    ...cls('4.2.9 ScraperService', 'Crawls the college website.', [
      ['crawl', 'none', 'Breadth-first traversal from the base URL with a visited set and a queue, four requests at a time, until the queue is empty or the page limit is reached; returns the collected ScrapedDocuments.'],
      ['normalizeUrl', 'url: string', 'Removes the fragment and any trailing slash of non-root paths.'],
      ['isSameSite', 'url, baseHost: string', 'True if the host without \u201Cwww.\u201D equals the base host.'],
      ['fetchOne', 'url, baseHost: string', 'For a PDF delegates to fetchPdf; for HTML downloads the page, collects same-site links (skipping mailto, tel, javascript and static file types), removes page chrome, extracts the main content (#sp-component or body) and returns the document (if longer than 50 characters) and links. Failures are logged, not thrown.'],
      ['fetchPdf', 'url: string', 'Downloads the file, extracts its text with pdf-parse, collapses whitespace and returns a pdf document, or null if there is almost no text.'],
    ]),
    ...cls('4.2.10 TimetableScraperService', 'Converts the timetable portal into searchable text.', [
      ['scrape', 'none', 'Finds the latest session and the programs of each semester, fetches and parses every program\u2019s timetables, reads subject names from the printable view and returns one document per class plus one per faculty member.'],
      ['get', 'path: string, params?: object', 'HTTP GET to the portal with a User-Agent and a long time-out; returns HTML.'],
      ['parseTimetables', 'html: string, semester: string', 'Parses the page (after removing embedded images) into ClassTimetable records with program, branch, year, section, room, coordinator and slots.'],
      ['parseGrid', '$: CheerioAPI, table', 'Reads a weekly grid into slots of day, time, subject, kind, faculty, room and batch.'],
      ['subjectNames', 'pdfUrl: string', 'Reads the printable view to map subject codes to subject names.'],
    ]),
    ...cls('4.2.11 Helper functions', 'These plain functions are used by several classes.', [
      ['chunkDocument', 'doc: ScrapedDocument, idPrefix = \u201C\u201D', 'Slides a window of 1,500 characters over the content with 200 characters of overlap, trims it, skips empty slices and assigns each chunk the SHA-1 id of \u201Curl#index\u201D.'],
      ['withRetry', 'fn, options { label, logger, maxRetries = 10, baseDelayMs = 21,000, isRetryable, retryAfterMs }', 'Calls fn; on a retryable error waits for Retry-After or an increasing delay (capped at 90 s), logs a warning and retries; rethrows when the error is not retryable or attempts are exhausted.'],
      ['normalizeText', 'text: string', 'Makes spelling variants equal: “time table”, “time-table” and “timetable” become one word, and the same for “date sheet”.'],
      ['expandQuery', 'query: string', 'Adds the college wording to a class question: “2nd year” becomes “II Year”, and “IT”, “CSE” and similar short names get their full names. The original question is kept.'],
      ['urlWords', 'url: string', 'Turns the path of a page address into words, so that a page called exam-time-table can be found by those words.'],
      ['limitPerKey', 'items, key, max', 'Keeps the order of the items but allows at most max items per key. RagService uses it to keep at most 3 chunks from one page.'],
      ['rateLimit', 'maxPerMinute: number', 'Returns a middleware that counts questions per visitor address. After the limit it answers HTTP 429 with a Retry-After header. A value of 0 switches it off.'],
    ]),
    P('**Data interfaces.** ScrapedDocument (url, title, content, type) is produced by the scrapers; Chunk (id, text, url, title, type) is produced by chunkDocument; VectorRecord (id, values, metadata) is stored in Pinecone; RagSource (url, title, type) describes a page or document; RagAnswer (answer, sources, attachments) is the final result of a question.'),
  ];
}

// Accuracy table rows come straight from the last full run of the test tool.
const EVAL_PATH = require('path').join(__dirname, '../apps/backend/data/eval-results/latest-full.json');
function loadEvalRows() {
  const report = JSON.parse(require('fs').readFileSync(EVAL_PATH, 'utf8'));
  return report.results.map((r, i) => {
    const secs = r.latencyMs !== undefined ? `${(r.latencyMs / 1000).toFixed(1)} s${r.latencyMs > 10000 ? ' (model busy, backup used)' : ''}` : '-';
    return [String(i + 1), r.question, r.pass ? 'Pass' : 'Fail', r.retrieval?.rank ? String(r.retrieval.rank) : 'n/a', secs];
  });
}

function chapter4c(shots) {
  const tc = (id, title, input, output, status = 'Passed') => [
    P(`**Test ${id}: ${title}**`, { keepNext: true, after: 60 }),
    P(`Input: ${input}`, { after: 40, keepNext: true, align: AlignmentType.LEFT }),
    P(`System output: ${output}`, { after: 40, keepNext: true, align: AlignmentType.LEFT }),
    P(`Result: ${status}`, { align: AlignmentType.LEFT }),
  ];
  const evalRows = loadEvalRows();
  const passed = evalRows.filter((r) => r[2] === 'Pass').length;
  return [
    H2('4.3 Test Cases', { bm: 'c4_3' }),
    H3('4.3.1 Testing techniques used'),
    bullet('**Black-box testing** of the REST routes and the screen: we give inputs and compare the outputs with what is expected, without looking at the code.'),
    bullet('**Invalid input testing:** blank, empty, missing and very long questions, and wrong, non-PDF or foreign download links.'),
    bullet('**Unit tests** (13 tests) for the chunker, the text helpers (spelling variants, year and branch words, page limit) and the rate limiter.'),
    bullet('**End-to-end tests** (10 tests) with the NestJS testing module and Supertest. They start the whole application and check the health route and all input checks.'),
    bullet('**Accuracy testing** with 18 real questions. For each question the test checks that a page holding the answer was found (and at which rank), that the required facts are in the answer, and that a document is attached only when the user asked for it. Each run is compared with the previous run to find regressions.'),
    bullet('**Stress and failure testing:** six different questions were sent one after another to hit the free limit of the embedding service; the system switched to keyword search and still answered in about two seconds. The backend was also stopped while the page was open, to check the error message.'),
    bullet('**Manual end-to-end testing** in the browser on a computer-size and a phone-size screen: suggestion cards, typed questions, follow-up buttons, document cards, saved chats, deleting a chat and reloading the page.'),
    P('The route and screen tests below were run on 22 and 23 October 2026 on the running application (backend on port 3001, frontend on port 5173) with the final knowledge base of 2,864 chunks. The accuracy test was run on 23 October 2026 with the model gemini-3.5-flash-lite.', { before: 120 }),

    H3('4.3.2 Screen snapshots and test cases'),
    P('**Snapshot 1: Home screen.** The home screen has a cream page with a lighter side panel for saved chats. In the middle are a small status label, the heading \u201CAsk about\u201D with a word that changes every two seconds, one line about the sources, four suggestion cards, a slowly moving row of topic buttons and a round question box.'),
    ...screenshot(shots.home, 'Fig. 4.4: Home screen of Query Campus'),
    ...tc('01', 'Test case for loading the application', 'Open http://localhost:5173 in a browser', 'Home screen with four suggestion cards and the question box'),
    ...tc('02', 'Test case for the health route', 'GET /health', 'HTTP 200, body {\u201Cstatus\u201D:\u201Cok\u201D}'),

    P('**Snapshot 2: A question answered from the timetable portal.** The user asks for a class coordinator. The answer is short and correct, the timetable page that was used is shown under \u201CSources\u201D, and three ready questions appear below.', { before: 120 }),
    ...screenshot(shots.coord, 'Fig. 4.5: Answer with a source link'),
    ...tc('03', 'Test case for a valid question', 'Who is the class coordinator of 4th year CSE section B?', 'The class coordinator of BTech Computer Science Engineering IV Year Section B for the Jul\u2013Dec 2026 session is Dr Vedpriya Dongre; source: timetable of BTech Computer Science Engineering IV Year Section B'),

    P('**Snapshot 3: Document request.** When the user asks the system to send a document, the answer gives the main details and shows a document card with an Open button.', { before: 120 }),
    ...screenshot(shots.attach, 'Fig. 4.6: Answer with a document card'),
    ...tc('04', 'Test case for a document request', 'Send me the 2nd year IT section A timetable', 'Details (BTech Information Technology II Year Section A, classroom F-102, class coordinator Jayesh Yadav) and a document card for the timetable on timetable.ietonline.in with an Open button'),

    P('**Snapshot 4: A question the sources cannot answer.** The assistant says it could not find it, instead of making up an answer. No sources are shown.', { before: 120 }),
    ...screenshot(shots.mars, 'Fig. 4.7: Reply when the information is not available'),
    ...tc('05', 'Test case for an unanswerable question', 'What is the address of the IET DAVV campus on Mars?', 'I couldn\u2019t find a campus for IET DAVV on Mars. (no sources shown)'),
    ...tc('06', 'Test case for a question that has no exact answer on the site', 'How do I check the exam timetable?', 'I couldn\u2019t find the exact exam timetable on the college website. However, you can regularly visit the official website for updates on the exam schedule, class timetable, academic calendar, syllabus and exam registration.'),

    P('**Route validation tests.** The following tests were run on the REST routes with curl and in the automatic end-to-end tests.', { before: 120 }),
    ...tc('07', 'Test case for a blank question', 'POST /query with {\u201Cquestion\u201D: \u201C   \u201D}', 'HTTP 400, \u201Cquestion is required\u201D'),
    ...tc('08', 'Test case for a missing question', 'POST /query with {}', 'HTTP 400, \u201Cquestion is required\u201D'),
    ...tc('09', 'Test case for a very long question', 'POST /query with a question of 501 characters', 'HTTP 400, \u201Cquestion is too long\u201D'),
    ...tc('10', 'Test case for downloading a non-college document', 'GET /documents/download?url=https://example.com/a.pdf', 'HTTP 400, \u201COnly PDF documents from the college website can be downloaded\u201D'),
    ...tc('11', 'Test case for an invalid download link', 'GET /documents/download?url=notaurl', 'HTTP 400, \u201Curl must be a valid URL\u201D'),
    ...tc('12', 'Test case for downloading a real college PDF', 'GET /documents/download?url=https://www.ietdavv.edu.in/images/timetable/IIyr_IT_A.pdf', 'HTTP 200, content type application/pdf, a PDF file of about 200 KB'),
    ...tc('13', 'Test case for the visitor limit (limit set to 5 per minute)', 'Six questions from one address within a minute', 'The first five get a normal reply; the sixth gets HTTP 429 with a Retry-After header and the message \u201CToo many questions. Please wait a minute and try again.\u201D'),
    ...tc('14', 'Test case for the allowed website address (CORS)', 'A request from https://evil.example, and one from the address set in CORS_ORIGIN', 'The allowed address gets the Access-Control-Allow-Origin header; the other address does not'),
    ...tc('15', 'Test case for a server that is not running', 'Ask a question while the backend is stopped', 'An error bubble: \u201CCouldn\u2019t reach the server. Please check your connection and try again in a moment.\u201D'),

    H3('4.3.3 Accuracy test results'),
    P(`Table 4.7 lists the ${evalRows.length} test questions. A case passes when the expected page was found, the required facts are in the answer, and attachments behave as expected. **${passed === evalRows.length ? 'All ' + evalRows.length : passed + ' of ' + evalRows.length} cases passed.** The expected page was found in all 14 cases that name a page to find, and it was the first result in 8 of them. Normal answer time was 1.5 to 4 seconds. When Gemini was busy, a backup model answered and a few answers took 20 to 36 seconds, which is still inside the 40-second limit of the system.`),
    P(`**Table 4.7: Accuracy test of ${evalRows.length} questions (run of 23 October 2026)**`, { align: 'center', after: 80, keepNext: true }),
    table([600, 3500, 1000, 1400, 2526], ['No.', 'Question', 'Result', 'Rank of expected page', 'Answer time / note'], evalRows, { center: [0, 2] }),

    H3('4.3.4 Improvements made after testing'),
    P('Testing showed several things to improve. Each one was fixed and the tests were run again.', { after: 120 }),
    bullet('**More pages in the index.** The first crawl stopped at 600 pages. The page limit was raised and the crawl was repeated. It found 202 more documents, such as faculty biodata PDFs. The index grew from 2,247 to 2,864 chunks.'),
    bullet('**An empty timetable entry** was found in the index. It was removed and the scraper now skips empty entries.'),
    bullet('**Better keyword search.** Different spellings (\u201Cexam time table\u201D and \u201Cexam timetable\u201D) now match, words from the page address count, and questions like \u201C2nd year IT\u201D also search for \u201CII Year Information Technology\u201D.'),
    bullet('**Better mix of results.** One long page can fill at most three of the 16 result slots, and faculty pages come first for \u201CWho is ...?\u201D questions.'),
    bullet('**Better answers.** When the exact thing is not found, the assistant now says so clearly and mentions related information, and it does not use words such as \u201Cexcerpts\u201D.'),
    bullet('**Works when one search is down.** If the embedding service is busy, the keyword search alone answers; the index also starts in half a second from a copy on disk instead of waiting 15 to 20 seconds.'),
    bullet('**Faster updates.** The incremental mode embeds only new pages. The 618 new chunks were added without touching the 2,246 old ones.'),
    bullet('**Safe for the public.** Visitor limit, allowed website addresses, maximum question length and a 40-second limit for answers were added.'),
  ];
}

function chapter5() {
  return [
    H1('Chapter-5 Conclusion', { bm: 'ch5' }),
    P('**What we learned.** Building Query Campus taught us how a complete RAG system is put together and where it can fail. We learned to get clean text from messy web pages and PDFs, to choose the chunk size and overlap, and to work with embeddings and a vector database. The most important lesson was that good search matters more than the AI model. Our first version used only search by meaning, and it missed names and numbers. Adding BM25 keyword search and rank fusion fixed this. We also learned to handle slow or limited online services with retries, backup models and time limits, to stream answers with server-sent events, and to test with a fixed set of questions instead of judging by feeling. On the engineering side, we gained experience with NestJS modules, TypeScript, a React 19 chat screen, Tailwind CSS theming, pnpm workspaces and UML diagrams.'),
    P('**What we achieved.** The project gives a working assistant for IET DAVV:', { after: 120 }),
    bullet('A knowledge base of 1,009 documents (160 website pages, 606 PDFs and 243 timetable documents) in 2,864 searchable chunks.'),
    bullet('Search by meaning plus keywords, answers with citations, and a clear “I couldn’t find it” when the answer is not available, all checked on the running app on 22 and 23 October 2026.'),
    bullet('Answers that start appearing in about one to four seconds, a backup model when one is slow or limited, and a keyword-only mode when the embedding service is busy.'),
    bullet('A simple, light chat screen with saved chats, source links and document cards, and a safe PDF download route.'),
    bullet('Updating by two commands (scrape and ingest) with an incremental mode that adds only new pages, one more command for timetables, and an accuracy test in which all 18 cases pass.'),
    P('**Limitations.**', { after: 120, before: 120 }),
    bullet('**No chat memory.** Each question is answered on its own. A follow-up like \u201Cand his email?\u201D is not understood.'),
    bullet('**Data can be old.** The data is only as new as the last crawl. The incremental mode skips pages that were already indexed, so a page that was edited needs a full re-index. The system cannot know if the website itself is out of date or empty (for example, the college’s own exam timetable page is empty at the moment).'),
    bullet('**Scanned PDFs are not read.** PDFs that are only pictures have no text, and we do not use OCR.'),
    bullet('**Free plan limits.** The free Voyage AI plan allows only 3 requests a minute for all visitors together. When the limit is reached, the system uses keyword search only, which is a little less exact. A paid plan removes this limit. Indexing is also slow on the free plan (about 12 chunks a minute).'),
    bullet('**English only, no login, no feedback.** Everyone gets the same answers, and users cannot rate answers.'),
    bullet('**Depends on the website layout.** The crawler picks the main content by the layout of the current website. A redesign needs a small code change.'),
    bullet('**Few automatic tests.** The 23 automatic tests cover the helper functions, the chunker and the input checks. Answer quality is checked by the accuracy test and by hand.'),
    P('**Future work.**', { after: 120, before: 120 }),
    bullet('Add chat memory so that follow-up questions work.'),
    bullet('Use a paid embedding plan for faster indexing and no limit, and add a re-ranking step and filters by session or department to make search even better.'),
    bullet('Crawl automatically and re-index only the pages that changed.'),
    bullet('Add OCR for scanned notices, and support for Hindi.'),
    bullet('Add thumbs up/down buttons to collect feedback and grow the test set.'),
    bullet('Add a WhatsApp or Telegram bot, an admin page for crawl status, and automatic testing on every code change.'),
    bullet('Re-use the system for other colleges by changing the website address and content selector.'),
    P('**Conclusion.** Query Campus shows that a small, low-cost and self-hosted RAG system can turn a large and hard-to-use college website into a simple chat service. Every answer is based on the college\u2019s own pages, shows its sources, and says \u201CI don\u2019t know\u201D when the answer is not there. This makes it more reliable than manual browsing or a general chatbot.', { before: 120 }),
  ];
}

const REFERENCES = [
  // Websites
  'Perplexity AI, \u201CPerplexity \u2013 AI-Powered Conversational Search Engine,\u201D 2024. [Online]. Available: https://www.perplexity.ai',
  'ChatPDF, \u201CChatPDF \u2013 Chat with Any PDF Using AI,\u201D 2024. [Online]. Available: https://www.chatpdf.com',
  'Ivy.ai, \u201CGenerative AI Chatbots for Higher Education,\u201D 2024. [Online]. Available: https://ivy.ai/higher-education',
  'Ocelot, \u201CAI Chatbot for Higher Education Student Engagement,\u201D 2024. [Online]. Available: https://ocelotbot.com/features/chatbot',
  'Element451, \u201CBoltBot \u2013 Intelligent AI Chatbot for Higher Education,\u201D 2024. [Online]. Available: https://element451.com/boltbot-intelligent-chatbot',
  'Gravyty, \u201CAI Chatbot for Higher Education,\u201D 2024. [Online]. Available: https://gravyty.com/products/ai-chatbot-for-higher-education',
  'Pinecone Systems Inc., \u201CPinecone Vector Database Documentation.\u201D [Online]. Available: https://docs.pinecone.io',
  'Voyage AI, \u201CEmbedding Models Documentation.\u201D [Online]. Available: https://docs.voyageai.com',
  'Google, \u201CGemini API Developer Documentation.\u201D [Online]. Available: https://ai.google.dev/gemini-api/docs',
  'NestJS, \u201CNestJS Documentation.\u201D [Online]. Available: https://docs.nestjs.com',
  'Meta Open Source, \u201CReact Documentation.\u201D [Online]. Available: https://react.dev',
  'Axios, \u201CAxios Documentation.\u201D [Online]. Available: https://axios-http.com/docs',
  'Cheerio, \u201CCheerio Documentation.\u201D [Online]. Available: https://cheerio.js.org',
  'L. Ongaro, \u201CMiniSearch Documentation.\u201D [Online]. Available: https://lucaong.github.io/minisearch',
  'Institute of Engineering & Technology, DAVV, Indore, \u201COfficial website.\u201D [Online]. Available: https://www.ietdavv.edu.in',
  'IET DAVV, \u201CClass timetable portal.\u201D [Online]. Available: https://timetable.ietonline.in',
];

function references() {
  const out = [H1('REFERENCES', { bm: 'refs' }), P('The references follow the IEEE style. All references are websites and documentation pages (accessed in September\u2013October 2026).', { after: 120 })];
  REFERENCES.forEach((r, i) => {
    out.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 120 },
      indent: { left: 540, hanging: 540 },
      children: [new TextRun({ text: `[${i + 1}]\t`, font: FONT, size: PT(12) }), new TextRun({ text: r, font: FONT, size: PT(12) })],
      tabStops: [{ type: 'left', position: 540 }],
    }));
  });
  return out;
}

function appendix() {
  return [
    H1('APPENDIX', { bm: 'appx' }),
    H2('A. Abbreviation List'),
    table([1800, 7226], ['Abbreviation', 'Meaning'], [
      ['API', 'Application Programming Interface'], ['BFS', 'Breadth-First Search'], ['BM25', 'Best Matching 25 (probabilistic ranking function)'],
      ['CORS', 'Cross-Origin Resource Sharing'], ['CSE / IT', 'Computer Science Engineering / Information Technology'], ['DAVV', 'Devi Ahilya Vishwavidyalaya'],
      ['HTML', 'HyperText Markup Language'], ['HTTP(S)', 'HyperText Transfer Protocol (Secure)'], ['IET', 'Institute of Engineering & Technology'],
      ['JSON', 'JavaScript Object Notation'], ['LLM', 'Large Language Model'], ['PDF', 'Portable Document Format'], ['RAG', 'Retrieval-Augmented Generation'],
      ['REST', 'Representational State Transfer'], ['RRF', 'Reciprocal Rank Fusion'], ['SPA', 'Single-Page Application'], ['SRS', 'Software Requirements Specification'],
      ['SSE', 'Server-Sent Events'], ['UI / UML', 'User Interface / Unified Modeling Language'], ['URL', 'Uniform Resource Locator'],
    ]),
    H2('B. Glossary'),
    table([2200, 6826], ['Term', 'Meaning'], [
      ['Chunk', 'A passage of up to 1,500 characters cut from a document, the unit that is embedded and retrieved.'],
      ['Embedding', 'A list of numbers (here 1,024) representing the meaning of a text; similar texts have similar embeddings.'],
      ['Grounding', 'Requiring the model to answer only from supplied evidence and to cite it.'],
      ['Hallucination', 'A fluent but unsupported or false statement produced by a language model.'],
      ['Index (vector)', 'A database structure that finds the vectors nearest to a query vector quickly.'],
      ['Ingestion', 'The process of chunking, embedding and storing documents.'],
      ['Session', 'An academic term such as 2026-2027 (Jul\u2013Dec 2026) used by the timetable portal.'],
      ['Stale-while-revalidate', 'Serving the existing index while a new one is built in the background.'],
    ]),
    H2('C. User Manual'),
    H3('C.1 For students, applicants and staff'),
    numbered('Open the Query Campus web address in any modern browser.', 'steps3'),
    numbered('Type a question in plain English in the box at the bottom (or click one of the suggestion cards) and press Enter or the arrow button.', 'steps3'),
    numbered('Read the answer as it appears. Facts that came from the college sources are listed under \u201CSources\u201D; click a link to open the original page.', 'steps3'),
    numbered('To get a document, ask for it explicitly, for example \u201CSend me the syllabus of 3rd semester\u201D. A document card appears; use Open to view it or Download to save a college PDF.', 'steps3'),
    numbered('Use \u201C+ New chat\u201D to start a new conversation, select an earlier chat in the sidebar to continue it, or click the cross beside a chat to delete it. Chats are kept only in your browser.', 'steps3'),
    numbered('If the assistant says it does not have the information, check the official website or contact the college.', 'steps3'),
    H3('C.2 For the operator'),
    P('Prerequisites: Node.js, pnpm and API keys for Gemini, Voyage AI and Pinecone.', { after: 120 }),
    numbered('Install dependencies from the repository root with \u201Cpnpm install\u201D.', 'steps4'),
    numbered('Copy apps/backend/.env.example to apps/backend/.env and fill GEMINI_API_KEY, VOYAGE_API_KEY and PINECONE_API_KEY; copy apps/frontend/.env.example to apps/frontend/.env.', 'steps4'),
    numbered('From apps/backend run \u201Cpnpm run scrape\u201D to crawl the website, then \u201Cpnpm run ingest\u201D to index it. Re-run both when the website changes.', 'steps4'),
    numbered('Run \u201Cpnpm run timetables\u201D at the start of every semester to refresh class and faculty timetables.', 'steps4'),
    numbered('Start the services with \u201Cpnpm run dev:backend\u201D (port 3001) and \u201Cpnpm run dev:frontend\u201D (port 5173).', 'steps4'),
    numbered('After changing the prompt, model or retrieval settings run \u201Cpnpm run eval\u201D (add --retrieval-only to avoid using Gemini quota) and check that there are no regressions.', 'steps4'),
    H2('D. Configuration Variables'),
    table([3000, 2600, 3426], ['Variable', 'Default', 'Meaning'], [
      ['PORT', '3001', 'Backend port'],
      ['CORS_ORIGIN', '(empty = any)', 'Website addresses allowed to call the API (comma separated); set it in production'],
      ['RATE_LIMIT_PER_MINUTE', '20', 'Questions allowed per visitor per minute (0 = no limit)'],
      ['TRUST_PROXY', '0', 'Set to 1 behind one proxy so the real visitor address is used'],
      ['EMBED_BATCH_SIZE / EMBED_BATCH_DELAY_MS', '5 / 21000', 'Indexing pace; use e.g. 64 / 0 on a paid Voyage plan'],
      ['SCRAPE_BASE_URL', 'https://www.ietdavv.edu.in/', 'Website to crawl'],
      ['SCRAPE_MAX_PAGES', '600', 'Maximum pages visited'],
      ['GEMINI_API_KEY / GEMINI_MODEL', '(secret) / gemini-3.5-flash-lite', 'Generation key and primary model'],
      ['GEMINI_FALLBACK_MODELS', 'gemini-3.1-flash-lite, gemini-3.5-flash', 'Models tried when the primary fails'],
      ['GEMINI_THINKING_LEVEL', 'minimal', 'Lower thinking gives faster answers'],
      ['VOYAGE_API_KEY / VOYAGE_MODEL', '(secret) / voyage-3', 'Embedding key and model'],
      ['VOYAGE_DIMENSION', '1024', 'Vector size; must match the index'],
      ['PINECONE_API_KEY / PINECONE_INDEX', '(secret) / query-campus', 'Vector database key and index name'],
      ['VITE_API_URL (frontend)', 'http://localhost:3001', 'Backend address used by the browser'],
    ]),
    H2('E. REST Interface Summary'),
    table([1100, 2900, 5026], ['Method', 'Path', 'Description'], [
      ['POST', '/query', 'Body {question} (up to 500 characters). Returns {answer, sources, attachments} as JSON. HTTP 429 after 20 questions a minute from one address.'],
      ['POST', '/query/stream', 'Same input; returns server-sent events: delta {text}, done {answer, sources, attachments}, error {message}.'],
      ['GET', '/documents/download?url=', 'Streams a PDF from the college website as a download.'],
      ['GET', '/health', 'Returns {status: ok}.'],
    ]),
    H2('F. Deployment'),
    P('The backend and the frontend are deployed separately (details are in the README of the project).', { after: 120 }),
    numbered('Backend on any Node host (for example Render or Railway): run “pnpm install”, “pnpm --filter backend build” and “pnpm --filter backend start:prod”.', 'steps5'),
    numbered('Set the environment variables of the backend: the three API keys, CORS_ORIGIN (the website address), RATE_LIMIT_PER_MINUTE and TRUST_PROXY=1 when the host uses a proxy.', 'steps5'),
    numbered('The Pinecone index must be filled before the first visitor comes: run the scrape and ingest commands once from your computer.', 'steps5'),
    numbered('Frontend on any static host (for example Netlify or Vercel): build with VITE_API_URL set to the backend address, then upload apps/frontend/dist.', 'steps5'),
    numbered('Open GET /health on the backend, then ask a few questions on the website to check that everything works.', 'steps5'),
  ];
}

module.exports = { chapter4a, chapter4b, chapter4c, chapter5, references, appendix };
