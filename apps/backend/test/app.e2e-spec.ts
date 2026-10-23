import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  describe('POST /query validation', () => {
    const post = (body: unknown) => request(app.getHttpServer()).post('/query').send(body as object);

    it('rejects a missing question', () => post({}).expect(400));
    it('rejects a blank question', () => post({ question: '   ' }).expect(400));
    it('rejects a question that is not text', () => post({ question: 42 }).expect(400));
    it('rejects a very long question', () => post({ question: 'a'.repeat(501) }).expect(400));
    it('rejects blank questions on the stream route too', () =>
      request(app.getHttpServer()).post('/query/stream').send({ question: '' }).expect(400));
  });

  describe('GET /documents/download validation', () => {
    const get = (url?: string) => request(app.getHttpServer()).get('/documents/download').query(url ? { url } : {});

    it('rejects a missing url', () => get().expect(400));
    it('rejects a malformed url', () => get('notaurl').expect(400));
    it('rejects a PDF from another website', () => get('https://example.com/a.pdf').expect(400));
    it('rejects a non-PDF page on the college site', () => get('https://www.ietdavv.edu.in/index.php/results').expect(400));
  });

  afterEach(async () => {
    await app.close();
  });
});
