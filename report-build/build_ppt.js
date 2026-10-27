const pptxgen = require('pptxgenjs');
const path = require('path');
const SKILL = '/Users/duochat/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/3efe6259-e7aa-4e52-b72d-0eebc2cf7eaf/07627913-1391-4bd8-a8a0-d59cc0028e44/skills/pptx';
const { applyTheme } = require(path.join(SKILL, 'scripts/apply_theme.js'));

// Palette taken from the Query Campus website.
const THEME = {
  name: 'Query Campus',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '0E0D0C', lt1: 'F4F2EA', dk2: '2E2D2B', lt2: 'EAE7DC',
    accent1: 'E85A4F', accent2: 'D8C3A5', accent3: '8E8D8A', accent4: 'E98074', accent5: '6E6D69', accent6: 'B8A98C',
    hlink: 'E85A4F', folHlink: '8E8D8A',
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Query Campus: Project Presentation';
pres.author = 'Akshat Sharma, Tanmay Choudhary, Riya Rawat';

const C = pres.SchemeColor;
const HEAD = THEME.headFontFace;
const IMG = (f) => path.join(__dirname, f);

// ---- Layouts (the slide frames) ----
pres.defineSlideMaster({
  title: 'TITLE_DARK',
  background: { color: '0E0D0C' },
  objects: [],
  slideNumber: undefined,
});
pres.defineSlideMaster({
  title: 'CONTENT',
  background: { color: 'EAE7DC' },
  objects: [
    {
      placeholder: {
        options: { name: 'title', type: 'title', x: 0.5, y: 0.3, w: 9, h: 0.8, fontFace: HEAD, fontSize: 32, bold: true, color: '0E0D0C', align: 'left', valign: 'middle', margin: 0 },
        text: '',
      },
    },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontFace: 'Calibri', fontSize: 10, color: '6E6D69', align: 'right' },
});

const card = (slide, x, y, w, h, name, fill = C.background1) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: C.accent2, width: 0.75 }, objectName: name,
  });

const num = (slide, n, x, y, d = 0.5, name = 'Number') => {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: `${name} circle` });
  slide.addText(String(n), { x, y, w: d, h: d, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: d >= 0.5 ? 18 : 14, bold: true, color: 'FFFFFF', margin: 0, isTextBox: true, objectName: `${name} text` });
};

const content = (title, section) => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: section });
  s.addText(title, { placeholder: 'title' });
  return s;
};

// ===== 1. Title =====
pres.addSection({ title: 'Introduction' });
{
  const s = pres.addSlide({ masterName: 'TITLE_DARK', sectionTitle: 'Introduction' });
  s.addText('Query Campus', { x: 0.7, y: 0.7, w: 8.6, h: 1.1, fontFace: HEAD, fontSize: 54, bold: true, color: 'F4F2EA', margin: 0, isTextBox: true, objectName: 'Title' });
  s.addText('A Retrieval-Augmented Generation Based Conversational Assistant for College Website Information Access', { x: 0.7, y: 1.85, w: 8.2, h: 0.9, fontFace: 'Calibri', fontSize: 18, color: 'D8C3A5', margin: 0, isTextBox: true, objectName: 'Subtitle' });
  s.addText('Ask about your campus. Get answers with sources.', { x: 0.7, y: 2.85, w: 8.2, h: 0.5, fontFace: HEAD, fontSize: 20, italic: true, color: 'E85A4F', margin: 0, isTextBox: true, objectName: 'Tagline' });
  s.addText(
    [
      { text: 'Akshat Sharma (23BIT005)   Tanmay Choudhary (23BCS072)   Riya Rawat (23BIT060)', options: { breakLine: true } },
      { text: 'Guide: Vedpriya Dongre', options: { breakLine: true } },
      { text: 'Institute of Engineering & Technology, DAVV, Indore   |   B.E. in Information Technology and Computer Science Engineering   |   2026-2027' },
    ],
    { x: 0.7, y: 3.9, w: 8.6, h: 1.2, fontFace: 'Calibri', fontSize: 14, color: 'EAE7DC', margin: 0, paraSpaceAfter: 4, isTextBox: true, objectName: 'Team details' },
  );
  s.addNotes('Good morning. We are presenting Query Campus, a chat assistant that answers questions about IET DAVV using only the information published by the college, and shows the sources. It was built by the three of us under the guidance of Vedpriya Dongre.');
}

