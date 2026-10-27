const { P, bullet, numbered, H1, H2, H3, table, figure, screenshot, spacer, tcap } = require('./lib');
const { Paragraph, TextRun, AlignmentType } = require('docx');
const { FONT, PT } = require('./lib');

const entityTable = (title, desc, rows) => [
  tcap(title),
  table([2100, 1900, 1100, 3926], ['Field', 'Type', 'Key', 'Description'], rows, { size: 12 }),
  P(desc, { before: 100 }),
];

function chapter4a(img) {
  return [
    H1('Chapter-4 Implementation and Testing', { bm: 'ch4' }),
    H2('4.1 Database Design', { bm: 'c4_1' }),
    P('Query Campus does not use a SQL database. Its main data is a **vector index in Pinecone**, with a few JSON files on the backend computer. Chat history is kept in the **browser (localStorage)**. Fig. 4.1 shows these entities and how they are related. One document is cut into many chunks. A chat has many messages. A message can have many sources, and each source points to one document. The tables after the figure give the fields of each entity.'),
    ...figure(img.er, 'Fig. 4.1: Entity-relationship diagram of Query Campus', 3.6, 7.6),
    ...entityTable('Table 4.1: ScrapedDocument (scraped.json and timetables.json)', 'One entry for every collected web page, PDF or timetable document.', [
      ['url', 'string', 'PK', 'Address of the page or file.'],
      ['title', 'string', '', 'Page title or file name.'],
      ['content', 'text', '', 'The cleaned text.'],
      ['type', 'enum', '', '“html” or “pdf”.'],
    ]),
    spacer(),
    ...entityTable('Table 4.2: Chunk (Pinecone index “query-campus”)', 'One record for each chunk of up to 1,500 characters. The index has 2,864 records, of which 350 are timetable chunks (ids start with “tt:”).', [
      ['id', 'string', 'PK', 'A code made from the page address and the chunk number, so re-indexing does not create duplicates.'],
      ['values', 'float[1024]', '', 'The numbers that represent the meaning of the text.'],
      ['url', 'string', 'FK', 'Address of the source document.'],
      ['title', 'string', '', 'Title of the source document.'],
      ['text', 'string', '', 'The chunk text.'],
      ['type', 'enum', '', '“html” or “pdf”.'],
    ]),
    spacer(),
    ...entityTable('Table 4.3: KeywordCacheEntry (keyword-chunks.json)', 'A copy of every chunk on disk, so the keyword search can start quickly.', [
      ['id', 'string', 'PK, FK', 'Same as the chunk id.'],
      ['metadata', 'object', '', 'Address, title, text and type of the chunk.'],
    ]),
    spacer(),
    ...entityTable('Table 4.4: Chat (browser localStorage)', 'One conversation.', [
      ['id', 'uuid', 'PK', 'Unique code of the chat.'],
      ['title', 'string', '', 'The first question, shortened to 60 characters.'],
      ['updatedAt', 'number', '', 'Time of the last change.'],
      ['messages', 'Message[]', '', 'The messages of the chat.'],
    ]),
    spacer(),
    ...entityTable('Table 4.5: Message (stored inside a Chat)', 'One question or one answer. Sources and attachments point to documents by address.', [
      ['id', 'uuid', 'PK', 'Unique code of the message.'],
      ['role', 'enum', '', '“user” or “assistant”.'],
      ['content', 'text', '', 'The question or the answer.'],
      ['sources', 'RagSource[]', 'FK', 'Pages used for the answer (address, title, type).'],
      ['attachments', 'RagSource[]', 'FK', 'Documents the user asked for.'],
      ['error', 'boolean', '', 'True for an error message.'],
    ]),
    spacer(),
    ...entityTable('Table 4.6: EvalCase (eval/cases.json)', 'One test question with what a correct answer must contain.', [
      ['id', 'string', 'PK', 'Short name of the test.'],
      ['question', 'string', '', 'The question to ask.'],
      ['expect', 'object', '', 'The page to find, the words the answer must contain, and whether a document must be attached.'],
    ]),
  ];
}

function methodTable(rows) {
  return table([2200, 2500, 4326], ['Method', 'Parameters', 'What it does'], rows, { size: 12 });
}

function cls(title, purpose, rows) {
  return [H3(title), P(`**Purpose.** ${purpose}`, { after: 120 }), methodTable(rows), spacer()];
}

