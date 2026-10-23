// Helpers that encode the IET DAVV report format rules (Report_Format_BE_April_2026).
const fs = require('fs');
const {
  Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType,
  ImageRun, HeadingLevel, Bookmark, PageReference, TabStopType, LevelFormat, VerticalAlign,
} = require('docx');

const FONT = 'Times New Roman';
const PT = (n) => n * 2; // docx sizes are half-points
const LINE_15 = 360; // 1.5 line spacing
const PARA_GAP = 240; // one blank line between paragraphs
const CONTENT_W = 9026; // A4 with 1" margins, in DXA

/** Splits **bold** and _italic_ markup into runs. */
function runs(text, o = {}) {
  const size = PT(o.size || 12);
  const out = [];
  const re = /(\*\*[^*]+\*\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, size, bold: o.bold, italics: o.italics }));
    const tok = m[0];
    out.push(new TextRun({ text: tok.slice(2, -2), font: FONT, size, bold: true, italics: o.italics }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, size, bold: o.bold, italics: o.italics }));
  return out;
}

/** Body paragraph: TNR 12, justified, 1.5 spacing, blank line after. */
const P = (text, o = {}) =>
  new Paragraph({
    alignment: o.align || AlignmentType.JUSTIFIED,
    spacing: { line: LINE_15, after: o.after ?? PARA_GAP, before: o.before ?? 0 },
    keepNext: o.keepNext,
    indent: o.indent,
    children: runs(text, o),
  });

const bullet = (text, level = 0) =>
  new Paragraph({
    numbering: { reference: 'bullets', level },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: LINE_15, after: 120 },
    children: runs(text),
  });

const numbered = (text, ref = 'steps') =>
  new Paragraph({
    numbering: { reference: ref, level: 0 },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: LINE_15, after: 120 },
    children: runs(text),
  });

// Headings: main (chapter) = 14pt, sub = 13pt. Each carries a bookmark so the TOC can reference its page.
let bmCounter = 0;
const bookmarks = []; // {id, label, level}
function heading(level, text, o = {}) {
  const id = o.bm || `h_${++bmCounter}`;
  bookmarks.push({ id, label: text, level });
  const size = level === 1 ? 14 : 13;
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    pageBreakBefore: !!o.pageBreak,
    keepNext: true,
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE_15, before: level === 1 ? 0 : 120, after: 360 }, // 2-line gap between title and text
    children: [new Bookmark({ id, children: [new TextRun({ text, font: FONT, size: PT(size), bold: true })] })],
  });
}
const H1 = (t, o = {}) => heading(1, t, { pageBreak: true, ...o });
const H2 = (t, o = {}) => heading(2, t, o);
const H3 = (t, o = {}) => heading(3, t, o);

const thin = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

/** Table with TNR 12 text; widths in DXA must sum to <= CONTENT_W. */
function table(widths, header, rows, o = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (txt, i, isHead) => {
    const lines = Array.isArray(txt) ? txt : String(txt).split('\n');
    return new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      verticalAlign: VerticalAlign.TOP,
      shading: isHead ? { fill: 'D9E2F3', type: ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: lines.map(
        (l) =>
          new Paragraph({
            alignment: o.center?.includes(i) ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { line: 276, after: 40 },
            children: runs(l, { bold: isHead, size: o.size || 12 }),
          }),
      ),
    });
  };
  const trs = [];
  if (header) trs.push(new TableRow({ tableHeader: true, cantSplit: true, children: header.map((h, i) => cell(h, i, true)) }));
  rows.forEach((r) => trs.push(new TableRow({ cantSplit: o.cantSplit ?? true, children: r.map((c, i) => cell(c, i, false)) })));
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows: trs });
}

const spacer = (after = PARA_GAP) => new Paragraph({ spacing: { after, line: 240 }, children: [] });

const caption = (text) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE_15, before: 80, after: PARA_GAP },
    children: runs(text, { bold: true }),
  });