// ===== 2. Problem =====
{
  const s = content('The problem', 'Introduction');
  const stats = [['160', 'web pages'], ['606', 'PDF files'], ['243', 'timetable documents']];
  stats.forEach(([n, l], i) => {
    const x = 0.5 + i * 3.1;
    card(s, x, 1.3, 2.8, 1.5, `Stat card ${i + 1}`);
    s.addText(n, { x, y: 1.4, w: 2.8, h: 0.9, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 48, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: `Stat ${i + 1}` });
    s.addText(l, { x, y: 2.25, w: 2.8, h: 0.4, align: 'center', fontFace: 'Calibri', fontSize: 16, color: C.text1, margin: 0, isTextBox: true, objectName: `Stat label ${i + 1}` });
  });
  s.addText(
    [
      { text: 'College information is spread over many pages, files and a separate timetable website', options: { bullet: true, breakLine: true } },
      { text: 'A student cannot simply ask a question and get a direct answer', options: { bullet: true, breakLine: true } },
      { text: 'General chatbots do not know the college and may give wrong answers', options: { bullet: true } },
    ],
    { x: 0.5, y: 3.15, w: 9, h: 1.8, fontFace: 'Calibri', fontSize: 18, color: C.text1, paraSpaceAfter: 10, valign: 'top', margin: 0, isTextBox: true, objectName: 'Problem points' },
  );
  s.addNotes('The college has 160 web pages and 606 PDF files, and the class timetables are on another website, which gives 243 more documents. To find one fact, a student has to guess where to look. Chatbots like ChatGPT have not read the college notices, so they can give confident but wrong answers.');
}

// ===== 3. Existing solutions =====
{
  const s = content('Existing solutions and the gap', 'Introduction');
  const hdr = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.accent1 }, fontFace: 'Calibri', fontSize: 14 } });
  const cell = (t, b) => ({ text: t, options: { bold: !!b, color: C.text1, fill: { color: C.background1 }, fontFace: 'Calibri', fontSize: 14 } });
  const rows = [
    [hdr('Solution'), hdr('Main problem')],
    [cell('College website search', true), cell('Information is scattered; no direct answers')],
    [cell('Timetable website', true), cell('User must know the class; cannot ask questions')],
    [cell('Perplexity, ChatPDF', true), cell('Whole web, or only one uploaded file')],
    [cell('Paid college chatbots', true), cell('Closed, paid, not made for IET DAVV')],
    [cell('ChatGPT, Gemini, FAQ bots', true), cell('May make up facts, or answer only fixed questions')],
  ];
  s.addTable(rows, { x: 0.5, y: 1.25, w: 9, colW: [3.2, 5.8], rowH: 0.42, border: { type: 'solid', pt: 0.75, color: C.accent2 }, margin: [0.04, 0.12, 0.04, 0.12], valign: 'middle', objectName: 'Comparison table' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 4.2, w: 9, h: 0.85, rectRadius: 0.12, fill: { color: C.text1 }, line: { color: C.text1, width: 0 }, objectName: 'Gap box' });
  s.addText([{ text: 'The gap:  ', options: { bold: true, color: 'E85A4F' } }, { text: 'no solution answers only from official IET DAVV pages, with sources, at low cost.', options: { color: 'F4F2EA' } }], { x: 0.7, y: 4.2, w: 8.6, h: 0.85, valign: 'middle', fontFace: 'Calibri', fontSize: 16, margin: 0, isTextBox: true, objectName: 'Gap text' });
  s.addNotes('We compared the main ways to find information: the college website, the timetable website, Perplexity and ChatPDF, paid college chatbots, and general chatbots. Each one has a problem for our case. None of them answers only from official IET DAVV pages, with sources, at low cost. That is the gap.');
}

