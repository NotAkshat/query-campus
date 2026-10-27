const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Footer, AlignmentType, PageNumber, PageOrientation, NumberFormat, SectionType } = require('docx');
const L = require('./lib');
const front = require('./front');
const { chapter1, chapter2 } = require('./ch12');
const { chapter3 } = require('./ch3');
const c45 = require('./ch45');

const D = (f) => path.join(__dirname, 'diagrams', f);
const I = (f) => path.join(__dirname, 'img', f);
const img = {
  flowA: D('01a_flow_index.png'), flowB: D('01b_flow_query.png'), usecase: D('02_usecase.png'), arch: D('03_architecture.png'),
  seqQuery: D('04_seq_query.png'), seqIngest: D('05_seq_ingest.png'), clsA: D('06a_class_query.png'), clsB: D('06b_class_index.png'), er: D('07_er.png'),
};
const shots = { home: I('ui_home.jpg'), coord: I('ui_coordinator.jpg'), attach: I('ui_attachment.jpg'), mars: I('ui_unanswerable.jpg') };
const pageNumbers = fs.existsSync('pagenums.json') ? JSON.parse(fs.readFileSync('pagenums.json', 'utf8')) : null;

const footer = (roman) => ({
  default: new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: roman
        ? [new TextRun({ text: '(', font: L.FONT, size: 24 }), new TextRun({ children: [PageNumber.CURRENT], font: L.FONT, size: 24 }), new TextRun({ text: ')', font: L.FONT, size: 24 })]
        : [new TextRun({ children: [PageNumber.CURRENT], font: L.FONT, size: 24 })],
    })],
  }),
});
const A4 = { width: 11906, height: 16838 };
const margin = { top: 1440, bottom: 1300, left: 1440, right: 1440 };
const page = (o = {}) => ({ size: { ...A4, ...(o.landscape ? { orientation: PageOrientation.LANDSCAPE } : {}) }, margin, ...(o.pageNumbers ? { pageNumbers: o.pageNumbers } : {}) });

// Build body first so heading bookmarks are registered.
const ch1 = chapter1(img), ch2 = chapter2(img), ch3 = chapter3(img);
const ch4a = c45.chapter4a(img);
const classSec = [L.H2('4.2 Class Diagram', { bm: 'c4_2', pageBreak: false }), ...L.figure(img.clsA, 'Fig. 4.2: Class diagram (1 of 2): query service classes', 6.3, 8.4), ...L.figure(img.clsB, 'Fig. 4.3: Class diagram (2 of 2): indexing classes and data types', 6.3, 8.4)];
const ch4b = c45.chapter4b(img), ch4c = c45.chapter4c(shots), ch5 = c45.chapter5();
const refs = c45.references(), app = c45.appendix();

const frontSec = [
  ...front.certificate(), ...front.recommendation(), ...front.declaration(), ...front.plagiarism(), ...front.acknowledgements(), ...front.abstract(),
  ...front.toc(pageNumbers),
];

// Split the body into portrait and landscape sections.
const body = [...ch1, ...ch2, ...ch3, ...ch4a, ...classSec, ...ch4b, ...ch4c, ...ch5, ...refs, ...app];
const bodySections = [];
let cur = [];
body.forEach((el) => {
  if (el && el.__land) {
    if (cur.length) bodySections.push({ land: false, kids: cur });
    cur = [];
    bodySections.push({ land: true, kids: el.__land });
  } else cur.push(el);
});
if (cur.length) bodySections.push({ land: false, kids: cur });
const bodyDocSections = bodySections.map((s, k) => ({
  properties: { type: SectionType.NEXT_PAGE, page: page({ landscape: s.land, ...(k === 0 ? { pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } : {}) }) },
  footers: footer(false),
  children: s.kids,
}));

const doc = new Document({
  creator: 'Query Campus project team',
  title: front.CFG.title,
  features: { updateFields: !pageNumbers },
  styles: {
    default: { document: { run: { font: L.FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: L.FONT, size: 28, bold: true }, paragraph: { outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: L.FONT, size: 26, bold: true }, paragraph: { outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: L.FONT, size: 26, bold: true }, paragraph: { outlineLevel: 2 } },
    ],
  },
  numbering: L.numberingConfig,
  sections: [
    { properties: { page: page() }, children: front.cover() },
    { properties: { type: SectionType.NEXT_PAGE, page: page({ pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } }) }, footers: footer(true), children: frontSec },
    ...bodyDocSections,
  ],
});

Packer.toBuffer(doc).then((b) => {
  fs.writeFileSync('Query_Campus_Project_Report.docx', b);
  fs.writeFileSync('headings.json', JSON.stringify({ bookmarks: L.bookmarks, captions: L.captions }, null, 1));
  console.log('written', b.length);
});
