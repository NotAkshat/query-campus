import { chunkDocument } from './chunker.js';

const doc = (content: string) => ({ url: 'https://x.in/a', title: 'A', content, type: 'html' as const });

describe('chunkDocument', () => {
  it('makes one chunk for short text', () => {
    expect(chunkDocument(doc('hello world'))).toHaveLength(1);
  });
  it('overlaps neighbouring chunks by 200 characters', () => {
    const text = 'x'.repeat(3000);
    const chunks = chunkDocument(doc(text));
    // windows start at 0, 1300 and 2600 (each 200 characters before the previous end)
    expect(chunks.map((c) => c.text.length)).toEqual([1500, 1500, 400]);
  });
  it('gives stable, prefixed ids', () => {
    const [a] = chunkDocument(doc('same text'), 'tt:');
    const [b] = chunkDocument(doc('same text'), 'tt:');
    expect(a.id).toBe(b.id);
    expect(a.id.startsWith('tt:')).toBe(true);
  });
  it('skips documents with no text', () => {
    expect(chunkDocument(doc('   '))).toHaveLength(0);
  });
});
