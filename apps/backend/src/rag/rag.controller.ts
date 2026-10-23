import { Body, Controller, Post, BadRequestException, HttpException, Logger, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RagService } from './rag.service.js';

const MAX_QUESTION_LENGTH = 500;

class QueryDto {
  question!: string;
}

function parseQuestion(body: QueryDto): string {
  if (!body?.question || typeof body.question !== 'string' || !body.question.trim()) {
    throw new BadRequestException('question is required');
  }
  const question = body.question.trim();
  if (question.length > MAX_QUESTION_LENGTH) throw new BadRequestException('question is too long');
  return question;
}

@Controller('query')
export class RagController {
  private readonly logger = new Logger(RagController.name);

  constructor(private readonly ragService: RagService) {}

  @Post()
  async query(@Body() body: QueryDto) {
    return this.ragService.answer(parseQuestion(body));
  }

  /**
   * Same answer as POST /query, streamed as server-sent events: "delta" events carry text as it is
   * generated, then one "done" event carries the cleaned answer, sources and attachments.
   */
  @Post('stream')
  async stream(@Body() body: QueryDto, @Res() res: Response) {
    const question = parseQuestion(body);
    const abort = new AbortController();
    res.on('close', () => abort.abort()); // client went away: stop generating

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      for await (const event of this.ragService.stream(question, abort.signal)) {
        if (event.type === 'delta') send('delta', { text: event.text });
        else send('done', { answer: event.answer, sources: event.sources, attachments: event.attachments });
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        // HttpExceptions (e.g. "Backend is not configured") carry a message meant for the user.
        this.logger.error(`Streamed answer failed: ${(err as Error).message}`);
        const message =
          err instanceof HttpException ? err.message : 'Something went wrong while answering. Please try again.';
        send('error', { message });
      }
    } finally {
      res.end();
    }
  }
}
