import { NestFactory } from '@nestjs/core';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppModule } from '../app.module.js';
import { TimetableScraperService } from '../scraper/timetable.scraper.js';
import { IngestionService } from '../ingestion/ingestion.service.js';
import { VectorStoreService } from '../vectorstore/vectorstore.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ID_PREFIX = 'tt:';

/**
 * Re-indexes the current class timetables from timetable.ietonline.in. Replaces only this source's
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
    const removed = await app.get(VectorStoreService).deleteByPrefix(ID_PREFIX);
    console.log(`Removed ${removed} previous timetable chunks`);
    await app.get(IngestionService).ingest(documents, { idPrefix: ID_PREFIX });
    console.log('Timetables indexed. Restart the backend (or delete data/keyword-chunks.json) to refresh keyword search.');
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
