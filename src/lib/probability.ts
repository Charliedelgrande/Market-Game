import type { Question, Tier } from '../types';
import { shuffle, type Rand } from './rng';

// ---------------------------------------------------------------------------
// Exact expected values. Never approximate when a closed form or a small
// enumeration exists. Each template has a matching Monte Carlo test in
// tests/probability.test.ts.
// ---------------------------------------------------------------------------

export type DiceStat = 'sum' | 'max' | 'min' | 'product';

const ENUM_CAP = 100000;

/** Mean of sum/max/min/product of n fair s-sided dice, by exhaustive
 *  enumeration over all s^n outcomes (capped at 100k outcomes). */
export function diceStatMean(n: number, s: number, stat: DiceStat): number {
  const total = Math.pow(s, n);
  if (total > ENUM_CAP) throw new Error(`enumeration cap exceeded: ${s}^${n}`);
  const faces = new Array<number>(n).fill(1);
  let acc = 0;
  for (let i = 0; i < total; i++) {
    let v: number;
    switch (stat) {
      case 'sum': { v = 0; for (const f of faces) v += f; break; }
      case 'product': { v = 1; for (const f of faces) v *= f; break; }
      case 'max': { v = 1; for (const f of faces) if (f > v) v = f; break; }
      case 'min': { v = s; for (const f of faces) if (f < v) v = f; break; }
    }
    acc += v;
    for (let d = 0; d < n; d++) {
      if (faces[d] < s) { faces[d]++; break; }
      faces[d] = 1;
    }
  }
  return acc / total;
}

/** Expected heads in n flips of a p-coin. */
export const headsMean = (n: number, p: number): number => n * p;

/** Expected number of distinct faces seen in n rolls of an s-sided die. */
export const distinctFacesMean = (s: number, n: number): number =>
  s * (1 - Math.pow((s - 1) / s, n));

/** Expected flips until the first heads with a p-coin (geometric). */
export const firstHeadsMean = (p: number): number => 1 / p;

/** Expected flips of a fair coin until k consecutive heads. */
export const kConsecutiveMean = (k: number): number => Math.pow(2, k + 1) - 2;

/** Coupon collector: expected rolls of an s-sided die until all faces seen. */
export function couponCollectorMean(s: number): number {
  let h = 0;
  for (let i = 1; i <= s; i++) h += 1 / i;
  return s * h;
}

/** Hypergeometric mean: successes in a k-draw without replacement from a
 *  population of N containing K successes. */
export const hypergeomMean = (N: number, K: number, k: number): number => (k * K) / N;

/** Expected fixed points of a uniform random permutation of n items. */
export const fixedPointsMean = (_n: number): number => 1;

/** Expected number of pairs sharing a birthday among n people, d-day calendar. */
export const birthdayPairsMean = (n: number, d: number): number => (n * (n - 1)) / 2 / d;

/** Expected number of runs (maximal blocks) in N fair coin flips. */
export const runsMean = (N: number): number => (N + 1) / 2;

// ---------------------------------------------------------------------------
// Pool generation. Each variant is { prompt, value, tier }; tiers grade
// reasoning depth, not arithmetic size.
// ---------------------------------------------------------------------------

interface Variant {
  template: string;
  prompt: string;
  value: number;
  tier: Tier;
}

const DICE_SIDES = [4, 6, 8, 10, 12, 20];

function diceWord(s: number): string {
  return `${s}-sided ${'die'}`;
}