// ===== 4. Objectives =====
{
  const s = content('Objectives', 'Introduction');
  const items = [
    'Collect the text of the college website and the timetable website',
    'Store it so it can be searched by meaning and by keywords',
    'Answer using only that text, and show the sources',
    'Show answers in a simple chat screen with documents',
    'Test the accuracy with a fixed list of questions',
  ];
  items.forEach((t, i) => {
    const y = 1.3 + i * 0.75;
    card(s, 0.5, y, 9, 0.62, `Objective card ${i + 1}`);
    num(s, i + 1, 0.65, y + 0.06, 0.5, `Objective ${i + 1}`);
    s.addText(t, { x: 1.4, y, w: 7.9, h: 0.62, valign: 'middle', fontFace: 'Calibri', fontSize: 16, color: C.text1, margin: 0, isTextBox: true, objectName: `Objective text ${i + 1}` });
  });
  s.addNotes('Our five objectives: collect the data, store it so it can be searched in two ways, answer only from that data with sources, present it in a simple chat screen, and measure the accuracy with a fixed list of questions.');
}

// ===== 5. Solution =====
pres.addSection({ title: 'Solution' });
{
  const s = content('Our solution: RAG in simple words', 'Solution');
  const steps = [
    ['1', 'Question', 'The student types it in plain English'],
    ['2', 'Find the text', 'Search the college data by meaning and by keywords'],
    ['3', 'Write the answer', 'Gemini answers only from that text and shows sources'],
  ];
  steps.forEach(([n, t, d], i) => {
    const x = 0.5 + i * 3.2;
    card(s, x, 1.45, 2.6, 2.3, `RAG card ${i + 1}`);
    num(s, n, x + 0.2, 1.65, 0.5, `RAG ${i + 1}`);
    s.addText(t, { x: x + 0.2, y: 2.3, w: 2.2, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: `RAG title ${i + 1}` });
    s.addText(d, { x: x + 0.2, y: 2.75, w: 2.2, h: 0.9, valign: 'top', fontFace: 'Calibri', fontSize: 14, color: C.text1, margin: 0, isTextBox: true, objectName: `RAG text ${i + 1}` });
    if (i < 2) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + 2.68, y: 2.4, w: 0.44, h: 0.4, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: `Arrow ${i + 1}` });
  });
  s.addText('No guessing: if the text is not there, the system says it cannot answer.', { x: 0.5, y: 4.2, w: 9, h: 0.6, fontFace: HEAD, fontSize: 20, italic: true, color: C.accent1, align: 'left', margin: 0, isTextBox: true, objectName: 'Key idea' });
  s.addNotes('RAG means Retrieval-Augmented Generation. First we find the right text from the college data, then we let the AI write the answer using only that text. To update the knowledge we only update the database, we do not retrain any model. If the text is not available, the system says it cannot answer instead of guessing.');
}

