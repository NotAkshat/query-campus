const { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = require('docx');
const { FONT, PT, FP, FH, tocRow, runs, P, bookmarks } = require('./lib');

// ---- Project details taken from SRS.md and Query_Campus_Synopsis_Updated.docx. Edit here if needed. ----
const CFG = {
  title: 'Query Campus: A Retrieval-Augmented Generation Based Conversational Assistant For College Website Information Access',
  branch: 'Information Technology',
  session: '2026-2027',
  monthYear: 'October 2026',
  students: [
    { name: 'Akshat Sharma', roll: '23BIT005' },
    { name: 'Tanmay Choudhary', roll: '23BCS072' },
    { name: 'Riya Rawat', roll: '23BIT060' },
  ],
  guide: 'Vedpriya Dongre',
  guideDesignation: '[Designation of Project Guide]',
  guideDept: 'Computer Engineering',
  hod: '[Name of HOD]',
  director: '[Name of Director]',
};
const names = CFG.students.map((s) => s.name).join(', ');
const namesWithRoll = CFG.students.map((s) => `${s.name} (${s.roll})`);

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const nb = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const T16 = (text, o = {}) =>
  new Paragraph({
    alignment: o.align || AlignmentType.CENTER,
    spacing: { after: o.after ?? 120, before: o.before ?? 0, line: 300 },
    children: [new TextRun({ text, font: FONT, size: PT(o.size || 16), bold: o.bold })],
  });

function cover() {
  const col = (lines, align) =>
    new TableCell({
      borders: nb,
      width: { size: 4513, type: WidthType.DXA },
      children: lines.map((l, i) =>
        new Paragraph({
          alignment: align,
          spacing: { after: 80 },
          children: [new TextRun({ text: l, font: FONT, size: PT(16), bold: i === 0 })],
        }),
      ),
    });
  return [
    T16(CFG.title, { size: 20, bold: true, after: 480, before: 480 }),
    T16('A Report submitted', { after: 40 }),
    T16('in partial fulfillment for the degree of', { after: 120 }),
    T16('Bachelor of Engineering', { bold: true, after: 120 }),
    T16('in', { after: 120 }),
    T16(CFG.branch, { bold: true, after: 120 }),
    T16(`(Session ${CFG.session})`, { after: 600 }),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [4513, 4513],
      rows: [
        new TableRow({
          children: [
            col(['Submitted By:', ...namesWithRoll], AlignmentType.LEFT),
            col(['Guided By:', CFG.guide], AlignmentType.RIGHT),
          ],
        }),
      ],
    }),
    T16('', { after: 720 }),
    T16(`Department of ${CFG.branch}`, { bold: true, after: 60 }),
    T16('Institute of Engineering & Technology', { after: 60 }),
    T16('Vikramshila Campus', { after: 60 }),
    T16('Devi Ahilya Vishwavidyalaya, Indore (M.P.)', { after: 60 }),
    T16('(https://ietdavv.edu.in)', { after: 240 }),
    T16(CFG.monthYear),
  ];
}

const sig = (text, o = {}) =>
  new Paragraph({
    alignment: o.align || AlignmentType.LEFT,
    spacing: { after: o.after ?? 120, before: o.before ?? 0 },
    indent: o.indent,
    children: [new TextRun({ text, font: FONT, size: PT(14), bold: o.bold })],
  });


function certificate() {
  return [
    FH('CERTIFICATE', { pageBreak: false, before: 240, bm: 'fm_cert' }),
    FP(`The project report entitled “${CFG.title}” submitted by ${names} is approved for partial fulfillment for the award of Bachelor of Engineering in ${CFG.branch} degree by Devi Ahilya Vishwavidyalaya, Indore.`, { after: 1200 }),
    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [4513, 4513],
      rows: [
        new TableRow({
          children: ['Internal Examiner', 'External Examiner'].map(
            (t, i) =>
              new TableCell({
                borders: nb,
                width: { size: 4513, type: WidthType.DXA },
                children: [sig(t, { align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })],
              }),
          ),
        }),
      ],
    }),
  ];
}

