const { P, bullet, numbered, H1, H2, H3, table, twoFigures, tcap } = require('./lib');

function chapter1(img) {
  return [
    H1('Chapter-1 Introduction', { bm: 'ch1' }),
    H2('1.1 Overview and Issues Involved', { bm: 'c1_1' }),
    P('A college website is the first place where students look for information. They want to know about admission, fees, scholarships, exams and class timetables. But this information is spread over many pages and files. The IET DAVV website has 160 web pages and 606 PDF files. The class timetables are on a different website, which gives us 243 more documents. To find one simple fact, a student has to guess which page or file to open.'),
    P('AI chatbots such as Google Gemini can answer questions in simple language. But they have not read the college notices, and they often give wrong answers with full confidence. A wrong fee or date can cost a student time and money. This project uses a method called Retrieval-Augmented Generation (RAG). The system first finds the right text on the college website. Then the AI writes an answer using only that text.'),
    P('The main issues are:', { after: 120 }),
    bullet('**Scattered information.** Facts are inside web pages, PDF files and a separate timetable website.'),
    bullet('**Names and numbers.** Search by meaning is weak for exact names and codes, so we also need keyword search.'),
    bullet('**Trust.** Answers must show their sources, and the system must say “I could not find it” when the answer is missing.'),
    bullet('**Old data.** Notices change every semester, so the data must be easy to update.'),
    bullet('**Free plans.** Our online services allow only a few requests per minute, so the system must handle delays and failures.'),

    H2('1.2 Problem Definition', { bm: 'c1_2' }),
    P('Students cannot ask a question in simple language and get a correct answer from the college website. The information is hard to find, and general chatbots do not know the college data and may give wrong answers.'),
    P('We need a website where a student can type a question and get a short, correct answer with its source. The objectives are:', { after: 120 }),
    numbered('Collect the text of the college website and the timetable website.', 'steps1'),
    numbered('Store the text so that it can be searched by meaning and by keywords.', 'steps1'),
    numbered('Write answers with an AI that uses only the college text, and show the sources.', 'steps1'),
    numbered('Show the answer in a simple chat screen that also gives documents such as timetables.', 'steps1'),
    numbered('Test the accuracy with a fixed list of questions.', 'steps1'),

    H2('1.3 Proposed Solution', { bm: 'c1_3' }),
    P('Query Campus is a chat assistant for IET DAVV. It works in two parts, shown in Fig. 1.1. In the **indexing part**, the operator collects the pages, cuts them into small chunks and saves them in a database. In the **answering part**, the system searches the database for the best chunks, sends them to Gemini, and shows the answer to the student with its sources.'),
    ...twoFigures(img.flowA, img.flowB, 5.7, 'Fig. 1.1: Flow diagrams (indexing and answering)'),
    P('**Functions of the project:**', { after: 120 }),
    bullet('Collects text from the college website (web pages and PDFs) and from the timetable website.'),
    bullet('Saves the text as small chunks in a Pinecone database.'),
    bullet('Finds the best chunks by meaning and by keywords.'),
    bullet('Writes the answer with Gemini, with sources, and says so when it cannot find the answer.'),
    bullet('Shows the answer in a chat screen with saved chats, source links and document cards.'),
    bullet('Works safely for the public: a limit on questions per visitor and a limit on question length.'),
    bullet('Has a test tool with 19 questions to check the accuracy.'),
    P('**Why it is better than existing solutions.** The college website search cannot understand questions. FAQ chatbots only answer fixed questions. General chatbots make up facts. Paid college chatbots are closed and are not made for IET DAVV. Query Campus answers only from the college pages, shows its sources, reads the timetable website too, says “I could not find it” instead of guessing, and is easy to update.'),
  ];
}

