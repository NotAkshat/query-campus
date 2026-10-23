/**
 * Makes spelling variants match, so "exam time table", "exam time-table" and "exam timetable" are the
 * same word to the keyword search (it is applied to both the indexed text and the question).
 */
export function normalizeText(text: string): string {
  return text.replace(/time[\s-]+table/gi, 'timetable').replace(/date[\s-]+sheet/gi, 'datesheet');
}

/** Words in a URL path ("/examination/exam-time-table/be-iiyr" -> "examination exam time table be iiyr"). */
export function urlWords(url: string): string {
  try {
    return normalizeText(decodeURIComponent(new URL(url).pathname).replace(/\.[a-z0-9]+$/i, '').replace(/[/_.-]+/g, ' ').trim());
  } catch {
    return '';
  }
}

/** Keeps the order of `items` but allows at most `max` per key, so one long document cannot fill the context. */
export function limitPerKey<T>(items: T[], key: (item: T) => string, max: number): T[] {
  const seen = new Map<string, number>();
  return items.filter((item) => {
    const k = key(item);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n <= max;
  });
}

const YEARS: [RegExp, string][] = [
  [/\b(1st|first)\s+year\b/i, 'I Year'],
  [/\b(2nd|second)\s+year\b/i, 'II Year'],
  [/\b(3rd|third)\s+year\b/i, 'III Year'],
  [/\b(4th|fourth|final)\s+year\b/i, 'IV Year'],
];
const BRANCHES: [RegExp, string][] = [
  [/\bit\b/i, 'Information Technology'],
  [/\b(cse|cs)\b/i, 'Computer Science Engineering'],
  [/\b(ece|etc|e&tc)\b/i, 'Electronics Telecommunication'],
  [/\bei\b/i, 'Electronics Instrumentation'],
  [/\bmech\b/i, 'Mechanical Engineering'],
];

/**
 * Adds the wording the college uses to class-related questions ("2nd year IT" -> "II Year Information
 * Technology"), so the keyword search finds timetables written that way. The original question is kept.
 */
export function expandQuery(query: string): string {
  const extra: string[] = [];
  for (const [re, text] of YEARS) if (re.test(query)) extra.push(text);
  // Short abbreviations are only expanded when the question is about a class, so "it" stays a normal word.
  if (extra.length > 0 || /\b(year|section|timetable|time table)\b/i.test(query)) {
    for (const [re, text] of BRANCHES) if (re.test(query)) extra.push(text);
  }
  return extra.length > 0 ? `${query} ${extra.join(' ')}` : query;
}