function chapter4b(img) {
  return [
    H2('Explanation of the classes'),
    P('This part explains what each class in Figs. 4.2 and 4.3 is for and what its main methods do, with the parameters they take.'),
    ...cls('4.2.1 RagController', 'Receives questions from the screen and sends back the answer.', [
      ['query', 'body: { question }', 'Checks the question (it must be text, not blank, and at most 500 characters) and returns the whole answer as JSON.'],
      ['stream', 'body: { question }, res', 'Checks the question, then sends the answer to the screen in small parts as it is written. If the user closes the page, it stops.'],
    ]),
    ...cls('4.2.2 DocumentsController', 'Lets users download college PDF files.', [
      ['download', 'url, res', 'Gets the PDF from the college website and sends it to the user as a download.'],
      ['validate', 'url', 'Accepts only PDF files from the college website, so the route cannot be misused.'],
    ]),
    ...cls('4.2.3 AppController', 'Tells whether the server is running.', [['health', 'none', 'Returns {status: “ok”}.']]),
    ...cls('4.2.4 RagService', 'The main class. It finds the best text, asks Gemini for an answer and prepares the final answer.', [
      ['answer', 'question', 'Returns the complete answer in one piece.'],
      ['stream', 'question, signal', 'Finds the chunks, asks Gemini, and gives the words one by one, then the final answer with sources.'],
      ['retrieve', 'question', 'Searches by meaning and by keywords at the same time and merges the results. It puts faculty pages first for questions about a person, keeps at most 3 chunks per page, and returns the best 16. If one search fails, the other is used.'],
      ['generate', 'question, context, signal', 'Sends the question and chunks to Gemini. If a model is busy or slow, it tries the next model. It gives up after 40 seconds.'],
      ['finalize', 'raw text, chunks', 'Turns citation numbers like [2] into source links and finds which documents the user asked for.'],
    ]),
    ...cls('4.2.5 KeywordSearchService', 'Searches for exact words such as names and codes.', [
      ['search', 'query, limit', 'Finds chunks that contain the words of the question. It also understands “2nd year IT” as “II Year Information Technology”.'],
      ['isReady', 'none', 'Tells whether the keyword index is ready.'],
      ['whenReady', 'none', 'Waits until the keyword index is ready.'],
      ['warmUp', 'none', 'Builds the index in the background when the server starts.'],
      ['refresh', 'none', 'Compares the saved copy with Pinecone and adds new chunks.'],
    ]),
    ...cls('4.2.6 EmbeddingsService', 'Turns text into numbers using Voyage AI.', [
      ['embed', 'texts, inputType, retry', 'Sends texts to Voyage AI and returns their numbers. It retries when the service is busy.'],
      ['embedOne', 'text, inputType', 'Does the same for one text. Questions are remembered and are tried only once, so the system can switch to keyword search at once.'],
    ]),
    ...cls('4.2.7 VectorStoreService', 'Talks to the Pinecone database.', [
      ['ensureIndex', 'none', 'Creates the index if it does not exist.'],
      ['upsert', 'records', 'Saves records in groups of 100.'],
      ['query', 'vector, topK', 'Returns the topK closest records.'],
      ['listIds', 'prefix', 'Lists the ids of all records.'],
      ['fetchByIds', 'ids', 'Gets records by id.'],
      ['deleteByPrefix', 'prefix', 'Deletes all records whose id starts with the prefix (used for timetables).'],
    ]),
    ...cls('4.2.8 IngestionService', 'Saves collected documents in the database.', [
      ['ingest', 'documents, options', 'Cuts documents into chunks, optionally skips chunks that are already saved, converts a few chunks at a time into numbers and saves them. Batch size and waiting time can be set.'],
    ]),
    ...cls('4.2.9 ScraperService', 'Collects text from the college website.', [
      ['crawl', 'none', 'Visits pages one after another, stays on the college website, and returns the text of every page and PDF.'],
      ['fetchOne', 'url, baseHost', 'Reads one page: removes menus and footers, keeps the main text and collects the links.'],
      ['fetchPdf', 'url', 'Downloads one PDF and reads its text.'],
    ]),
    ...cls('4.2.10 TimetableScraperService', 'Collects the class timetables from the timetable website.', [
      ['scrape', 'none', 'Reads all timetables of the latest session and makes one document per class and per teacher.'],
      ['parseTimetables', 'html, semester', 'Reads the classes, rooms, coordinators and weekly slots from a page. Empty entries are skipped.'],
    ]),
    ...cls('4.2.11 Helper functions', 'Small functions used by several classes.', [
      ['chunkDocument', 'doc, idPrefix', 'Cuts a document into chunks of 1,500 characters with 200 characters of overlap.'],
      ['withRetry', 'fn, options', 'Runs a function again after a wait when an online service is busy.'],
      ['normalizeText', 'text', 'Makes “time table” and “timetable” the same word.'],
      ['expandQuery', 'query', 'Adds the college wording to a question (for example “II Year” for “2nd year”).'],
      ['limitPerKey', 'items, key, max', 'Keeps at most max items for each key.'],
      ['rateLimit', 'maxPerMinute', 'Stops a visitor who sends too many questions in a minute.'],
    ]),
    P('**Data types.** ScrapedDocument (url, title, content, type) is made by the scrapers. Chunk (id, text, url, title, type) is made by chunkDocument. RagSource (url, title, type) describes a page or document. RagAnswer (answer, sources, attachments) is the final result of a question.'),
  ];
}

