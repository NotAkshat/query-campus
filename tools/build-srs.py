#!/usr/bin/env python3
"""Build SRS.docx and SRS.pdf from SRS.md.

Requires pandoc (markdown -> docx) and LibreOffice/soffice (docx -> pdf).

    python3 tools/build-srs.py

Layout follows the IEEE/Wiegers SRS template the project was given:

  * a right-aligned cover page under a rule, with no header and no page number;
  * a front-matter page numbered in lower-case roman (ii) carrying the table of
    contents and the revision history;
  * the body restarting at arabic page 1;
  * a running header (title left, "Page N" right) on every page but the cover.

Word styling is applied through a patched pandoc reference document.
"""

from __future__ import annotations

import re
import shutil
import struct
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "SRS.md"
BUILD = ROOT / "build"
DOCX = ROOT / "SRS.docx"
PDF = ROOT / "SRS.pdf"

BODY_FONT = "Times New Roman"
MONO_FONT = "Courier New"
PROJECT = "Query Campus"
RUNNING_HEAD = f"Software Requirements Specification for {PROJECT}"

USABLE_TWIPS = 9638          # A4 width less 2 cm margins on each side
MAX_FIGURE_WIDTH_IN = 6.30   # text width
MAX_FIGURE_HEIGHT_IN = 7.30  # leaves room for the caption and a little text

W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
R_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if proc.returncode != 0:
        sys.exit(f"command failed: {' '.join(cmd)}\n{proc.stdout}\n{proc.stderr}")
    return proc


def require(tool: str) -> str:
    path = shutil.which(tool)
    if not path:
        sys.exit(f"required tool not found on PATH: {tool}")
    return path


# --------------------------------------------------------------------------
# 1. Reference document
# --------------------------------------------------------------------------

HEADER_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr {W_NS} {R_NS}>
  <w:p>
    <w:pPr>
      <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="000000"/></w:pBdr>
      <w:tabs><w:tab w:val="right" w:pos="{USABLE_TWIPS}"/></w:tabs>
      <w:spacing w:after="120"/>
      <w:rPr><w:rFonts w:ascii="{BODY_FONT}" w:hAnsi="{BODY_FONT}"/><w:b/><w:i/><w:sz w:val="18"/></w:rPr>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="{BODY_FONT}" w:hAnsi="{BODY_FONT}"/><w:b/><w:i/><w:sz w:val="18"/></w:rPr>
      <w:t xml:space="preserve">{RUNNING_HEAD}</w:t>
    </w:r>
    <w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:tab/></w:r>
    <w:r>
      <w:rPr><w:rFonts w:ascii="{BODY_FONT}" w:hAnsi="{BODY_FONT}"/><w:b/><w:i/><w:sz w:val="18"/></w:rPr>
      <w:t xml:space="preserve">Page </w:t>
    </w:r>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="{BODY_FONT}" w:hAnsi="{BODY_FONT}"/><w:b/><w:i/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r>
    <w:r><w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:hdr>
"""

BLANK_HEADER_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr {W_NS} {R_NS}><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p></w:hdr>
"""

PAGE_SETUP = """<w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"
               w:header="680" w:footer="680" w:gutter="0"/>"""

# The reference document's own sectPr becomes the LAST section — the body.
BODY_SECT_PR = f"""<w:sectPr>
      <w:headerReference w:type="default" r:id="rIdHdrDefault"/>
      <w:footnotePr><w:numRestart w:val="eachSect"/></w:footnotePr>
      {PAGE_SETUP}
      <w:pgNumType w:fmt="decimal" w:start="1"/>
    </w:sectPr>"""

# Cover: blank header, no visible number, but it still counts as page i.
COVER_SECT_PR = f"""<w:p><w:pPr><w:sectPr>
  <w:headerReference w:type="default" r:id="rIdHdrBlank"/>
  {PAGE_SETUP}
  <w:pgNumType w:fmt="lowerRoman" w:start="1"/>
</w:sectPr></w:pPr></w:p>"""

