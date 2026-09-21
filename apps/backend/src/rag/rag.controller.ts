import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { RagService } from './rag.service.js';

class QueryDto {
  question!: string;
}

@Controller('query')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post()
  async query(@Body() body: QueryDto) {
    if (!body?.question || typeof body.question !== 'string' || !body.question.trim()) {
      throw new BadRequestException('question is required');
    }
    return this.ragService.answer(body.question.trim());
  }
}