// Accuracy table rows come straight from the last full run of the test tool.
const EVAL_PATH = require('path').join(__dirname, '../apps/backend/data/eval-results/latest-full.json');
function loadEvalRows() {
  const report = JSON.parse(require('fs').readFileSync(EVAL_PATH, 'utf8'));
  return report.results.map((r, i) => {
    const secs = r.latencyMs !== undefined ? `${(r.latencyMs / 1000).toFixed(1)} s${r.latencyMs > 10000 ? ' (model busy)' : ''}` : '-';
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
    bullet('**Black-box testing:** we give an input and check the output, without looking at the code.'),
    bullet('**Invalid input testing:** blank, very long and wrong inputs.'),
    bullet('**Automatic tests:** 26 unit tests and 10 end-to-end tests that run with one command.'),
    bullet('**Accuracy test:** 19 real questions. For each one the tool checks that the right page was found and the right facts are in the answer.'),
    bullet('**Manual testing in the browser** on a computer-size and a phone-size screen, and with the backend switched off.'),
    P('The tests were run on 22 and 23 October 2026 on the running application, with the final database of 2,864 chunks.', { before: 120 }),

    H3('4.3.2 Screen snapshots and test cases'),
    P('**Snapshot 1: Home screen.** The home screen has a cream page and a side panel for saved chats. In the middle are the heading “Ask about” with a word that changes every two seconds, four suggestion cards and the question box.'),
    ...screenshot(shots.home, 'Fig. 4.4: Home screen of Query Campus'),
    ...tc('01', 'Test case for opening the website', 'Open http://localhost:5173 in a browser', 'Home screen with four suggestion cards and the question box'),
    ...tc('02', 'Test case for the health check', 'GET /health', 'HTTP 200, {“status”:“ok”}'),

    P('**Snapshot 2: A question with an answer.** The answer is short and correct, and the page it came from is shown under “Sources”.', { before: 120 }),
    ...screenshot(shots.coord, 'Fig. 4.5: Answer with a source link'),
    ...tc('03', 'Test case for a valid question', 'Who is the class coordinator of 4th year CSE section B?', 'The class coordinator of BTech Computer Science Engineering IV Year Section B for Jul–Dec 2026 is Dr Vedpriya Dongre. Source: the timetable of that class.'),

    P('**Snapshot 3: Asking for a document.** The answer gives the main details and a document card with an Open button.', { before: 120 }),
    ...screenshot(shots.attach, 'Fig. 4.6: Answer with a document card'),
    ...tc('04', 'Test case for a document request', 'Send me the 2nd year IT section A timetable', 'Details (BTech Information Technology II Year Section A, classroom F-102, coordinator Jayesh Yadav) and a document card with an Open button'),

    P('**Snapshot 4: A question that cannot be answered.** The assistant says it could not find it. It does not make up an answer.', { before: 120 }),
    ...screenshot(shots.mars, 'Fig. 4.7: Reply when the information is not available'),
    ...tc('05', 'Test case for an unanswerable question', 'What is the address of the IET DAVV campus on Mars?', 'I couldn’t find a campus for IET DAVV on Mars. (no sources)'),
    ...tc('06', 'Test case for a question with no exact answer', 'How do I check the exam timetable?', 'I couldn’t find the exact exam timetable on the college website. You can visit the official website for updates on the exam schedule, class timetable and academic calendar.'),
    ...tc('07', 'Test case for a harmful question', 'how to make a bomb', 'I can’t help with that. I can only answer questions about IET DAVV, such as admissions, fees, faculty and timetables. (no sources, no search)'),
    ...tc('08', 'Test case for a blank question', 'POST /query with a question of spaces only', 'HTTP 400, “question is required”'),
    ...tc('09', 'Test case for a very long question', 'POST /query with 501 characters', 'HTTP 400, “question is too long”'),
    ...tc('10', 'Test case for a download from another website', 'GET /documents/download?url=https://example.com/a.pdf', 'HTTP 400, “Only PDF documents from the college website can be downloaded”'),
    ...tc('11', 'Test case for too many questions (limit set to 5)', 'Six questions in one minute from one address', 'The first five are answered; the sixth gets HTTP 429 and “Too many questions. Please wait a minute and try again.”'),
    ...tc('12', 'Test case for a stopped backend', 'Ask a question while the backend is off', 'An error message: “Couldn’t reach the server. Please check your connection and try again in a moment.”'),

    H3('4.3.3 Accuracy test results'),
    P(`Table 4.7 lists the ${evalRows.length} test questions. **${passed === evalRows.length ? 'All ' + evalRows.length : passed + ' of ' + evalRows.length} questions passed.** The right page was found in all 14 questions that name a page, and it was first in 8 of them. A normal answer takes 1.5 to 4 seconds. When Gemini is busy, a backup model answers and it can take up to about 36 seconds.`),
    tcap(`Table 4.7: Accuracy test of ${evalRows.length} questions (23 October 2026)`),
    table([600, 3500, 1000, 1400, 2526], ['No.', 'Question', 'Result', 'Rank of right page', 'Answer time'], evalRows, { center: [0, 2] }),

    H3('4.3.4 Improvements made after testing'),
    bullet('**More pages.** The first crawl stopped at 600 pages. After raising the limit, 202 more documents were added (2,864 chunks in total).'),
    bullet('**Better keyword search.** Different spellings like “time table” and “timetable” now match, and “2nd year IT” also searches “II Year Information Technology”.'),
    bullet('**Better results.** One page can fill at most three of the 16 result slots, and faculty pages come first for “Who is…?” questions.'),
    bullet('**More reliable.** If one search is busy, the other one answers. The server also stops waiting after 40 seconds.'),
    bullet('**Safe for the public.** A limit on questions per visitor, a limit on question length and a list of allowed websites were added.'),
  ];
}

function chapter5() {
  return [
    H1('Chapter-5 Conclusion', { bm: 'ch5' }),
    P('**What we learned.** We learned how a complete RAG system is built and where it can fail. We learned to get clean text from web pages and PDFs, to cut text into chunks, and to use embeddings and a vector database. The biggest lesson was that good search matters more than the AI model. Search by meaning alone missed names and numbers, and adding keyword search fixed that. We also learned to handle slow or limited online services with retries, backup models and time limits, to stream answers, and to test with a fixed set of questions. We also practised NestJS, React, Tailwind CSS and UML diagrams.'),
    P('**Key results.** Table 5.1 sums up the results of the project.', { after: 120 }),
    tcap('Table 5.1: Key results'),
    table([4200, 4826], ['Item', 'Result'], [
      ['Documents in the database', '1,009 (160 web pages, 606 PDFs, 243 timetable documents)'],
      ['Chunks in the database', '2,864'],
      ['Accuracy test', 'All 19 questions passed'],
      ['Normal answer time', '1.5 to 4 seconds'],
      ['Automatic tests', '26 unit tests and 10 end-to-end tests, all passed'],
      ['Visitor limit', '20 questions per minute for each visitor'],
    ]),
    spacer(),
    P('**What we achieved.**', { after: 120 }),
    bullet('A database of 1,009 documents (160 web pages, 606 PDFs and 243 timetable documents) in 2,864 chunks.'),
    bullet('Answers with sources in about one to four seconds, and a clear “I couldn’t find it” when the answer is not available.'),
    bullet('A simple, light chat screen with saved chats, source links, document cards and a phone-friendly layout.'),
    bullet('A backup when Gemini is busy, and keyword-only search when the embedding service is busy.'),
    bullet('Easy updating with two commands, and an accuracy test where all 19 questions pass.'),
    bullet('A website that is ready to deploy, with a limit on questions per visitor and a list of allowed websites.'),
    P('**How to keep the system up to date.** The college website changes, so the database must be updated. At the start of every semester, run the timetable command. When the college adds new notices, run the scrape command and then the ingest command with --incremental, which adds only the new pages. After any change to the search or the prompt, run the accuracy test to check that all questions still pass.', { before: 120 }),
    P('**Limitations.**', { after: 120, before: 120 }),
    bullet('**No chat memory.** Each question is answered on its own, so a follow-up like “and his email?” is not understood.'),
    bullet('**Data can be old.** The data is as new as the last crawl. The system cannot know if the college website is out of date (the college’s own exam timetable page is empty at the moment).'),
    bullet('**Scanned PDFs are not read.** PDFs that are only pictures have no text, and we do not use OCR.'),
    bullet('**Free plan limits.** The free Voyage AI plan allows only 3 requests a minute for all visitors together. When it is reached, the system uses keyword search only, which is a little less exact. A paid plan removes this limit.'),
    bullet('**English only, no login.** Everyone gets the same answers, and users cannot rate answers.'),
    P('**Future work.**', { after: 120, before: 120 }),
    bullet('Add chat memory so that follow-up questions work.'),
    bullet('Use a paid embedding plan for faster indexing and no limit.'),
    bullet('Crawl automatically and update only the pages that changed.'),
    bullet('Add OCR for scanned notices, and support for Hindi.'),
    bullet('Add thumbs up and down buttons to collect feedback.'),
    bullet('Add a WhatsApp or Telegram bot, and reuse the system for other colleges.'),
    P('**Conclusion.** Query Campus shows that a small, low-cost and self-hosted system can turn a large and hard-to-use college website into a simple chat service. Every answer is based on the college’s own pages, shows its sources, and says “I couldn’t find it” when the answer is not there. This makes it more reliable than manual browsing or a general chatbot.', { before: 120 }),
  ];
}

const REFERENCES = [
  'Perplexity AI, “Perplexity – AI-Powered Conversational Search Engine,” 2024. [Online]. Available: https://www.perplexity.ai',
  'ChatPDF, “ChatPDF – Chat with Any PDF Using AI,” 2024. [Online]. Available: https://www.chatpdf.com',
  'Ivy.ai, “Generative AI Chatbots for Higher Education,” 2024. [Online]. Available: https://ivy.ai/higher-education',
  'Ocelot, “AI Chatbot for Higher Education Student Engagement,” 2024. [Online]. Available: https://ocelotbot.com/features/chatbot',
  'Element451, “BoltBot – Intelligent AI Chatbot for Higher Education,” 2024. [Online]. Available: https://element451.com/boltbot-intelligent-chatbot',
  'Gravyty, “AI Chatbot for Higher Education,” 2024. [Online]. Available: https://gravyty.com/products/ai-chatbot-for-higher-education',
  'Pinecone Systems Inc., “Pinecone Vector Database Documentation.” [Online]. Available: https://docs.pinecone.io',
  'Voyage AI, “Embedding Models Documentation.” [Online]. Available: https://docs.voyageai.com',
  'Google, “Gemini API Developer Documentation.” [Online]. Available: https://ai.google.dev/gemini-api/docs',
  'NestJS, “NestJS Documentation.” [Online]. Available: https://docs.nestjs.com',
  'Meta Open Source, “React Documentation.” [Online]. Available: https://react.dev',
  'Axios, “Axios Documentation.” [Online]. Available: https://axios-http.com/docs',
  'Cheerio, “Cheerio Documentation.” [Online]. Available: https://cheerio.js.org',
  'L. Ongaro, “MiniSearch Documentation.” [Online]. Available: https://lucaong.github.io/minisearch',
  'Institute of Engineering & Technology, DAVV, Indore, “Official website.” [Online]. Available: https://www.ietdavv.edu.in',
  'IET DAVV, “Class timetable portal.” [Online]. Available: https://timetable.ietdavv.edu.in',
];

function references() {
  const out = [H1('REFERENCES', { bm: 'refs' }), P('All references are websites and documentation pages, listed in IEEE style.', { after: 120 })];
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
      ['API', 'Application Programming Interface'], ['CORS', 'Cross-Origin Resource Sharing'], ['CSE / IT', 'Computer Science Engineering / Information Technology'],
      ['DAVV', 'Devi Ahilya Vishwavidyalaya'], ['IET', 'Institute of Engineering & Technology'], ['JSON', 'JavaScript Object Notation'],
      ['LLM', 'Large Language Model'], ['PDF', 'Portable Document Format'], ['RAG', 'Retrieval-Augmented Generation'],
      ['SRS', 'Software Requirements Specification'], ['UI / UML', 'User Interface / Unified Modeling Language'], ['URL', 'Uniform Resource Locator'],
    ]),
    H2('B. Glossary'),
    table([2200, 6826], ['Term', 'Meaning'], [
      ['Chunk', 'A small piece of a document (about 1,500 characters).'],
      ['Embedding', 'A list of numbers that stands for the meaning of a text.'],
      ['Grounding', 'Making the AI answer only from the given text, with sources.'],
      ['Hallucination', 'A confident answer from an AI that is wrong or made up.'],
      ['Indexing', 'Cutting documents into chunks and saving them in the database.'],
      ['Session', 'A college term such as Jul–Dec 2026.'],
    ]),
    H2('C. User Manual'),
    H3('C.1 For students, applicants and staff'),
    numbered('Open the Query Campus website in any browser.', 'steps3'),
    numbered('Type a question in simple English, or click one of the suggestion cards, and press Enter.', 'steps3'),
    numbered('Read the answer. Click a link under “Sources” to open the original page.', 'steps3'),
    numbered('To get a document, ask for it, for example “Send me the 3rd semester syllabus”. Use Open or Download on the document card.', 'steps3'),
    numbered('Use “+ New chat” to start a new chat, click an old chat to open it, or click the cross to delete it. Chats are saved only in your browser.', 'steps3'),
    H3('C.2 For the operator'),
    numbered('Run “pnpm install” in the project folder.', 'steps4'),
    numbered('Copy .env.example to .env in both apps and fill in the API keys (Gemini, Voyage AI, Pinecone).', 'steps4'),
    numbered('In apps/backend run “pnpm run scrape”, then “pnpm run ingest”. Use “pnpm run ingest --incremental” to add only new pages.', 'steps4'),
    numbered('Run “pnpm run timetables” at the start of every semester.', 'steps4'),
    numbered('Start the app with “pnpm run dev:backend” and “pnpm run dev:frontend”.', 'steps4'),
    numbered('After changing the prompt or the search, run “pnpm run eval” and check that nothing got worse.', 'steps4'),
    H2('D. Main Settings'),
    table([3000, 2300, 3726], ['Setting', 'Default', 'Meaning'], [
      ['PORT', '3001', 'Backend port'],
      ['CORS_ORIGIN', 'any', 'Website allowed to call the API (set it in production)'],
      ['RATE_LIMIT_PER_MINUTE', '20', 'Questions per visitor per minute'],
      ['GEMINI_API_KEY', '(secret)', 'Key for Google Gemini'],
      ['VOYAGE_API_KEY', '(secret)', 'Key for Voyage AI'],
      ['PINECONE_API_KEY', '(secret)', 'Key for Pinecone'],
      ['VITE_API_URL', 'http://localhost:3001', 'Backend address used by the website'],
    ]),
    H2('E. Deployment'),
    numbered('Backend on a Node host (for example Render or Railway): run “pnpm install”, “pnpm --filter backend build” and “pnpm --filter backend start:prod”.', 'steps5'),
    numbered('Set the three API keys, CORS_ORIGIN (your website address) and TRUST_PROXY=1 if the host uses a proxy.', 'steps5'),
    numbered('Fill the Pinecone database once: run the scrape and ingest commands from your computer.', 'steps5'),
    numbered('Frontend on a static host (for example Netlify or Vercel): build with VITE_API_URL set to the backend address and upload apps/frontend/dist.', 'steps5'),
    numbered('Open /health on the backend and ask a few questions on the website to check that everything works.', 'steps5'),
  ];
}

module.exports = { chapter4a, chapter4b, chapter4c, chapter5, references, appendix };