/** Reads PNG dimensions from the IHDR chunk. */
function pngSize(path) {
  const b = fs.readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/** Figure scaled to fit maxW x maxH inches (96 px/in) with a caption below. */
function figure(path, text, maxW = 6.2, maxH = 8.2) {
  const { w, h } = pngSize(path);
  const scale = Math.min((maxW * 96) / w, (maxH * 96) / h, 1.6);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(path), transformation: { width: Math.round(w * scale), height: Math.round(h * scale) }, altText: { title: text, description: text, name: text } })],
    }),
    caption(text),
  ];
}

function screenshot(path, text, maxW = 6.0) {
  const b = fs.readFileSync(path);
  // JPEG SOF0/SOF2 marker holds the dimensions.
  let i = 2, w = 800, h = 500;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xc3) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; }
    i += 2 + b.readUInt16BE(i + 2);
  }
  const scale = (maxW * 96) / w;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: 'jpg', data: b, transformation: { width: Math.round(w * scale), height: Math.round(h * scale) }, altText: { title: text, description: text, name: text } })],
    }),
    caption(text),
  ];
}

/** Front-matter paragraph at a fixed size (14pt on certificate pages), double-spaced between paragraphs. */
const FP = (text, o = {}) =>
  new Paragraph({
    alignment: o.align || AlignmentType.JUSTIFIED,
    spacing: { line: o.line || 420, after: o.after ?? 240, before: o.before ?? 0 },
    indent: o.indent,
    keepNext: o.keepNext,
    children: runs(text, { size: o.size || 14, bold: o.bold }),
  });

const FH = (text, o = {}) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: o.after ?? 360, before: o.before ?? 0 },
    pageBreakBefore: o.pageBreak ?? true,
    children: [o.bm ? new Bookmark({ id: o.bm, children: [new TextRun({ text, font: FONT, size: PT(20), bold: true })] }) : new TextRun({ text, font: FONT, size: PT(20), bold: true })],
  });

/** TOC row with a dot leader to the page number of a bookmark (or literal text). */
function tocRow(label, target, o = {}) {
  const size = PT(o.size || 14);
  const kids = [new TextRun({ text: label, font: FONT, size, bold: o.bold }), new TextRun({ text: '\t', font: FONT, size })];
  if (o.literal !== undefined) kids.push(new TextRun({ text: String(o.literal), font: FONT, size, bold: o.bold }));
  else kids.push(new PageReference(target));
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: 'dot' }],
    spacing: { line: 300, after: o.after ?? 60 },
    indent: { left: o.indent || 0 },
    children: kids,
  });
}

const numberingConfig = {
  config: [
    {
      reference: 'bullets',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1260, hanging: 360 } } } },
      ],
    },
    ...Array.from({ length: 40 }, (_, k) => ({
      reference: k === 0 ? 'steps' : `steps${k}`,
      levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
    })),
  ],
};

const LAND = (children) => ({ __land: children });

/** Two figures side by side at a fixed height (inches), with one caption below. */
function twoFigures(p1, p2, heightIn, text) {
  const { TableCell: TC, TableRow: TR, Table: TB } = require('docx');
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const nb = { top: none, bottom: none, left: none, right: none };
  const cell = (p) => {
    const { w, h } = pngSize(p);
    const sc = (heightIn * 96) / h;
    return new TC({ borders: nb, width: { size: 4513, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: fs.readFileSync(p), transformation: { width: Math.round(w * sc), height: Math.round(h * sc) }, altText: { title: text, description: text, name: text } })] })] });
  };
  return [new TB({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [4513, 4513], rows: [new TR({ cantSplit: true, children: [cell(p1), cell(p2)] })] }), caption(text)];
}

module.exports = { LAND, twoFigures,
  FONT, PT, P, bullet, numbered, H1, H2, H3, table, spacer, caption, figure, screenshot, FP, FH, tocRow,
  numberingConfig, bookmarks, runs, CONTENT_W, LINE_15, PARA_GAP,
};