function chapter2(img) {
  const t1 = table(
    [1700, 2200, 2000, 3126],
    ['Solution', 'What it does', 'Problem', 'How Query Campus is better'],
    [
      ['IET DAVV website', 'Pages, notices and downloads', 'Information is scattered; no direct answers', 'Gives a direct answer with its source'],
      ['Timetable website', 'Shows class timetables', 'User must know the class; cannot ask who teaches what', 'Answers questions about teachers, subjects and coordinators'],
      ['Perplexity AI [1]', 'Web search with a chat answer', 'Uses the whole web, not only official pages', 'Uses only official IET DAVV pages'],
      ['ChatPDF [2]', 'Questions on one uploaded PDF', 'User must upload each file', 'All college pages are ready in advance'],
      ['Ivy.ai, Ocelot, BoltBot, Gravyty [3]-[6]', 'Paid chatbots for colleges', 'Closed, paid, not made for IET DAVV', 'Open and works on free plans'],
      ['General chatbots (ChatGPT, Gemini)', 'Open conversation', 'No college data; may make up facts', 'Answers only from college text'],
      ['FAQ chatbots', 'Fixed questions and replies', 'Fail on new questions', 'Accepts any question'],
    ],
    { size: 12 },
  );
  return [
    H1('Chapter-2 Literature Survey', { bm: 'ch2' }),
    H2('2.1 Existing Solutions', { bm: 'c2_1' }),
    P('This section describes the existing ways to find information on a college website. Table 2.1 compares them with Query Campus.'),
    P('**(a) The IET DAVV website.** It has admissions, faculty, syllabus, notices and downloads. It is the most trusted source, but related facts are in different places and many are only inside PDF files. A user cannot ask a question directly.'),
    P('**(b) The timetable website.** The user selects the session, semester and course, and the site shows the timetables. It is accurate, but it cannot answer “Which classes does this teacher take?” without opening many timetables.'),
    P('**(c) Perplexity AI.** Perplexity [1] is a chat-style search engine that shows links with its answers. But it searches the whole web, so a college answer may come from an unofficial or old page.'),
    P('**(d) ChatPDF.** ChatPDF [2] answers questions about one uploaded PDF. The college has more than 600 PDFs, so a student would have to find and upload the right one.'),
    P('**(e) Paid college chatbots.** Ivy.ai [3], Ocelot [4], Element451 BoltBot [5] and Gravyty [6] sell chatbots to universities. They work well, but they are closed, paid products that are set up by the company.'),
    P('**(f) General chatbots and FAQ bots.** ChatGPT and Gemini have not read the current college notices and may give wrong answers. FAQ bots only reply to a fixed list of questions.'),
    tcap('Table 2.1: Comparison of existing solutions with Query Campus'),
    t1,
    P('**Gap.** No existing solution gives a direct answer that comes only from the official IET DAVV website and timetable website, shows its source, and can be updated cheaply. Query Campus fills this gap.', { before: 240 }),

    H2('2.2 Methodology', { bm: 'c2_2' }),
    H3('2.2.1 Steps followed'),
    numbered('**Plan.** We wrote the synopsis and the SRS to decide what the project must do.', 'steps2'),
    numbered('**Collect data.** We built a crawler for the college website and a scraper for the timetable website.', 'steps2'),
    numbered('**Index.** We cut the text into chunks, converted them into numbers and saved them in a database.', 'steps2'),
    numbered('**Answer.** We built the search, the Gemini prompt and the streaming answer.', 'steps2'),
    numbered('**Chat screen.** We built the React chat screen with sources, saved chats and document cards.', 'steps2'),
    numbered('**Test and improve.** We tested with 19 real questions and fixed the problems we found.', 'steps2'),
    H3('2.2.2 Concepts needed to understand the project'),
    P('**Crawler.** A program that opens a web page, collects its links and repeats this for every new link. Ours stays on the college website.'),
    P('**Chunk.** A small piece of a document (about 1,500 characters). Small pieces are easier to search than a whole document.'),
    P('**Embedding.** A list of numbers that represents the meaning of a text. Texts with similar meaning get similar numbers.'),
    P('**Vector database.** A database that stores embeddings and quickly finds the ones closest to a question. We use Pinecone.'),
    P('**Keyword search.** Finds texts that contain the exact words of the question. It is good for names and codes. We use it together with search by meaning and merge the two result lists.'),
    P('**Large language model (LLM).** An AI that writes text. We use Google Gemini.'),
    P('**Grounding.** Telling the AI to use only the given text, to show its sources, and to say when the answer is missing. This stops made-up answers.'),
    P('**RAG.** Retrieval-Augmented Generation: first find the right text, then let the AI write the answer from it. To update the knowledge, we only update the database.'),
    P('**Streaming.** The server sends the answer in small parts, so the student sees the words appear while the answer is being written.'),
  ];
}

module.exports = { chapter1, chapter2 };