function recommendation() {
  return [
    FH('Recommendation', { bm: 'fm_rec' }),
    FP(`The dissertation entitled “${CFG.title}” submitted by ${names} is a satisfactory account of the bonafide work done under my supervision and is recommended towards the partial fulfillment for the award of Bachelor of Engineering in ${CFG.branch} degree by Devi Ahilya Vishwavidyalaya, Indore.`, { after: 960 }),
    sig('(Signature of Project Guide)', { indent: { left: 5200 }, after: 480 }),
    sig('Date:', { after: 40 }),
    sig(`${CFG.guide.toUpperCase()}`, { indent: { left: 5200 }, bold: true, after: 40 }),
    sig(`${CFG.guideDesignation}`, { indent: { left: 5200 }, after: 40 }),
    sig(`Department of ${CFG.guideDept}`, { indent: { left: 5200 }, after: 960 }),
    sig('(Signature of HOD)', { indent: { left: 5200 }, after: 120 }),
    sig('Counter signature of HOD with seal', { indent: { left: 5200 }, bold: true }),
  ];
}

function declaration() {
  return [
    FH('Candidate Declaration', { bm: 'fm_decl' }),
    FP(`We hereby declare that the work which is being presented in this project entitled “${CFG.title}” in partial fulfillment of degree of Bachelor of Engineering in ${CFG.branch} is an authentic record of our own work carried out under the supervision and guidance of ${CFG.guide}, ${CFG.guideDesignation} in Department of ${CFG.guideDept}, Institute of Engineering and Technology, Devi Ahilya Vishwavidyalaya, Indore.`),
    FP('We are fully responsible for the matter embodied in this project in case of any discrepancy found in the project and the project has not been submitted for the award of any other degree.', { after: 480 }),
    sig('Date:', { after: 40 }),
    sig('Place: Indore', { after: 360 }),
    ...CFG.students.flatMap((s, i) => [
      sig(`(Signature of student ${i + 1})`, { indent: { left: 5200 }, after: 20, before: i ? 240 : 0 }),
      sig(s.name, { indent: { left: 5200 }, after: 20 }),
      sig(s.roll, { indent: { left: 5200 }, after: 60 }),
    ]),
  ];
}

function plagiarism() {
  const b = (t) =>
    new Paragraph({
      numbering: { reference: 'bullets', level: 0 },
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 120 },
      children: runs(t, { size: 14 }),
    });
  return [
    FH('SELF-DECLARATION OF PLAGIARISM REPORT', { bm: 'fm_plag' }),
    FP(`The project report entitled “${CFG.title}” submitted by ${names} in partial fulfillment of the requirement for the award of the degree of B.E. in ${CFG.branch} has been checked for plagiarism using a standard plagiarism detection tool.`),
    FP('The similarity index of the report is ______ %, which is within the permissible limit as per institute/university norms.'),
    FP('We hereby declare that:', { after: 120 }),
    b('The work submitted is original and has not been copied from any source without proper citation.'),
    b('All referenced materials have been duly acknowledged.'),
    b('In case of any discrepancy found in future, we shall be solely responsible for the same.'),
    FP('Signature of Student(s):', { before: 240, after: 120 }),
    ...CFG.students.map((s, i) => FP(`${i + 1}.  ${s.name} (${s.roll})  ______________________`, { after: 120, align: AlignmentType.LEFT })),
    FP('Date: ___________', { before: 240 }),
  ];
}

function acknowledgements() {
  return [
    FH('ACKNOWLEDGEMENTS', { bm: 'fm_ack' }),
    FP(`We express our deepest gratitude to our project guide, ${CFG.guide}, Department of ${CFG.guideDept}, for her constant guidance, patient supervision and encouragement throughout the development of this project. She helped us to shape a broad idea about making the college website easier to use into a well-defined problem, reviewed our synopsis and requirement specification, and challenged us to measure the accuracy of the system rather than only demonstrate it. Her suggestions during the review meetings directly influenced the retrieval design and the evaluation approach used in this report.`),
    FP(`We are thankful to ${CFG.hod}, Head of the Department, for providing the departmental facilities, a supportive academic environment and the permission to carry out this work, and for his timely advice on the scope of the project.`),
    FP(`We are grateful to ${CFG.director}, Director, Institute of Engineering & Technology, Devi Ahilya Vishwavidyalaya, Indore, for providing the institutional infrastructure, computing facilities and internet access without which the crawling, indexing and testing of the system would not have been possible. The publicly available information on the institute’s website and its class timetable portal formed the knowledge base of this project.`),
    FP('We also thank all the faculty members of the department for their valuable suggestions, our friends and classmates who tested the application and shared honest feedback on the questions they would like to ask a campus assistant, and our families for their continuous support and motivation.'),
  ];
}

