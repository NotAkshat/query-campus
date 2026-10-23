import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedDocument } from './types.js';

const USER_AGENT = 'QueryCampusBot/0.1 (+https://github.com/query-campus; educational RAG project)';
export const TIMETABLE_SITE = 'https://timetable.ietonline.in';

interface Slot {
  day: string;
  time: string;
  subject: string;
  kind?: string; // T = theory, Rem = remedial, lab, etc.
  faculty: string;
  room?: string;
  batch?: string;
}

interface ClassTimetable {
  program: string;
  branch: string;
  year: string;
  section: string;
  room: string;
  coordinator: string;
  session: string;
  semester: string;
  pdfUrl: string;
  slots: Slot[];
  subjects: Map<string, string>; // code -> subject name, from the printable view
}

/**
 * Current class timetables live on a separate public site (timetable.ietonline.in, linked from the
 * college homepage), not as PDFs on the main site. Its filter form is a plain GET, so each program's
 * timetables can be fetched and parsed into one document per class plus one per faculty member.
 */
@Injectable()
export class TimetableScraperService {
  private readonly logger = new Logger(TimetableScraperService.name);

  async scrape(): Promise<ScrapedDocument[]> {
    const home = cheerio.load(await this.get('/'));
    const sessions = home('select[name="session"] option')
      .map((_, el) => home(el).attr('value'))
      .get()
      .filter(Boolean);
    const session = sessions.sort().at(-1);
    if (!session) throw new Error('No session found on the timetable site');

    // Programs per semester are embedded in the page as PUBLIC_COURSE_BRANCHES.
    const mapping = home.html().match(/PUBLIC_COURSE_BRANCHES=(\{.*?\});/)?.[1];
    const programsBySemester: Record<string, Record<string, string[]>> = mapping ? JSON.parse(mapping) : {};

    const classes: ClassTimetable[] = [];
    for (const [semester, programs] of Object.entries(programsBySemester)) {
      for (const program of Object.keys(programs)) {
        const html = await this.get('/', { session, semester, course: program });
        const parsed = this.parseTimetables(html, semester);
        for (const c of parsed) c.subjects = await this.subjectNames(c.pdfUrl);
        this.logger.log(`${session} ${semester} ${program}: ${parsed.length} timetables`);
        classes.push(...parsed);
      }
    }

    return [...classes.map(classDocument), ...facultyDocuments(classes)];
  }

  private async get(path: string, params?: Record<string, string>): Promise<string> {
    const res = await axios.get(TIMETABLE_SITE + path, {
      params,
      headers: { 'User-Agent': USER_AGENT },
      timeout: 120_000,
      maxContentLength: 100 * 1024 * 1024,
    });
    return res.data;
  }

  private parseTimetables(html: string, semester: string): ClassTimetable[] {
    // Pages embed faculty photos as base64; dropping them shrinks the HTML ~30x before parsing.
    const $ = cheerio.load(html.replace(/data:[a-z]+\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+/g, ''));
    const out: ClassTimetable[] = [];
    let program = '';
    let branch = '';

    $('.course-heading, .branch-heading, .tt-card').each((_, el) => {
      const node = $(el);
      if (node.hasClass('course-heading')) {
        program = node.find('.course-label').text().trim();
        return;
      }
      if (node.hasClass('branch-heading')) {
        branch = node.find('.branch-label').text().trim();
        return;
      }

      const chip = (icon: string) => node.find(`.tt-meta-chip:has(i.${icon})`).first().text().trim();
      const pdfHref = node.find('a.btn-view-pdf').attr('href');
      // Placeholder cards have no class details; indexing them would add empty documents.
      if (!chip('bi-mortarboard-fill') && !pdfHref) return;
      out.push({
        program,
        branch,
        year: chip('bi-mortarboard-fill'),
        section: chip('bi-people-fill').replace(/^(Sec(tion)?\s*)+/i, ''), // site renders "Sec Section A"
        room: chip('bi-door-open-fill').replace(/^Room\s*/i, ''),
        coordinator: chip('bi-person-fill'),
        session: node.find('.tt-meta-chip.session').text().replace(/\s+/g, ' ').trim(),
        semester,
        pdfUrl: pdfHref ? new URL(pdfHref, TIMETABLE_SITE).toString() : TIMETABLE_SITE,
        slots: this.parseGrid($, node.find('table.tt-grid').first()),
        subjects: new Map(),
      });
    });
    return out;
  }

