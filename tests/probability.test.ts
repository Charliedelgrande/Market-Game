import { describe, expect, it } from 'vitest';
import {
  birthdayPairsMean, couponCollectorMean, diceStatMean, distinctFacesMean,
  firstHeadsMean, fixedPointsMean, generateProbabilityPool, headsMean,
  hypergeomMean, kConsecutiveMean, runsMean, type DiceStat,
} from '../src/lib/probability';
import { mulberry32, type Rand } from '../src/lib/rng';

// Every template's analytic value must be within 1% of a 200k-trial
// Monte Carlo estimate. If a template fails, the template is wrong,
// not the test. Seeded PRNG keeps runs deterministic.
const TRIALS = 200000;

function mc(_rand: Rand, trial: () => number): number {
  let acc = 0;
  for (let i = 0; i < TRIALS; i++) acc += trial();
  return acc / TRIALS;
}

function expectWithin1pct(analytic: number, simulated: number) {
  expect(Math.abs(simulated - analytic)).toBeLessThanOrEqual(Math.abs(analytic) * 0.01);
}

const roll = (rand: Rand, s: number) => 1 + Math.floor(rand() * s);

describe('dice statistics (exhaustive enumeration)', () => {
  const cases: { n: number; s: number; stat: DiceStat }[] = [
    { n: 3, s: 6, stat: 'sum' },
    { n: 2, s: 20, stat: 'sum' },
    { n: 3, s: 6, stat: 'max' },
    { n: 4, s: 8, stat: 'max' },
    { n: 3, s: 6, stat: 'min' },
    { n: 2, s: 12, stat: 'min' },
    { n: 3, s: 6, stat: 'product' },
    { n: 2, s: 10, stat: 'product' },
  ];
  for (const { n, s, stat } of cases) {
    it(`${stat} of ${n}d${s}`, () => {
      const rand = mulberry32(0xd1ce + n * 100 + s * 7 + stat.length);
      const sim = mc(rand, () => {
        let v = stat === 'product' ? 1 : stat === 'sum' ? 0 : stat === 'max' ? 1 : s;
        for (let i = 0; i < n; i++) {
          const f = roll(rand, s);
          if (stat === 'sum') v += f;
          else if (stat === 'product') v *= f;
          else if (stat === 'max') v = Math.max(v, f);
          else v = Math.min(v, f);
        }
        return v;
      });
      expectWithin1pct(diceStatMean(n, s, stat), sim);
    });
  }
});

it('heads in N flips of a p-coin', () => {
  const rand = mulberry32(0xc0111);
  const n = 100, p = 0.3;
  const sim = mc(rand, () => {
    let h = 0;
    for (let i = 0; i < n; i++) if (rand() < p) h++;
    return h;
  });
  expectWithin1pct(headsMean(n, p), sim);
});

it('distinct faces in N rolls of an S-sided die', () => {
  const rand = mulberry32(0xd1571);
  const s = 6, n = 10;
  const sim = mc(rand, () => {
    let mask = 0;
    for (let i = 0; i < n; i++) mask |= 1 << (roll(rand, s) - 1);
    let c = 0;
    for (let f = 0; f < s; f++) if (mask & (1 << f)) c++;
    return c;
  });
  expectWithin1pct(distinctFacesMean(s, n), sim);
});

it('flips until first heads (geometric)', () => {
  const rand = mulberry32(0x9e011);
  const p = 1 / 6;
  const sim = mc(rand, () => {
    let flips = 1;
    while (rand() >= p) flips++;
    return flips;
  });
  expectWithin1pct(firstHeadsMean(p), sim);
});

it('flips until k consecutive heads (fair coin)', () => {
  const rand = mulberry32(0xc025ec);
  const k = 5;
  const sim = mc(rand, () => {
    let flips = 0, streak = 0;
    while (streak < k) {
      flips++;
      streak = rand() < 0.5 ? streak + 1 : 0;
    }
    return flips;
  });
  expectWithin1pct(kConsecutiveMean(k), sim);
});

it('coupon collector: rolls until all S faces seen', () => {
  const rand = mulberry32(0xc0904);
  const s = 12;
  const sim = mc(rand, () => {
    let mask = 0, rolls = 0;
    const full = (1 << s) - 1;
    while (mask !== full) {
      mask |= 1 << (roll(rand, s) - 1);
      rolls++;
    }
    return rolls;
  });
  expectWithin1pct(couponCollectorMean(s), sim);
});

it('hypergeometric: successes in k draws without replacement', () => {
  const rand = mulberry32(0x4b9e0);
  const N = 52, K = 13, k = 10;
  const pop: number[] = new Array<number>(N).fill(0).map((_, i) => (i < K ? 1 : 0));
  const sim = mc(rand, () => {
    // partial Fisher-Yates: draw k without replacement
    const a = pop.slice();
    let hits = 0;
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rand() * (N - i));
      [a[i], a[j]] = [a[j], a[i]];
      hits += a[i];
    }
    return hits;
  });
  expectWithin1pct(hypergeomMean(N, K, k), sim);
});

it('fixed points of a random permutation', () => {
  const rand = mulberry32(0xf1e9);
  const n = 20;
  const base = new Array<number>(n).fill(0).map((_, i) => i);
  const sim = mc(rand, () => {
    const a = base.slice();
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    let fp = 0;
    for (let i = 0; i < n; i++) if (a[i] === i) fp++;
    return fp;
  });
  expectWithin1pct(fixedPointsMean(n), sim);
});

it('matching birthday pairs among n people on a d-day calendar', () => {
  const rand = mulberry32(0xb14d);
  const n = 40, d = 365;
  const sim = mc(rand, () => {
    const counts = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const day = Math.floor(rand() * d);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    let pairs = 0;
    for (const c of counts.values()) pairs += (c * (c - 1)) / 2;
    return pairs;
  });
  expectWithin1pct(birthdayPairsMean(n, d), sim);
});

it('runs in N fair flips', () => {
  const rand = mulberry32(0x9415);
  const N = 20;
  const sim = mc(rand, () => {
    let runs = 1;
    let prev = rand() < 0.5;
    for (let i = 1; i < N; i++) {
      const cur = rand() < 0.5;
      if (cur !== prev) runs++;
      prev = cur;
    }
    return runs;
  });
  expectWithin1pct(runsMean(N), sim);
});

describe('pool generation', () => {
  it('produces ~1200 questions with finite positive values and valid tiers', () => {
    const pool = generateProbabilityPool(1200, mulberry32(42));
    expect(pool.length).toBeGreaterThanOrEqual(1000);
    for (const q of pool) {
      expect(Number.isFinite(q.value)).toBe(true);
      expect(q.value).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(q.tier);
      expect(q.prompt.length).toBeGreaterThan(10);
    }
  });
});
