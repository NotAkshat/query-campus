import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppModule } from '../app.module.js';
import { ScraperService } from '../scraper/scraper.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const scraper = app.get(ScraperService);
  const config = app.get(ConfigService);

  console.log(`Starting crawl of ${config.get('scrapeBaseUrl')} ...`);
  const documents = await scraper.crawl();

  const outPath = join(__dirname, '../../data/scraped.json');
  writeFileSync(outPath, JSON.stringify(documents, null, 2));
  console.log(`Saved ${documents.length} documents to ${outPath}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
