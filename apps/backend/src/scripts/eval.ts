import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppModule } from '../app.module.js';
import { RagService, type RagSource } from '../rag/rag.service.js';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { KeywordSearchService } from '../rag/keyword-search.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_PATH = join(__dirname, '../../eval/cases.json');
const DATA_DIR = join(__dirname, '../../data');
const RESULTS_DIR = join(DATA_DIR, 'eval-results');
const EMBED_CACHE_PATH = join(DATA_DIR, 'eval-embeddings.json');
// Voyage free tier: 3 requests/min. Only uncached questions wait.
const VOYAGE_SPACING_MS = 21_000;

/** A string must appear; an array means any one of its entries must appear. */
type Needle = string | string[];

interface EvalCase {
  id: string;
  question: string;
  expect: {
    retrieval?: string[];
    answer?: { all?: Needle[]; none?: string[] };
    attachments?: 'none' | string[][];
    sources?: 'none';
  };
}

interface CaseResult {
  id: string;
  question: string;
  pass: boolean;
  retrieval?: { hit: boolean; rank: number | null };
  answer?: { pass: boolean; failures: string[] };
  attachments?: { pass: boolean; failures: string[] };
  latencyMs?: number;
  answerText?: string;
  error?: string;
}

interface Report {
  mode: 'full' | 'retrieval-only';
  ranAt: string;
  model: string;
  results: CaseResult[];
}

const includes = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());
const describe = (n: Needle) => (Array.isArray(n) ? n.map((x) => `"${x}"`).join(' or ') : `"${n}"`);

function checkAnswer(text: string, expect: NonNullable<EvalCase['expect']['answer']>) {
  const failures: string[] = [];
  for (const needle of expect.all ?? []) {
    const options = Array.isArray(needle) ? needle : [needle];
    if (!options.some((o) => includes(text, o))) failures.push(`missing ${describe(needle)}`);
  }
  for (const banned of expect.none ?? []) {
    if (includes(text, banned)) failures.push(`contains "${banned}"`);
  }
  return { pass: failures.length === 0, failures };
}

function checkAttachments(attachments: RagSource[], sources: RagSource[], expect: EvalCase['expect']) {
  const failures: string[] = [];
  if (expect.attachments === 'none' && attachments.length > 0) {
    failures.push(`unexpected attachment: ${attachments.map((a) => a.title).join(', ')}`);
  } else if (Array.isArray(expect.attachments)) {
    for (const group of expect.attachments) {
      const found = attachments.some((a) => group.some((g) => includes(a.title, g) || includes(a.url, g)));
      if (!found) failures.push(`not attached: ${describe(group)}`);
    }
  }
  if (expect.sources === 'none' && sources.length > 0) {
    failures.push(`unexpected sources: ${sources.map((s) => s.title).join(', ')}`);
  }
  return { pass: failures.length === 0, failures };
}

/** Persists question embeddings across runs and paces uncached Voyage calls. */
function cacheEmbeddings(embeddings: EmbeddingsService, model: string) {
  const cache: Record<string, number[]> = existsSync(EMBED_CACHE_PATH)
    ? JSON.parse(readFileSync(EMBED_CACHE_PATH, 'utf-8'))
    : {};
  const original = embeddings.embedOne.bind(embeddings);
  let lastCall = 0;
  let hits = 0;
  let misses = 0;

  embeddings.embedOne = async (text, inputType) => {
    const key = `${model}:${inputType}:${text.trim().toLowerCase()}`;
    if (cache[key]) {
      hits++;
      return cache[key];
    }
    const wait = lastCall + VOYAGE_SPACING_MS - Date.now();
    if (lastCall && wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    misses++;
    cache[key] = await original(text, inputType);
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(EMBED_CACHE_PATH, JSON.stringify(cache));
    return cache[key];
  };
  return () => ({ hits, misses });
}

function row(r: CaseResult): string {
  const mark = (ok: boolean | undefined) => (ok === undefined ? '·' : ok ? '✓' : '✗');
  const rank = r.retrieval ? (r.retrieval.rank ? `@${r.retrieval.rank}`.padEnd(3) : '   ') : '   ';
  const secs = r.latencyMs !== undefined ? `${(r.latencyMs / 1000).toFixed(1)}s`.padStart(6) : '      ';
  const line = `${r.pass ? 'PASS' : 'FAIL'}  R ${mark(r.retrieval?.hit)} ${rank} A ${mark(r.answer?.pass)}  D ${mark(r.attachments?.pass)} ${secs}  ${r.id}`;
  const why = [
    ...(r.error ? [`error: ${r.error}`] : []),
    ...(r.retrieval && !r.retrieval.hit ? ['expected page not in the retrieved context'] : []),
    ...(r.answer?.failures ?? []),
    ...(r.attachments?.failures ?? []),
  ];
  return why.length ? `${line}\n${why.map((w) => `        - ${w}`).join('\n')}` : line;
}

const pct = (n: number, d: number) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : '-');