// ===== 6. Architecture =====
{
  const s = content('System architecture', 'Solution');
  const box = (x, y, w, h, title, sub, fill, txt, name) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: C.accent2, width: 0.75 }, objectName: `${name} box` });
    s.addText([{ text: title, options: { bold: true, fontFace: HEAD, fontSize: 14, breakLine: !!sub } }, ...(sub ? [{ text: sub, options: { fontFace: 'Calibri', fontSize: 12 } }] : [])], { x, y, w, h, align: 'center', valign: 'middle', color: txt, margin: 0.05, isTextBox: true, objectName: `${name} text` });
  };
  const down = (x, y, name) => s.addShape(pres.shapes.DOWN_ARROW, { x, y, w: 0.3, h: 0.3, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: name });
  box(0.5, 1.25, 5.0, 0.7, 'Chat screen (React)', 'Student asks, reads answers, opens documents', C.background1, C.text1, 'Screen');
  down(2.85, 1.98, 'Arrow 1');
  box(0.5, 2.3, 5.0, 0.8, 'Backend (NestJS)', 'Searches, builds the prompt, streams the answer', C.text1, 'F4F2EA', 'Backend');
  down(2.85, 3.13, 'Arrow 2');
  [['Voyage AI', 'text to numbers'], ['Pinecone', 'database'], ['Google Gemini', 'writes answers']].forEach(([t, d], i) => box(0.5 + i * 1.7, 3.5, 1.6, 0.8, t, d, C.background1, C.text1, `Service ${i + 1}`));
  box(0.5, 4.5, 5.0, 0.65, 'Indexing (done in advance)', 'Crawler + timetable scraper fill Pinecone', C.accent2, C.text1, 'Indexing');
  s.addText(
    [
      { text: 'Screen: ', options: { bold: true, color: C.accent1 } }, { text: 'React chat app', options: { breakLine: true } },
      { text: 'Backend: ', options: { bold: true, color: C.accent1 } }, { text: 'finds the best text and asks Gemini', options: { breakLine: true } },
      { text: 'Services: ', options: { bold: true, color: C.accent1 } }, { text: 'turn text into numbers, store it, write answers', options: { breakLine: true } },
      { text: 'Indexing: ', options: { bold: true, color: C.accent1 } }, { text: 'prepares the data, so answers are fast' },
    ],
    { x: 5.9, y: 1.3, w: 3.6, h: 3.7, valign: 'top', fontFace: 'Calibri', fontSize: 16, color: C.text1, paraSpaceAfter: 14, margin: 0, isTextBox: true, objectName: 'Architecture notes' },
  );
  s.addNotes('The system has four parts. The chat screen is a React app. The backend, built with NestJS, receives questions, searches and asks Gemini. Voyage AI turns text into numbers, Pinecone stores them and Google Gemini writes the answers. Separately, a crawler and a timetable scraper collect the college data in advance and save it in Pinecone, so answering is fast.');
}

// ===== 7. How a question is answered =====
{
  const s = content('How a question is answered', 'Solution');
  const steps = [
    ['Ask', 'Student types a question'],
    ['Search', 'By meaning and by keywords'],
    ['Merge', 'Keep the best 16 chunks'],
    ['Answer', 'Gemini uses only those chunks'],
    ['Show', 'Answer streams in with sources'],
  ];
  steps.forEach(([t, d], i) => {
    const x = 0.5 + i * 1.825;
    card(s, x, 1.5, 1.7, 2.6, `Step card ${i + 1}`);
    num(s, i + 1, x + 0.6, 1.7, 0.5, `Step ${i + 1}`);
    s.addText(t, { x: x + 0.1, y: 2.35, w: 1.5, h: 0.4, align: 'center', fontFace: HEAD, fontSize: 18, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: `Step title ${i + 1}` });
    s.addText(d, { x: x + 0.12, y: 2.8, w: 1.46, h: 1.2, align: 'center', valign: 'top', fontFace: 'Calibri', fontSize: 14, color: C.text1, margin: 0, isTextBox: true, objectName: `Step text ${i + 1}` });
  });
  s.addText('Typical answer time: 1.5 to 4 seconds', { x: 0.5, y: 4.4, w: 9, h: 0.5, fontFace: 'Calibri', fontSize: 18, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: 'Answer time' });
  s.addNotes('Step one: the student asks a question. Step two: the backend searches the database by meaning and by keywords at the same time, because keyword search is better for names and codes. Step three: it merges the two lists and keeps the best 16 chunks. Step four: Gemini writes the answer using only those chunks. Step five: the answer appears word by word, with source links and document cards.');
}