function buildVariants(): Variant[] {
  const v: Variant[] = [];

  // Dice statistics — sum is tier 1 (linearity), max/min/product tier 2 (skewed/compound)
  const stats: { stat: DiceStat; tier: Tier; word: string }[] = [
    { stat: 'sum', tier: 1, word: 'sum' },
    { stat: 'max', tier: 2, word: 'maximum' },
    { stat: 'min', tier: 2, word: 'minimum' },
    { stat: 'product', tier: 2, word: 'product' },
  ];
  for (const { stat, tier, word } of stats) {
    for (let n = 2; n <= 5; n++) {
      for (const s of DICE_SIDES) {
        if (Math.pow(s, n) > ENUM_CAP) continue;
        v.push({
          template: `dice-${stat}`,
          tier,
          value: diceStatMean(n, s, stat),
          prompt: `You roll ${n} fair ${s}-sided dice. What is the expected ${word} of the faces shown?`,
        });
      }
    }
  }

  // Heads in n flips of a p-coin — tier 1
  for (let n = 5; n <= 150; n += 5) {
    for (let pc = 10; pc <= 90; pc += 5) {
      const p = pc / 100;
      v.push({
        template: 'heads-count',
        tier: 1,
        value: headsMean(n, p),
        prompt: `A biased coin lands heads with probability ${p}. You flip it ${n} times. What is the expected number of heads?`,
      });
    }
  }

  // Distinct faces — tier 2
  for (const s of DICE_SIDES) {
    for (let n = 2; n <= 40; n++) {
      v.push({
        template: 'distinct-faces',
        tier: 2,
        value: distinctFacesMean(s, n),
        prompt: `You roll a fair ${diceWord(s)} ${n} times. What is the expected number of distinct faces you will see at least once?`,
      });
    }
  }

  // Flips until first heads — tier 2 (recursive but elementary)
  for (let q = 2; q <= 20; q++) {
    v.push({
      template: 'first-heads',
      tier: 2,
      value: firstHeadsMean(1 / q),
      prompt: `A coin lands heads with probability 1/${q}. What is the expected number of flips until the first heads (counting the flip that lands heads)?`,
    });
  }

  // k consecutive heads — tier 3
  for (let k = 2; k <= 7; k++) {
    v.push({
      template: 'k-consecutive',
      tier: 3,
      value: kConsecutiveMean(k),
      prompt: `You flip a fair coin until you see ${k} heads in a row. What is the expected total number of flips?`,
    });
  }

  // Coupon collector — tier 3
  for (let s = 3; s <= 60; s++) {
    v.push({
      template: 'coupon-collector',
      tier: 3,
      value: couponCollectorMean(s),
      prompt: `You roll a fair ${s}-sided die until every face has appeared at least once. What is the expected number of rolls?`,
    });
  }

  // Hypergeometric mean — tier 1 (linearity)
  const hyperScenes: { N: number; K: number; k: number[]; text: (K: number, k: number) => string }[] = [
    { N: 52, K: 13, k: [3, 5, 7, 10, 13, 20, 26], text: (_K, k) => `You draw ${k} cards from a shuffled standard 52-card deck without replacement. What is the expected number of hearts?` },
    { N: 52, K: 4, k: [5, 10, 13, 20, 26], text: (_K, k) => `You draw ${k} cards from a shuffled standard 52-card deck without replacement. What is the expected number of aces?` },
  ];
  for (const sc of hyperScenes) {
    for (const k of sc.k) {
      v.push({
        template: 'hypergeometric',
        tier: 1,
        value: hypergeomMean(sc.N, sc.K, k),
        prompt: sc.text(sc.K, k),
      });
    }
  }
  for (const N of [20, 30, 40, 60, 80, 100]) {
    for (const Kf of [0.2, 0.25, 0.4, 0.5, 0.6]) {
      const K = Math.round(N * Kf);
      for (const kf of [0.15, 0.25, 0.4, 0.5]) {
        const k = Math.max(2, Math.round(N * kf));
        v.push({
          template: 'hypergeometric',
          tier: 1,
          value: hypergeomMean(N, K, k),
          prompt: `An urn holds ${N} balls, ${K} of them red. You draw ${k} balls without replacement. What is the expected number of red balls drawn?`,
        });
      }
    }
  }

  // Fixed points of a random permutation — tier 2
  for (let n = 4; n <= 60; n += 4) {
    v.push({
      template: 'fixed-points',
      tier: 2,
      value: fixedPointsMean(n),
      prompt: `${n} people throw their hats in a pile and each takes one back uniformly at random. What is the expected number of people who get their own hat?`,
    });
  }

  // Birthday matching pairs — tier 2
  for (let n = 5; n <= 70; n += 5) {
    v.push({
      template: 'birthday-pairs',
      tier: 2,
      value: birthdayPairsMean(n, 365),
      prompt: `In a room of ${n} people with birthdays uniform over a 365-day year, what is the expected number of pairs of people who share a birthday?`,
    });
  }
  for (let n = 3; n <= 12; n++) {
    v.push({
      template: 'birthday-pairs',
      tier: 2,
      value: birthdayPairsMean(n, 12),
      prompt: `${n} people each pick a birth month uniformly at random. What is the expected number of pairs born in the same month?`,
    });
  }

  // Runs in N fair flips — tier 2
  for (let N = 4; N <= 200; N += 4) {
    v.push({
      template: 'runs',
      tier: 2,
      value: runsMean(N),
      prompt: `You flip a fair coin ${N} times. A run is a maximal block of consecutive identical results. What is the expected number of runs?`,
    });
  }

  return v;
}

let cachedVariants: Variant[] | null = null;

export function generateProbabilityPool(target = 1200, rand: Rand = Math.random): Question[] {
  if (!cachedVariants) cachedVariants = buildVariants();
  const picked = shuffle(cachedVariants, rand).slice(0, target);
  return picked.map((q, i) => ({
    id: `prob-${i}-${q.template}`,
    mode: 'prob' as const,
    prompt: q.prompt,
    value: q.value,
    tier: q.tier,
    template: q.template,
  }));
}