# Front matter: running header, lower-case roman starting at ii.
FRONT_SECT_PR = f"""<w:p><w:pPr><w:sectPr>
  <w:headerReference w:type="default" r:id="rIdHdrDefault"/>
  {PAGE_SETUP}
  <w:pgNumType w:fmt="lowerRoman" w:start="2"/>
</w:sectPr></w:pPr></w:p>"""

SOURCE_CODE_STYLE = f"""<w:style w:type="paragraph" w:customStyle="1" w:styleId="SourceCode">
    <w:name w:val="Source Code"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepLines/>
      <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="{MONO_FONT}" w:hAnsi="{MONO_FONT}" w:cs="{MONO_FONT}"/>
      <w:noProof/>
      <w:sz w:val="15"/>
      <w:szCs w:val="15"/>
    </w:rPr>
  </w:style>"""

DOC_DEFAULTS = f"""<w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="{BODY_FONT}" w:hAnsi="{BODY_FONT}" w:eastAsia="{BODY_FONT}" w:cs="{BODY_FONT}"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr><w:spacing w:after="120" w:line="259" w:lineRule="auto"/></w:pPr>
    </w:pPrDefault>
  </w:docDefaults>"""

HEADING_SIZES = {"1": 32, "2": 28, "3": 26, "4": 24, "5": 22, "6": 22}


def patch_styles(xml: str) -> str:
    """Serif body, black headings, small monospace, centred figures."""
    if "<w:docDefaults>" in xml:
        xml = re.sub(r"<w:docDefaults>.*?</w:docDefaults>", DOC_DEFAULTS, xml, flags=re.S)
    else:
        xml = re.sub(r"(<w:styles[^>]*>)", r"\1" + DOC_DEFAULTS, xml, count=1)

    def fix_heading(m: re.Match) -> str:
        block, level = m.group(0), m.group(1)
        size = HEADING_SIZES.get(level, 22)
        block = re.sub(r"<w:rFonts[^/]*?/>", f'<w:rFonts w:ascii="{BODY_FONT}" w:hAnsi="{BODY_FONT}" w:cs="{BODY_FONT}"/>', block)
        block = re.sub(r"<w:color[^/]*?/>", '<w:color w:val="000000"/>', block)
        block = re.sub(r'<w:sz w:val="\d+"\s*/>', f'<w:sz w:val="{size}"/>', block)
        block = re.sub(r'<w:szCs w:val="\d+"\s*/>', f'<w:szCs w:val="{size}"/>', block)
        if "<w:b/>" not in block and "<w:rPr>" in block:
            block = block.replace("<w:rPr>", "<w:rPr><w:b/>", 1)
        return block

    xml = re.sub(r'<w:style w:type="paragraph" w:styleId="Heading([1-6])".*?</w:style>',
                 fix_heading, xml, flags=re.S)

    # Inline code: mono, a touch smaller than body text.
    xml = re.sub(r'(<w:style w:type="character" w:customStyle="1" w:styleId="VerbatimChar".*?)<w:sz w:val="\d+"\s*/>',
                 lambda m: m.group(1) + '<w:sz w:val="19"/>', xml, flags=re.S)
    xml = re.sub(r'(<w:style w:type="character" w:customStyle="1" w:styleId="VerbatimChar".*?)<w:rFonts[^/]*?/>',
                 lambda m: m.group(1) + f'<w:rFonts w:ascii="{MONO_FONT}" w:hAnsi="{MONO_FONT}"/>', xml, flags=re.S)

    xml = re.sub(r'(<w:style w:type="paragraph" w:styleId="BodyText".*?)<w:spacing[^/]*?/>',
                 lambda m: m.group(1) + '<w:spacing w:before="60" w:after="120"/>', xml, flags=re.S)

    # Centre figures and their captions.
    for style_id, extra in (("CaptionedFigure", ""), ("Figure", ""),
                            ("ImageCaption", '<w:rPr><w:i/><w:sz w:val="20"/></w:rPr>')):
        pattern = rf'(<w:style w:type="paragraph" w:customStyle="1" w:styleId="{style_id}">.*?<w:pPr>)'
        xml = re.sub(pattern, r'\1<w:jc w:val="center"/><w:keepLines/>', xml, flags=re.S)
        if extra:
            xml = re.sub(rf'(<w:style w:type="paragraph" w:customStyle="1" w:styleId="{style_id}">.*?)</w:style>',
                         lambda m: m.group(1) + extra + "</w:style>", xml, flags=re.S)

    if 'w:styleId="SourceCode"' not in xml:
        xml = xml.replace("</w:styles>", SOURCE_CODE_STYLE + "</w:styles>")
    return xml


