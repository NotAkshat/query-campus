import { createHash } from 'crypto';
import { ScrapedDocument } from '../scraper/types.js';

export interface Chunk {
  id: string;
  text: string;
  url: string;
  title: string;
  type: 'html' | 'pdf';
}

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

export function chunkDocument(doc: ScrapedDocument): Chunk[] {
  const chunks: Chunk[] = [];
  const text = doc.content;

  let start = 0;
  let index = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const slice = text.slice(start, end).trim();

    if (slice.length > 0) {
      const id = createHash('sha1').update(`${doc.url}#${index}`).digest('hex');
      chunks.push({ id, text: slice, url: doc.url, title: doc.title, type: doc.type });
      index += 1;
    }

    if (end >= text.length) break;
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}
