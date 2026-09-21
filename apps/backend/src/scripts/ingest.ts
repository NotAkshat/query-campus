import { NestFactory } from '@nestjs/core';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppModule } from '../app.module.js';
import { IngestionService } from '../ingestion/ingestion.service.js';
import { ScrapedDocument } from '../scraper/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Progress {
  nextIndex: number;
  total: number;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ingestion = app.get(IngestionService);

  const dataPath = join(__dirname, '../../data/scraped.json');
  const progressPath = join(__dirname, '../../data/ingest-progress.json');
  const documents: ScrapedDocument[] = JSON.parse(readFileSync(dataPath, 'utf-8'));

  let startIndex = 0;
  if (existsSync(progressPath)) {
    const progress: Progress = JSON.parse(readFileSync(progressPath, 'utf-8'));
    startIndex = progress.nextIndex;
    console.log(`Found checkpoint: resuming from chunk ${startIndex}`);
  }

  console.log(`Ingesting ${documents.length} documents...`);
  await ingestion.ingest(documents, {
    startIndex,
    onBatchComplete: (nextIndex, total) => {
      if (nextIndex >= total) {
        if (existsSync(progressPath)) unlinkSync(progressPath);
      } else {
        writeFileSync(progressPath, JSON.stringify({ nextIndex, total } satisfies Progress));
      }
    },
  });
  console.log('Ingestion complete.');

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