// ===== 8. Features =====
pres.addSection({ title: 'Results' });
{
  const s = content('Key features', 'Results');
  const f = [
    ['Answers with sources', 'Every answer shows the pages it used'],
    ['Honest refusal', 'Says “I cannot answer this question”'],
    ['Documents', 'Open or download timetables and PDFs'],
    ['Saved chats', 'Kept in the user’s own browser'],
    ['Works on phones', 'Simple, responsive chat screen'],
    ['Keeps working', 'Backup AI models and keyword fallback'],
  ];
  f.forEach(([t, d], i) => {
    const x = 0.5 + (i % 3) * 3.05;
    const y = 1.3 + Math.floor(i / 3) * 1.85;
    card(s, x, y, 2.9, 1.7, `Feature card ${i + 1}`);
    num(s, i + 1, x + 0.2, y + 0.18, 0.4, `Feature ${i + 1}`);
    s.addText(t, { x: x + 0.7, y: y + 0.15, w: 2.1, h: 0.5, valign: 'middle', fontFace: HEAD, fontSize: 16, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: `Feature title ${i + 1}` });
    s.addText(d, { x: x + 0.2, y: y + 0.8, w: 2.5, h: 0.8, valign: 'top', fontFace: 'Calibri', fontSize: 14, color: C.text1, margin: 0, isTextBox: true, objectName: `Feature text ${i + 1}` });
  });
  s.addNotes('The main features: answers always show their sources; when the answer is not available it says so; it can give documents such as timetables; chats are saved only in the user’s browser; it works on phones; and it keeps working when one AI model or one search is busy.');
}

// ===== 9. Tech stack =====
{
  const s = content('Technology stack', 'Results');
  const t = [
    ['Backend', 'Node.js, NestJS, TypeScript'], ['Frontend', 'React 19, Vite, Tailwind CSS'], ['Embeddings', 'Voyage AI'], ['Database', 'Pinecone'],
    ['AI answers', 'Google Gemini'], ['Keyword search', 'MiniSearch (BM25)'], ['Testing', 'Vitest, Supertest'], ['Hosting', 'Render'],
  ];
  t.forEach(([l, n], i) => {
    const x = 0.5 + (i % 4) * 2.3;
    const y = 1.35 + Math.floor(i / 4) * 1.8;
    card(s, x, y, 2.1, 1.6, `Tech card ${i + 1}`);
    s.addText(l, { x: x + 0.15, y: y + 0.15, w: 1.8, h: 0.35, fontFace: 'Calibri', fontSize: 12, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: `Tech label ${i + 1}` });
    s.addText(n, { x: x + 0.15, y: y + 0.55, w: 1.8, h: 0.95, valign: 'top', fontFace: HEAD, fontSize: 16, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: `Tech name ${i + 1}` });
  });
  s.addNotes('We used one language, TypeScript, on both sides. NestJS for the backend and React for the screen. Voyage AI makes the embeddings, Pinecone stores them, and Google Gemini writes the answers. MiniSearch gives us the keyword search. We test with Vitest and host on Render.');
}

