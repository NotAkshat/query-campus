import { rateLimit } from './rate-limit.js';

function run(limit: number, calls: number) {
  const mw = rateLimit(limit);
  const results: number[] = [];
  for (let i = 0; i < calls; i++) {
    let status = 200;
    const res: any = { setHeader() {}, status(code: number) { status = code; return this; }, json() {} };
    mw({ ip: '1.2.3.4' } as any, res, () => {});
    results.push(status);
  }
  return results;
}

describe('rateLimit', () => {
  it('allows the limit and then answers 429', () => {
    expect(run(2, 4)).toEqual([200, 200, 429, 429]);
  });
  it('is off when the limit is 0', () => {
    expect(run(0, 3)).toEqual([200, 200, 200]);
  });
});
