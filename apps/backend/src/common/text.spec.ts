import { expandQuery, limitPerKey, normalizeText, urlWords } from './text.js';

describe('normalizeText', () => {
  it('treats spelling variants of timetable as one word', () => {
    expect(normalizeText('Exam time table')).toBe('Exam timetable');
    expect(normalizeText('exam TIME-TABLE')).toBe('exam timetable');
    expect(normalizeText('date sheet')).toBe('datesheet');
  });
  it('leaves other text alone', () => {
    expect(normalizeText('B.Tech fees 2026')).toBe('B.Tech fees 2026');
  });
});

describe('urlWords', () => {
  it('turns the path into words', () => {
    expect(urlWords('https://www.ietdavv.edu.in/index.php/examination/exam-time-table/be-iiyr')).toBe(
      'index php examination exam timetable be iiyr',
    );
  });
  it('drops file extensions and survives bad input', () => {
    expect(urlWords('https://x.in/images/timetable/IIyr_CS_A.pdf')).toBe('images timetable IIyr CS A');
    expect(urlWords('not a url')).toBe('');
  });
});

describe('limitPerKey', () => {
  it('keeps order and caps each key', () => {
    const items = ['a1', 'a2', 'b1', 'a3', 'a4', 'b2'];
    expect(limitPerKey(items, (s) => s[0], 2)).toEqual(['a1', 'a2', 'b1', 'b2']);
  });
});

describe('expandQuery', () => {
  it('adds the college wording for years and branches', () => {
    expect(expandQuery('Send me the 2nd year IT timetable')).toBe(
      'Send me the 2nd year IT timetable II Year Information Technology',
    );
    expect(expandQuery('4th year CSE section B')).toContain('IV Year Computer Science Engineering');
  });
  it('leaves ordinary questions alone', () => {
    expect(expandQuery('What is it like to study here?')).toBe('What is it like to study here?');
    expect(expandQuery('What are the B.Tech fees?')).toBe('What are the B.Tech fees?');
  });
});