async function main() {
  const retrievalOnly = process.argv.includes('--retrieval-only');
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : undefined;

  const { cases }: { cases: EvalCase[] } = JSON.parse(readFileSync(CASES_PATH, 'utf-8'));
  const selected = only ? cases.filter((c) => c.id.includes(only) || includes(c.question, only)) : cases;
  if (selected.length === 0) throw new Error(`No cases match "${only}"`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const config = app.get(ConfigService);
  const rag = app.get(RagService);
  await app.get(KeywordSearchService).whenReady(); // otherwise the first cases would run without keyword search
  const embedStats = cacheEmbeddings(app.get(EmbeddingsService), config.get<string>('voyageModel')!);
  const mode: Report['mode'] = retrievalOnly ? 'retrieval-only' : 'full';

  console.log(`Running ${selected.length} eval case(s), ${mode}${retrievalOnly ? '' : `, model ${config.get('geminiModel')}`}\n`);
  const results: CaseResult[] = [];

  for (const c of selected) {
    const result: CaseResult = { id: c.id, question: c.question, pass: true };
    try {
      if (c.expect.retrieval) {
        const matches = await rag.retrieve(c.question);
        const index = matches.findIndex((m) => c.expect.retrieval!.some((u) => m.metadata.url.includes(u)));
        result.retrieval = { hit: index >= 0, rank: index >= 0 ? index + 1 : null };
      }
      const needsAnswer = c.expect.answer || c.expect.attachments || c.expect.sources;
      if (!retrievalOnly && needsAnswer) {
        const started = Date.now();
        const answer = await rag.answer(c.question);
        result.latencyMs = Date.now() - started;
        result.answerText = answer.answer;
        if (c.expect.answer) result.answer = checkAnswer(answer.answer, c.expect.answer);
        if (c.expect.attachments || c.expect.sources) {
          result.attachments = checkAttachments(answer.attachments, answer.sources, c.expect);
        }
      }
    } catch (err) {
      result.error = (err as Error).message;
    }
    result.pass =
      !result.error &&
      result.retrieval?.hit !== false &&
      result.answer?.pass !== false &&
      result.attachments?.pass !== false;
    results.push(result);
    console.log(row(result));
  }

  // Summary
  const scored = <K extends 'retrieval' | 'answer' | 'attachments'>(key: K) => results.filter((r) => r[key]);
  const latencies = results.map((r) => r.latencyMs).filter((l): l is number => l !== undefined).sort((a, b) => a - b);
  console.log(`\nPassed:      ${pct(results.filter((r) => r.pass).length, results.length)}`);
  console.log(`Retrieval:   ${pct(scored('retrieval').filter((r) => r.retrieval!.hit).length, scored('retrieval').length)}`);
  if (!retrievalOnly) {
    console.log(`Answers:     ${pct(scored('answer').filter((r) => r.answer!.pass).length, scored('answer').length)}`);
    console.log(`Attachments: ${pct(scored('attachments').filter((r) => r.attachments!.pass).length, scored('attachments').length)}`);
    if (latencies.length) {
      console.log(
        `Latency:     median ${(latencies[Math.floor(latencies.length / 2)] / 1000).toFixed(1)}s, max ${(latencies.at(-1)! / 1000).toFixed(1)}s`,
      );
    }
  }
  const { hits, misses } = embedStats();
  console.log(`Embeddings:  ${hits} cached, ${misses} fetched from Voyage`);

  // Compare with the previous run of the same mode (only cases present in both).
  mkdirSync(RESULTS_DIR, { recursive: true });
  const latestPath = join(RESULTS_DIR, `latest-${mode}.json`);
  let regressions = 0;
  if (existsSync(latestPath)) {
    const previous: Report = JSON.parse(readFileSync(latestPath, 'utf-8'));
    const before = new Map(previous.results.map((r) => [r.id, r.pass]));
    const regressed = results.filter((r) => before.get(r.id) === true && !r.pass);
    const fixed = results.filter((r) => before.get(r.id) === false && r.pass);
    regressions = regressed.length;
    console.log(`\nVs previous run (${previous.ranAt}, model ${previous.model}):`);
    console.log(regressed.length ? `  Regressions: ${regressed.map((r) => r.id).join(', ')}` : '  No regressions');
    if (fixed.length) console.log(`  Now passing: ${fixed.map((r) => r.id).join(', ')}`);
  }

  const report: Report = { mode, ranAt: new Date().toISOString(), model: config.get<string>('geminiModel')!, results };
  const reportPath = join(RESULTS_DIR, `${report.ranAt.replace(/[:.]/g, '-')}-${mode}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  // Partial runs (--only) don't replace the baseline.
  if (!only) writeFileSync(latestPath, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${reportPath}`);

  await app.close();
  process.exit(regressions > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