// ===== 10. Knowledge base =====
{
  const s = content('The knowledge base', 'Results');
  card(s, 0.5, 1.3, 3.6, 1.7, 'Documents card');
  s.addText('1,009', { x: 0.5, y: 1.35, w: 3.6, h: 1.0, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 54, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: 'Documents number' });
  s.addText('documents collected', { x: 0.5, y: 2.35, w: 3.6, h: 0.5, align: 'center', fontFace: 'Calibri', fontSize: 16, color: C.text1, margin: 0, isTextBox: true, objectName: 'Documents label' });
  card(s, 0.5, 3.25, 3.6, 1.7, 'Chunks card');
  s.addText('2,864', { x: 0.5, y: 3.3, w: 3.6, h: 1.0, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 54, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: 'Chunks number' });
  s.addText('searchable chunks', { x: 0.5, y: 4.3, w: 3.6, h: 0.5, align: 'center', fontFace: 'Calibri', fontSize: 16, color: C.text1, margin: 0, isTextBox: true, objectName: 'Chunks label' });
  s.addChart(pres.charts.DOUGHNUT, [{ name: 'Documents', labels: ['Web pages', 'PDF files', 'Timetable documents'], values: [160, 606, 243] }], {
    x: 4.4, y: 1.25, w: 5.1, h: 3.8, holeSize: 55, chartColors: ['E85A4F', 'D8C3A5', '8E8D8A'],
    showTitle: true, title: 'What is in the database', titleFontFace: '+mn-lt', titleFontSize: 14, titleColor: '0E0D0C',
    showLegend: true, legendPos: 'b', legendFontFace: '+mn-lt', legendFontSize: 12, legendColor: '0E0D0C',
    showValue: true, showPercent: false, dataLabelColor: '0E0D0C', dataLabelFontFace: '+mn-lt', dataLabelFontSize: 12, dataBorder: { pt: 1, color: 'EAE7DC' },
    objectName: 'Document types chart',
  });
  s.addNotes('The database holds 1,009 documents: 160 web pages, 606 PDF files and 243 timetable documents, one for each class and each teacher. They are cut into 2,864 small chunks, which are what the search actually looks at.');
}

// ===== 11. Results =====
{
  const s = content('Results and testing', 'Results');
  const st = [['19 of 19', 'test questions passed'], ['1.5–4 s', 'normal answer time'], ['36', 'automatic tests passed']];
  st.forEach(([n, l], i) => {
    const x = 0.5 + i * 3.1;
    card(s, x, 1.3, 2.8, 1.35, `Result card ${i + 1}`);
    s.addText(n, { x, y: 1.38, w: 2.8, h: 0.75, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 36, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: `Result ${i + 1}` });
    s.addText(l, { x, y: 2.1, w: 2.8, h: 0.4, align: 'center', fontFace: 'Calibri', fontSize: 14, color: C.text1, margin: 0, isTextBox: true, objectName: `Result label ${i + 1}` });
  });
  s.addChart(pres.charts.BAR, [{ name: 'Questions', labels: ['1st', '2nd', '4th', '8th'], values: [8, 4, 1, 1] }], {
    x: 0.5, y: 2.85, w: 5.2, h: 2.3, barDir: 'col', chartColors: ['E85A4F'], barGapWidthPct: 60,
    showTitle: true, title: 'Position of the right page in the results', titleFontFace: '+mn-lt', titleFontSize: 12, titleColor: '0E0D0C',
    showLegend: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: '0E0D0C', dataLabelFontFace: '+mn-lt', dataLabelFontSize: 12,
    catAxisLabelColor: '0E0D0C', catAxisLabelFontFace: '+mn-lt', catAxisLabelFontSize: 12, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    objectName: 'Rank chart',
  });
  s.addText(
    [
      { text: 'The right page was found for all 14 questions that name a page', options: { bullet: true, breakLine: true } },
      { text: 'When one search is busy, the other still answers', options: { bullet: true, breakLine: true } },
      { text: 'Unanswerable questions get a clear refusal', options: { bullet: true } },
    ],
    { x: 6.0, y: 3.0, w: 3.5, h: 2.1, valign: 'top', fontFace: 'Calibri', fontSize: 14, color: C.text1, paraSpaceAfter: 8, margin: 0, isTextBox: true, objectName: 'Result notes' },
  );
  s.addNotes('We tested with 19 real questions about faculty, timetables, fees and documents, and all 19 pass. A normal answer takes 1.5 to 4 seconds. The right page was found for all 14 questions that name a page, and it was the first result in 8 of them. We also have 26 unit tests and 10 end-to-end tests, all passing.');
}

