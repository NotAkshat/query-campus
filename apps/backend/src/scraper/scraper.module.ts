import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service.js';
import { TimetableScraperService } from './timetable.scraper.js';

@Module({
  providers: [ScraperService, TimetableScraperService],
  exports: [ScraperService, TimetableScraperService],
})
export class ScraperModule {}
