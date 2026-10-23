import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { ScrapedDocument } from './types.js';

const USER_AGENT = 'QueryCampusBot/0.1 (+https://github.com/query-campus; educational RAG project)';
const SKIP_EXTENSIONS = /\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|zip|rar|mp4|mp3)$/i;

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private readonly config: ConfigService) {}

  async crawl(): Promise<ScrapedDocument[]> {
    const baseUrl = this.config.get<string>('scrapeBaseUrl')!;
    const maxPages = this.config.get<number>('scrapeMaxPages')!;
    const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '');

    const visited = new Set<string>();
    const queue: string[] = [baseUrl];
    const documents: ScrapedDocument[] = [];
    const limit = pLimit(4);

    while (queue.length > 0 && visited.size < maxPages) {
      const batch = queue.splice(0, Math.min(4, queue.length));
      const results = await Promise.all(
        batch.map((url) =>
          limit(async () => {
            const normalized = this.normalizeUrl(url);
            if (visited.has(normalized)) return null;
            visited.add(normalized);
            return this.fetchOne(normalized, baseHost);
          }),
        ),
      );

      for (const result of results) {
        if (!result) continue;
        const { doc, links } = result;
        if (doc) documents.push(doc);
        for (const link of links) {
          const normalized = this.normalizeUrl(link);
          if (!visited.has(normalized) && !queue.includes(normalized)) {
            queue.push(normalized);
          }
        }
      }
      this.logger.log(`Crawled ${visited.size} pages, ${documents.length} documents, ${queue.length} queued`);
    }

    return documents;
  }

  private normalizeUrl(url: string): string {
    const u = new URL(url);
    u.hash = '';
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  }

  private isSameSite(url: string, baseHost: string): boolean {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return host === baseHost;
    } catch {
      return false;
    }
  }

  private async fetchOne(
    url: string,
    baseHost: string,
  ): Promise<{ doc: ScrapedDocument | null; links: string[] }> {
    try {
      if (url.toLowerCase().endsWith('.pdf')) {
        const doc = await this.fetchPdf(url);
        return { doc, links: [] };
      }

      const res = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000,
        maxContentLength: 10 * 1024 * 1024,
        validateStatus: (s) => s < 400,
      });

      const contentType = String(res.headers['content-type'] ?? '');
      if (!contentType.includes('text/html')) {
        return { doc: null, links: [] };
      }

      const $ = cheerio.load(res.data);

      const links: string[] = [];
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
        if (SKIP_EXTENSIONS.test(href)) return;
        try {
          const abs = new URL(href, url).toString();
          if (this.isSameSite(abs, baseHost)) links.push(abs);
        } catch {
          // ignore malformed URLs
        }
      });

      $(
        'script, style, nav, footer, noscript, #sp-menu, #sp-header, #sp-footer, #sp-footer1, #sp-footer2, .offcanvas-menu, #sp-search',
      ).remove();

      const title = $('title').first().text().trim() || url;
      const main = $('#sp-component');
      const content = (main.length ? main.text() : $('body').text()).replace(/\s+/g, ' ').trim();

      const doc: ScrapedDocument | null = content.length > 50 ? { url, title, content, type: 'html' } : null;
      return { doc, links };
    } catch (err) {
      this.logger.warn(`Failed to fetch ${url}: ${(err as Error).message}`);
      return { doc: null, links: [] };
    }
  }

  private async fetchPdf(url: string): Promise<ScrapedDocument | null> {
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        responseType: 'arraybuffer',
        timeout: 20000,
        maxContentLength: 20 * 1024 * 1024,
      });
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(res.data) });
      const parsed = await parser.getText();
      await parser.destroy();
      // pdf-parse adds page markers like "-- 1 of 4 --"; they are noise for search.
      const content = parsed.text.replace(/--\s*\d+\s+of\s+\d+\s*--/g, ' ').replace(/\s+/g, ' ').trim();
      if (content.length < 50) return null;
      return { url, title: url.split('/').pop() ?? url, content, type: 'pdf' };
    } catch (err) {
      this.logger.warn(`Failed to fetch PDF ${url}: ${(err as Error).message}`);
      return null;
    }
  }
}