def build_reference(dest: Path) -> None:
    raw = subprocess.run([require("pandoc"), "--print-default-data-file", "reference.docx"],
                         capture_output=True, check=True).stdout
    default = BUILD / "pandoc-reference.docx"
    default.write_bytes(raw)

    with zipfile.ZipFile(default) as zin:
        items = {name: zin.read(name) for name in zin.namelist()}

    items["word/styles.xml"] = patch_styles(items["word/styles.xml"].decode("utf-8")).encode("utf-8")

    doc = items["word/document.xml"].decode("utf-8")
    doc = re.sub(r"<w:sectPr>.*?</w:sectPr>", BODY_SECT_PR, doc, flags=re.S)
    items["word/document.xml"] = doc.encode("utf-8")

    items["word/header-default.xml"] = HEADER_XML.encode("utf-8")
    items["word/header-blank.xml"] = BLANK_HEADER_XML.encode("utf-8")

    hdr_type = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header"
    rels = items["word/_rels/document.xml.rels"].decode("utf-8").replace(
        "</Relationships>",
        f'<Relationship Type="{hdr_type}" Id="rIdHdrDefault" Target="header-default.xml"/>'
        f'<Relationship Type="{hdr_type}" Id="rIdHdrBlank" Target="header-blank.xml"/>'
        "</Relationships>")
    items["word/_rels/document.xml.rels"] = rels.encode("utf-8")

    hdr_ct = "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"
    ct = items["[Content_Types].xml"].decode("utf-8").replace(
        "</Types>",
        f'<Override PartName="/word/header-default.xml" ContentType="{hdr_ct}"/>'
        f'<Override PartName="/word/header-blank.xml" ContentType="{hdr_ct}"/>'
        "</Types>")
    items["[Content_Types].xml"] = ct.encode("utf-8")

    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, data in items.items():
            zout.writestr(name, data)


# --------------------------------------------------------------------------
# 2. Markdown preparation
# --------------------------------------------------------------------------

# Word/LibreOffice export monospace runs as WinAnsi, which has no room for the
# U+25xx box-drawing block. Every substitute is single-width, so ASCII art keeps
# its alignment.
DIAGRAM_ASCII = str.maketrans({
    "─": "-", "━": "-", "═": "=", "│": "|", "┃": "|", "║": "|",
    "┌": "+", "┐": "+", "└": "+", "┘": "+", "├": "+", "┤": "+",
    "┬": "+", "┴": "+", "┼": "+", "╔": "+", "╗": "+", "╚": "+", "╝": "+",
    "▶": ">", "◀": "<", "▼": "v", "▲": "^", "←": "<", "→": ">",
    "·": ".", "…": ".", "—": "-", "–": "-",
})


def asciify_diagrams(text: str) -> str:
    out, in_fence = [], False
    for line in text.split("\n"):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            out.append(line)
            continue
        out.append(line.translate(DIAGRAM_ASCII) if in_fence else line)
    return "\n".join(out)


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    w, h = struct.unpack(">II", data[16:24])
    return w, h


def inject_image_widths(text: str) -> str:
    """Scale each figure to the text column without overflowing the page."""
    def fit(m: re.Match) -> str:
        rel = m.group(2)
        path = ROOT / rel
        if not path.exists():
            sys.exit(f"figure not found: {rel}")
        w, h = png_size(path)
        width = min(MAX_FIGURE_WIDTH_IN, MAX_FIGURE_HEIGHT_IN * w / h)
        return f"![{m.group(1)}]({rel}){{width={width:.2f}in}}"

    return re.sub(r"!\[([^\]]*)\]\(([^)]+\.png)\)(?!\{)", fit, text)