// ===== 12. Live demo =====
{
  const s = content('Live demo', 'Results');
  s.addText('query-campus-web.onrender.com', { x: 0.5, y: 1.15, w: 9, h: 0.4, fontFace: 'Calibri', fontSize: 18, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: 'Website address', hyperlink: { url: 'https://query-campus-web.onrender.com' } });
  s.addImage({ path: IMG('img/ui_home.jpg'), x: 0.5, y: 1.7, w: 3.1, h: 3.255, altText: 'Home screen of Query Campus', objectName: 'Home screenshot' });
  s.addImage({ path: IMG('img/ui_coordinator.jpg'), x: 3.8, y: 1.7, w: 3.1, h: 3.255, altText: 'Answer with a source link', objectName: 'Answer screenshot' });
  s.addText(
    [
      { text: 'Try asking:', options: { bold: true, breakLine: true, color: C.accent1, fontSize: 16 } },
      { text: 'Who is the class coordinator of 4th year CSE section B?', options: { breakLine: true } },
      { text: 'Send me the 2nd year IT section A timetable', options: { breakLine: true } },
      { text: 'What are the B.Tech fees?' },
    ],
    { x: 7.15, y: 1.7, w: 2.35, h: 3.3, valign: 'top', fontFace: 'Calibri', fontSize: 14, color: C.text1, paraSpaceAfter: 10, margin: 0, isTextBox: true, objectName: 'Sample questions' },
  );
  s.addNotes('This is the live website. The left screenshot is the home screen with suggestion cards. The right one shows an answer with its source link. During the demo, ask the three sample questions: a class coordinator, a timetable document, and the B.Tech fees. Then ask something it cannot answer, to show the refusal.');
}

// ===== 13. Limitations, future work, conclusion =====
pres.addSection({ title: 'Conclusion' });
{
  const s = content('Limitations, future work and conclusion', 'Conclusion');
  const cols = [
    ['Limitations', ['No chat memory', 'Data is as new as the last crawl', 'Scanned PDFs are not read', 'Free plan limits']],
    ['Future work', ['Chat memory', 'Hindi support', 'Automatic updates', 'WhatsApp or Telegram bot']],
    ['Conclusion', ['Small, low-cost and self-hosted', 'Answers come only from college pages', 'Shows sources, never guesses']],
  ];
  cols.forEach(([h, pts], i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.3, 2.9, 2.75, `Column card ${i + 1}`);
    s.addText(h, { x: x + 0.2, y: 1.4, w: 2.5, h: 0.45, fontFace: HEAD, fontSize: 18, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: `Column title ${i + 1}` });
    s.addText(pts.map((p, k) => ({ text: p, options: { bullet: true, breakLine: k < pts.length - 1 } })), { x: x + 0.2, y: 1.95, w: 2.55, h: 2.0, valign: 'top', fontFace: 'Calibri', fontSize: 14, color: C.text1, paraSpaceAfter: 6, margin: 0, isTextBox: true, objectName: `Column text ${i + 1}` });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 4.3, w: 9, h: 0.8, rectRadius: 0.12, fill: { color: C.text1 }, line: { color: C.text1, width: 0 }, objectName: 'Closing band' });
  s.addText('Thank you   |   Questions?', { x: 0.5, y: 4.3, w: 9, h: 0.8, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: 24, bold: true, color: 'F4F2EA', margin: 0, isTextBox: true, objectName: 'Closing text' });
  s.addNotes('To finish: the main limits are that it has no chat memory, its data is as new as the last crawl, it cannot read scanned PDFs and it depends on free plans. Next we would add chat memory, Hindi support, automatic updates and a messaging bot. In conclusion, Query Campus shows that a small, low-cost system can turn a hard-to-use college website into a reliable chat service that shows its sources and does not guess. Thank you. We are happy to take questions.');
}

(async () => {
  const out = path.join(__dirname, 'Query_Campus_Presentation.pptx');
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log('written', out);
})();
