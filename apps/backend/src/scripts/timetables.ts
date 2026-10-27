import { NestFactory } from '@nestjs/core';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppModule } from '../app.module.js';
import { TimetableScraperService } from '../scraper/timetable.scraper.js';
import { IngestionService } from '../ingestion/ingestion.service.js';
import { VectorStoreService } from '../vectorstore/vectorstore.service.js';
import { chunkDocument } from '../ingestion/chunker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ID_PREFIX = 'tt:';

/**
 * Re-indexes the current class timetables from the timetable portal. Replaces only this source's
 * chunks (ids prefixed "tt:"); the rest of the index is untouched. Pass --dry-run to just scrape.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const documents = await app.get(TimetableScraperService).scrape();

  const outPath = join(__dirname, '../../data/timetables.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(documents, null, 2));
  console.log(`Scraped ${documents.length} timetable documents -> ${outPath}`);

  if (!process.argv.includes('--dry-run')) {
    // Add the new chunks first and remove the old ones afterwards, so the live site never loses its
    // timetables while this runs (it can take a while on the free embedding plan).
    const keep = new Set(documents.flatMap((d) => chunkDocument(d, ID_PREFIX).map((c) => c.id)));
    await app.get(IngestionService).ingest(documents, { idPrefix: ID_PREFIX, skipExisting: true });
    const vectorStore = app.get(VectorStoreService);
    const stale = (await vectorStore.listIds(ID_PREFIX)).filter((id) => !keep.has(id));
    const removed = await vectorStore.deleteIds(stale);
    console.log(`Removed ${removed} old timetable chunks`);
    console.log('Timetables indexed. The running backend picks them up within ten minutes (or after a restart).');
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