def xml_escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def collect_headings(body: str) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    in_code = False
    for line in body.split("\n"):
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        m = re.match(r"^(#{1,2}) +(.*?)\s*$", line)
        if m:
            out.append((len(m.group(1)), re.sub(r"[`*_]", "", m.group(2)).strip()))
    return out


def raw(xml: str) -> str:
    return "\n\n```{=openxml}\n" + xml + "\n```\n\n"


def cover_openxml(authors: list[str], version: str, organisation: str, date: str) -> str:
    """The template's cover: a rule, then a right-aligned title block."""
    def para(text: str, size: int, bold: bool = False, before: int = 0, after: int = 120) -> str:
        rpr = (f'<w:rPr><w:rFonts w:ascii="{BODY_FONT}" w:hAnsi="{BODY_FONT}"/>'
               f'{"<w:b/>" if bold else ""}<w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr>')
        return (f'<w:p><w:pPr><w:jc w:val="right"/>'
                f'<w:spacing w:before="{before}" w:after="{after}"/>{rpr}</w:pPr>'
                f"<w:r>{rpr}<w:t xml:space='preserve'>{xml_escape(text)}</w:t></w:r></w:p>")

    rule = ('<w:p><w:pPr><w:pBdr>'
            '<w:bottom w:val="single" w:sz="24" w:space="1" w:color="000000"/>'
            '</w:pBdr><w:spacing w:before="480" w:after="480"/></w:pPr></w:p>')

    parts = [rule,
             para("Software Requirements", 56, bold=True),
             para("Specification", 56, bold=True, after=360),
             para("for", 32, after=360),
             para(PROJECT, 56, bold=True, after=720),
             para(version, 28, after=480)]
    parts.append(para("Prepared by", 28, after=60))
    parts += [para(a, 28, after=60) for a in authors]
    parts.append(para(organisation, 28, before=360, after=360))
    parts.append(para(date, 28))
    return raw("".join(parts))


def toc_openxml(entries: list[tuple[int, str, str]]) -> str:
    """A dot-leader table of contents; entries are (level, title, page label)."""
    rows = ['<w:p><w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:ascii="{BODY_FONT}" w:hAnsi="{BODY_FONT}"/><w:b/><w:sz w:val="32"/></w:rPr>'
            "<w:t>Table of Contents</w:t></w:r></w:p>"]
    for level, text, page in entries:
        indent = 0 if level == 1 else 360
        bold = "<w:b/>" if level == 1 else ""
        rpr = f'<w:rPr><w:rFonts w:ascii="{BODY_FONT}" w:hAnsi="{BODY_FONT}"/>{bold}<w:sz w:val="21"/></w:rPr>'
        rows.append(
            "<w:p><w:pPr>"
            f'<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="{USABLE_TWIPS}"/></w:tabs>'
            f'<w:spacing w:before="0" w:after="30"/><w:ind w:left="{indent}" w:right="0"/>'
            "</w:pPr>"
            f"<w:r>{rpr}<w:t xml:space='preserve'>{xml_escape(text)}</w:t></w:r>"
            f"<w:r>{rpr}<w:tab/><w:t>{page}</w:t></w:r>"
            "</w:p>")
    return raw("".join(rows))


AUTHORS = ["Akshat Sharma (23bit005, Information Technology)",
           "Tanmay Choudhary (23bcs072, Computer Engineering)",
           "Riya Rawat (23bit060, Information Technology)",
           "Supervisor: Vedpriya Dongre, Department of Computer Engineering"]
ORGANISATION = "Institute of Engineering and Technology, DAVV, Indore"
VERSION = "Version 1.0 approved"
DATE = "20 September 2026"


def split_source(text: str) -> tuple[str, str]:
    """Separate the revision history (front matter) from the body proper."""
    rev_start = text.index("## Revision History")
    body_start = text.index("# 1. Introduction")
    revision = text[rev_start:body_start].replace("## Revision History", "# Revision History", 1)
    revision = revision.rstrip().rstrip("-").rstrip()
    return revision, text[body_start:]