  /** Reads the "Reference table (assigned subjects)" on a class's printable page: code -> subject name. */
  private async subjectNames(pdfUrl: string): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    try {
      const $ = cheerio.load(await this.get(new URL(pdfUrl).pathname + new URL(pdfUrl).search));
      $('table').each((_, table) => {
        const header = $(table).find('tr').first().text().toUpperCase();
        if (!header.includes('SUBJECT CODE') || !header.includes('SUBJECT NAME')) return;
        $(table)
          .find('tr')
          .slice(1)
          .each((_, tr) => {
            const cells = $(tr).children('td');
            const code = cells.eq(0).text().trim();
            const name = cells.eq(1).text().replace(/\s+/g, ' ').trim();
            if (code && name) names.set(code, name);
          });
      });
    } catch (err) {
      this.logger.warn(`Could not read subject names from ${pdfUrl}: ${(err as Error).message}`);
    }
    return names;
  }

  private parseGrid($: cheerio.CheerioAPI, table: ReturnType<cheerio.CheerioAPI>): Slot[] {
    if (!table.length) return [];
    const times = table
      .find('thead th')
      .slice(1)
      .map((_, th) => $(th).text().trim())
      .get();
    const slots: Slot[] = [];

    table
      .find('tbody tr')
      .each((_, tr) => {
        const cells = $(tr).children('td');
        const day = cells.first().text().trim();
        let col = 0;
        cells.slice(1).each((_, td) => {
          const span = Number($(td).attr('colspan') ?? 1);
          const time = span > 1 ? `${times[col]?.split('-')[0]}-${times[col + span - 1]?.split('-')[1]}` : times[col];
          col += span;

          // Labs: "Room/Subject/Faculty/Batch", possibly several batches in one cell
          $(td)
            .find('.lab-code')
            .each((_, lab) => {
              const [room, subject, faculty, batch] = $(lab).text().trim().split('/');
              for (const name of splitNames(faculty)) slots.push({ day, time, subject, kind: 'Lab', faculty: name, room, batch });
            });

          const code = $(td).find('.sub-code');
          const faculty = splitNames($(td).find('.sub-fac').text());
          if (code.length && faculty.length) {
            const kind = code.find('small').text().replace(/[()]/g, '').trim() || undefined;
            code.find('small').remove();
            for (const name of faculty) slots.push({ day, time, subject: code.text().trim(), kind, faculty: name });
          }
        });
      });
    return slots;
  }
}

/** Shared slots list several teachers ("A, B"); each gets their own entry. */
function splitNames(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((n) => n.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** "7CERC3 (Compiler Design)" when the name is known. */
function subjectLabel(c: ClassTimetable, code: string): string {
  const name = c.subjects.get(code);
  return name ? `${code} (${name})` : code;
}

function className(c: ClassTimetable): string {
  const section = c.section && c.section !== 'NA' ? ` Section ${c.section}` : '';
  return `${c.program} ${c.branch} ${c.year}${section}`;
}

function describeSlot(c: ClassTimetable, s: Slot): string {
  const kind = s.kind === 'T' ? 'lecture' : s.kind === 'Rem' ? 'remedial' : s.kind === 'Lab' ? 'lab' : (s.kind ?? 'class');
  const where = [s.room && `room ${s.room}`, s.batch && `batch ${s.batch}`].filter(Boolean).join(', ');
  return `${s.time} ${subjectLabel(c, s.subject)} ${kind} by ${s.faculty}${where ? ` [${where}]` : ''}`;
}

function classDocument(c: ClassTimetable): ScrapedDocument {
  const faculty = new Map<string, Set<string>>();
  for (const s of c.slots) {
    if (!faculty.has(s.faculty)) faculty.set(s.faculty, new Set());
    faculty.get(s.faculty)!.add(s.subject);
  }

  const days = [...new Set(c.slots.map((s) => s.day))].map(
    (day) =>
      `${day}: ${c.slots
        .filter((s) => s.day === day)
        .map((s) => describeSlot(c, s))
        .join('; ')}.`,
  );

  const content = [
    `Class timetable for ${className(c)}, ${c.semester} semester, session ${c.session}.`,
    `Program: ${c.program}. Branch: ${c.branch}. Year: ${c.year}. Section: ${c.section || 'NA'}. Classroom: ${c.room || 'not listed'}. Class coordinator: ${c.coordinator || 'not listed'}.`,
    `Faculty teaching this class: ${[...faculty].map(([name, subjects]) => `${name}: ${[...subjects].map((code) => subjectLabel(c, code)).join(', ')}`).join('; ')}.`,
    ...days,
  ].join('\n');

  return { url: c.pdfUrl, title: `Timetable ${c.session}: ${className(c)}`, content, type: 'html' };
}

/** One document per faculty member listing everything they teach, so "what does X teach?" hits one chunk. */
function facultyDocuments(classes: ClassTimetable[]): ScrapedDocument[] {
  const byFaculty = new Map<
    string,
    { teaches: Map<string, { cls: ClassTimetable; slots: Slot[] }>; coordinates: string[]; session: string }
  >();
  const entry = (name: string, session: string) => {
    if (!byFaculty.has(name)) byFaculty.set(name, { teaches: new Map(), coordinates: [], session });
    return byFaculty.get(name)!;
  };

  for (const c of classes) {
    if (c.coordinator) entry(c.coordinator, c.session).coordinates.push(className(c));
    for (const s of c.slots) {
      const teaches = entry(s.faculty, c.session).teaches;
      const key = className(c);
      if (!teaches.has(key)) teaches.set(key, { cls: c, slots: [] });
      teaches.get(key)!.slots.push(s);
    }
  }

  return [...byFaculty].map(([name, { teaches, coordinates, session }]) => {
    const lines = [...teaches].map(([label, { cls, slots }]) => {
      const subjects = [...new Set(slots.map((s) => s.subject))].map((code) => subjectLabel(cls, code)).join(', ');
      const when = slots.map((s) => `${s.day} ${s.time}${s.kind === 'Lab' ? ' (lab)' : ''}`).join(', ');
      return `- ${label}: ${subjects}. Schedule: ${when}.`;
    });
    const content = [
      `Teaching schedule of ${name} for session ${session}, from the official IET DAVV timetables.`,
      teaches.size
        ? `${name} teaches ${teaches.size} class${teaches.size === 1 ? '' : 'es'}:\n${lines.join('\n')}`
        : `${name} has no teaching slots listed.`,
      coordinates.length ? `${name} is class coordinator of: ${coordinates.join('; ')}.` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return {
      url: `${TIMETABLE_SITE}/#faculty-${slug}`,
      title: `Faculty teaching schedule ${session}: ${name}`,
      content,
      type: 'html',
    };
  });
}