function abstract() {
  return [
    FH('ABSTRACT', { bm: 'fm_abs' }),
    FP('Information about a college is spread over many web pages, PDF notices and a separate timetable portal. Students and applicants lose a lot of time searching for admission rules, fees, teacher details and class timetables. General chatbots often answer such college questions with wrong facts. This project, Query Campus, is a chat assistant that answers questions about the Institute of Engineering & Technology, DAVV, Indore in simple English. It uses only the information published by the institute and shows the pages it used.', { line: 340 }),
    FP('The system uses Retrieval-Augmented Generation. A crawler and a timetable scraper collect 1,009 documents, which are cut into 2,864 small chunks. Each chunk is converted into numbers with Voyage AI and stored in a Pinecone database. For every question, the backend searches by meaning and by keywords, merges the results, and sends the best 16 chunks to Google Gemini. Gemini is told to answer only from these chunks. If one of the two searches is not available, the other one still gives an answer. The answer is streamed to a React chat screen with a calm, light design, together with source links and downloadable documents. Retries, backup models, time limits and a limit on questions per visitor keep the website safe to run for the public.', { line: 340 }),
    FP('On a test set of 18 real questions, the assistant answered all correctly, usually in 1.5 to 4 seconds, and it refused an unanswerable question instead of guessing. The project shows that a small, low-cost and self-hosted system can give a college a reliable question-answering service.', { line: 340 }),
  ];
}

/** Table of contents in the structure required by the format. Page numbers are PAGEREF fields. */
function toc(pageNumbers) {
  const row = (label, bm, o = {}) => tocRow(label, bm, { ...o, ...(pageNumbers ? { literal: pageNumbers[bm] } : {}) });
  const ch = (label, bm) => row(label, bm, { size: 14, bold: true, after: 80 });
  const sub = (label, bm) => row(label, bm, { size: 14, indent: 360 });
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      pageBreakBefore: true,
      spacing: { after: 240 },
      children: [new TextRun({ text: 'TABLE OF CONTENTS', font: FONT, size: PT(16), bold: true })],
    }),
    new Paragraph({
      tabStops: [{ type: 'right', position: 9000 }],
      spacing: { after: 100 },
      children: [new TextRun({ text: 'DESCRIPTION', font: FONT, size: PT(14), bold: true }), new TextRun({ text: '\tPage No', font: FONT, size: PT(14), bold: true })],
    }),
    row('Certificate', 'fm_cert'),
    row('Recommendation', 'fm_rec'),
    row('Candidate Declaration', 'fm_decl'),
    row('Plagiarism Check Report', 'fm_plag'),
    row('Acknowledgements', 'fm_ack'),
    row('Abstract', 'fm_abs', { after: 160 }),
    ch('Chapter 1    Introduction', 'ch1'),
    sub('1.1 Overview and Issues Involved', 'c1_1'),
    sub('1.2 Problem Definition', 'c1_2'),
    sub('1.3 Proposed Solution', 'c1_3'),
    ch('Chapter 2    Literature Survey', 'ch2'),
    sub('2.1 Existing Solutions', 'c2_1'),
    sub('2.2 Methodology', 'c2_2'),
    ch('Chapter 3    Analysis & Design', 'ch3'),
    sub('3.1 Software Requirements', 'c3_1'),
    sub('3.2 Hardware Requirements', 'c3_2'),
    sub('3.3 Analysis Diagrams', 'c3_3'),
    sub('3.4 Design Diagrams', 'c3_4'),
    ch('Chapter 4    Implementation and Testing', 'ch4'),
    sub('4.1 Database Design', 'c4_1'),
    sub('4.2 Class Diagram', 'c4_2'),
    sub('4.3 Test Cases', 'c4_3'),
    ch('Chapter 5    Conclusion', 'ch5'),
    row('References', 'refs', { bold: true, after: 80 }),
    row('Appendix', 'appx', { bold: true }),
  ];
}

module.exports = { CFG, cover, certificate, recommendation, declaration, plagiarism, acknowledgements, abstract, toc };