def roman(n: int) -> str:
    numerals = [(10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")]
    out = ""
    for value, sign in numerals:
        while n >= value:
            out += sign
            n -= value
    return out


def prepare_markdown(text: str, pages: dict[str, int] | None,
                     front: dict[str, str] | None = None) -> str:
    revision, body = split_source(text)
    body = inject_image_widths(asciify_diagrams(body))

    front = front or {}
    entries: list[tuple[int, str, str]] = [
        (1, "Table of Contents", front.get("Table of Contents", "ii")),
        (1, "Revision History", front.get("Revision History", "ii")),
    ]
    for level, title in collect_headings(body):
        entries.append((level, title, "00" if pages is None else str(pages.get(title, ""))))

    return ("---\nlang: en\n---\n"
            + cover_openxml(AUTHORS, VERSION, ORGANISATION, DATE)
            + raw(COVER_SECT_PR)
            + toc_openxml(entries)
            + "\n\n" + revision + "\n\n"
            + raw(FRONT_SECT_PR)
            + body)


# --------------------------------------------------------------------------
# 3. docx post-processing
# --------------------------------------------------------------------------

TWIPS_PER_CHAR = 132
CELL_PADDING = 260
MIN_COL_TWIPS = 620
MAX_MIN_TWIPS = 1900
LONGEST_PULL = 0.35


def size_table_columns(match: re.Match) -> str:
    """Give each column a share of the page proportional to its content."""
    tbl = match.group(0)
    rows = re.findall(r"<w:tr>.*?</w:tr>", tbl, flags=re.S)
    if not rows:
        return tbl

    lengths, longest_word = [], []
    for row in rows:
        cells = re.findall(r"<w:tc>.*?</w:tc>", row, flags=re.S)
        texts = ["".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", c)) for c in cells]
        lengths.append([len(t) for t in texts])
        longest_word.append([max((len(w) for w in t.split()), default=1) for t in texts])

    ncols = max(len(r) for r in lengths)
    if ncols == 0:
        return tbl

    weights, floors = [], []
    for i in range(ncols):
        col = [r[i] for r in lengths if i < len(r)] or [1]
        mean, longest = sum(col) / len(col), max(col)
        weights.append(max(1.0, mean + LONGEST_PULL * (longest - mean)))
        word = max((r[i] for r in longest_word if i < len(r)), default=1)
        floors.append(min(MAX_MIN_TWIPS, max(MIN_COL_TWIPS, word * TWIPS_PER_CHAR + CELL_PADDING)))

    total = sum(weights)
    widths = [max(floors[i], round(USABLE_TWIPS * w / total)) for i, w in enumerate(weights)]

    overflow = sum(widths) - USABLE_TWIPS
    while overflow > 0:
        room, i = max((widths[j] - floors[j], j) for j in range(ncols))
        if room <= 0:
            break
        take = min(overflow, room)
        widths[i] -= take
        overflow -= take

    grid = "<w:tblGrid>" + "".join(f'<w:gridCol w:w="{w}" />' for w in widths) + "</w:tblGrid>"
    tbl = re.sub(r"<w:tblGrid>.*?</w:tblGrid>", grid, tbl, flags=re.S)
    tbl = tbl.replace('<w:tblW w:type="pct" w:w="5000" />', f'<w:tblW w:type="dxa" w:w="{sum(widths)}" />')

    counter = {"i": 0}

    def stamp(m: re.Match) -> str:
        w = widths[counter["i"] % ncols]
        counter["i"] += 1
        return re.sub(r"<w:tcW[^/]*/>", f'<w:tcW w:type="dxa" w:w="{w}" />', m.group(0))

    return re.sub(r"<w:tc>.*?</w:tc>", stamp, tbl, flags=re.S)


def postprocess_docx(docx_path: Path) -> None:
    with zipfile.ZipFile(docx_path) as zin:
        items = {name: zin.read(name) for name in zin.namelist()}

    doc = items["word/document.xml"].decode("utf-8")

    # Content-proportional table columns. pandoc derives widths from the number
    # of dashes in the markdown source, and renderer autofit spreads them evenly.
    doc = re.sub(r"<w:tbl>.*?</w:tbl>", size_table_columns, doc, flags=re.S)

    # pandoc wraps code-block runs in the VerbatimChar character style, whose
    # size wins over the SourceCode paragraph style and wraps wide ASCII art.
    doc = re.sub(r'<w:p><w:pPr><w:pStyle w:val="SourceCode" />.*?</w:p>',
                 lambda m: m.group(0).replace('<w:rStyle w:val="VerbatimChar" />', ""),
                 doc, flags=re.S)

    items["word/document.xml"] = doc.encode("utf-8")

    with zipfile.ZipFile(docx_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, data in items.items():
            zout.writestr(name, data)


# --------------------------------------------------------------------------
# 4. Build
# --------------------------------------------------------------------------


def to_docx(pandoc: str, prepared: Path, reference: Path, out: Path) -> None:
    run([pandoc, str(prepared),
         "--from", "markdown+pipe_tables+backtick_code_blocks+raw_attribute+implicit_figures",
         "--to", "docx",
         "--reference-doc", str(reference),
         "--resource-path", str(ROOT),
         "--standalone",
         "--no-highlight",
         "--output", str(out)])
    postprocess_docx(out)


def to_pdf(soffice: str, docx: Path, out: Path) -> None:
    run([soffice, "--headless", "--norestore", "--convert-to", "pdf:writer_pdf_Export",
         "--outdir", str(BUILD), str(docx)])
    produced = BUILD / (docx.stem + ".pdf")
    if not produced.exists():
        sys.exit("LibreOffice did not produce a PDF")
    shutil.move(str(produced), str(out))


def resolve_pages(pdf: Path, headings: list[tuple[int, str]]) -> tuple[dict[str, int], dict[str, str]]:
    """Map each heading to its printed page number.

    Front matter is numbered in roman (the cover is i); the body restarts at
    arabic 1, so a body heading's printed number is its PDF page index less
    the front matter that precedes it.
    """
    text = run([require("pdftotext"), "-layout", str(pdf), "-"]).stdout
    pages = text.split("\f")

    # The revision-history table sits on the last front-matter page.
    front_last = next((i for i, p in enumerate(pages) if "Reason For Changes" in p), 0)
    body_start = front_last + 1
    toc_page = next((i for i, p in enumerate(pages) if "Table of Contents" in p), 1)
    front_labels = {"Table of Contents": roman(toc_page + 1),
                    "Revision History": roman(front_last + 1)}

    def norm(s: str) -> str:
        return re.sub(r"\s+", " ", s).strip()

    resolved, missing = {}, []
    for _, title in headings:
        target = norm(title)
        for i in range(body_start, len(pages)):
            if target in norm(pages[i]):
                resolved[title] = i - body_start + 1
                break
        else:
            missing.append(title)
    if missing:
        print(f"  note: no page found for {len(missing)} heading(s): {missing[:3]}")
    return resolved, front_labels


def main() -> None:
    pandoc = require("pandoc")
    soffice = require("soffice")
    if not SRC.exists():
        sys.exit(f"missing source: {SRC}")

    BUILD.mkdir(exist_ok=True)
    reference = BUILD / "reference.docx"
    build_reference(reference)

    source = SRC.read_text()
    _, body = split_source(source)
    headings = collect_headings(inject_image_widths(asciify_diagrams(body)))
    prepared = BUILD / "srs-build.md"

    # Pass 1 lays the document out with placeholder page numbers so the contents
    # list reaches its final height; pass 2 fills in the real ones. Only digits
    # change between passes, so pagination stays put.
    print("pass 1: laying out to discover page numbers…")
    prepared.write_text(prepare_markdown(source, None), encoding="utf-8")
    to_docx(pandoc, prepared, reference, DOCX)
    to_pdf(soffice, DOCX, PDF)
    pages, front = resolve_pages(PDF, headings)

    print(f"pass 2: writing contents for {len(pages)}/{len(headings)} headings…")
    prepared.write_text(prepare_markdown(source, pages, front), encoding="utf-8")
    to_docx(pandoc, prepared, reference, DOCX)
    to_pdf(soffice, DOCX, PDF)

    print(f"wrote {DOCX.relative_to(ROOT)}  ({DOCX.stat().st_size // 1024} KB)")
    print(f"wrote {PDF.relative_to(ROOT)}  ({PDF.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
