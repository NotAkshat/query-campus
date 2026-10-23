import { BadRequestException, Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Response } from 'express';

/**
 * Serves a college PDF as a download. Browsers ignore <a download> on cross-origin links, so the
 * file is proxied through here. Only PDFs on the scraped college site are allowed (not an open proxy).
 */
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly config: ConfigService) {}

  @Get('download')
  async download(@Query('url') url: string, @Res() res: Response) {
    const target = this.validate(url);
    const filename = decodeURIComponent(target.pathname.split('/').pop() || 'document.pdf');

    try {
      const upstream = await axios.get(target.toString(), {
        responseType: 'stream',
        timeout: 30_000,
        maxContentLength: 50 * 1024 * 1024,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/["\\\r\n]/g, '_')}"`);
      if (upstream.headers['content-length']) res.setHeader('Content-Length', String(upstream.headers['content-length']));
      upstream.data.pipe(res);
    } catch (err) {
      this.logger.warn(`Download failed for ${target}: ${(err as Error).message}`);
      res.status(502).json({ message: 'Could not fetch that document from the college website.' });
    }
  }

  private validate(url: string | undefined): URL {
    let target: URL;
    try {
      target = new URL(url ?? '');
    } catch {
      throw new BadRequestException('url must be a valid URL');
    }
    const siteHost = new URL(this.config.get<string>('scrapeBaseUrl')!).hostname.replace(/^www\./, '');
    const host = target.hostname.replace(/^www\./, '');
    if (!['http:', 'https:'].includes(target.protocol) || host !== siteHost || !target.pathname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Only PDF documents from the college website can be downloaded');
    }
    return target;
  }
}
