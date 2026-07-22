import type { Mode, RoundRecord, Tier } from '../types';

/** Round score. Probability questions use raw P&L directly; real-world
 *  questions are normalized so magnitude cannot dominate. */
export function roundScore(mode: Mode, raw: number, V: number): number {
  return mode === 'real' ? (raw / V) * 100 : raw;
}

export interface TierStats {
  tier: Tier;
  rounds: number;
  quoted: number;
  containment: number | null; // fraction contained
  meanAbsCenteringPct: number | null;
  score: number;
}

export interface SessionStats {
  rounds: number;
  quoted: number; // rounds with a valid quote (not timed out)
  timeouts: number;
  trades: number;
  totalScore: number;
  prob: { rounds: number; raw: number; score: number };
  real: { rounds: number; raw: number; score: number };
  containment: number | null;
  avgSpreadPct: number | null; // (ask - bid) / V * 100
  centeringPct: number | null; // mean of (mid - V)/V * 100, signed
  informed: { rounds: number; trades: number; score: number; probRaw: number; realScore: number };
  noise: { rounds: number; trades: number; score: number; probRaw: number; realScore: number };
  byTier: TierStats[];
}

export function computeStats(records: RoundRecord[]): SessionStats {
  const quoted = records.filter((r) => !r.timedOut && r.bid !== null && r.ask !== null);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const contained = quoted.map((r) => (r.bid! <= r.V && r.V <= r.ask! ? 1 : 0));
  const spreadPct = quoted.map((r) => ((r.ask! - r.bid!) / r.V) * 100);
  const centering = quoted.map((r) => (((r.bid! + r.ask!) / 2 - r.V) / r.V) * 100);

  const bucket = (flag: boolean) => {
    const rs = quoted.filter((r) => r.informed === flag);
    return {
      rounds: rs.length,
      trades: rs.filter((r) => r.action === 'buy' || r.action === 'sell').length,
      score: sum(rs.map((r) => r.score)),
      probRaw: sum(rs.filter((r) => r.mode === 'prob').map((r) => r.raw)),
      realScore: sum(rs.filter((r) => r.mode === 'real').map((r) => r.score)),
    };
  };

  const byTier: TierStats[] = ([1, 2, 3] as Tier[]).map((tier) => {
    const rs = records.filter((r) => r.tier === tier);
    const qs = quoted.filter((r) => r.tier === tier);
    return {
      tier,
      rounds: rs.length,
      quoted: qs.length,
      containment: mean(qs.map((r) => (r.bid! <= r.V && r.V <= r.ask! ? 1 : 0))),
      meanAbsCenteringPct: mean(qs.map((r) => Math.abs((((r.bid! + r.ask!) / 2 - r.V) / r.V) * 100))),
      score: sum(rs.map((r) => r.score)),
    };
  });

  const probRecs = records.filter((r) => r.mode === 'prob');
  const realRecs = records.filter((r) => r.mode === 'real');

  return {
    rounds: records.length,
    quoted: quoted.length,
    timeouts: records.filter((r) => r.timedOut).length,
    trades: records.filter((r) => r.action === 'buy' || r.action === 'sell').length,
    totalScore: sum(records.map((r) => r.score)),
    prob: { rounds: probRecs.length, raw: sum(probRecs.map((r) => r.raw)), score: sum(probRecs.map((r) => r.score)) },
    real: { rounds: realRecs.length, raw: sum(realRecs.map((r) => r.raw)), score: sum(realRecs.map((r) => r.score)) },
    containment: mean(contained),
    avgSpreadPct: mean(spreadPct),
    centeringPct: mean(centering),
    informed: bucket(true),
    noise: bucket(false),
    byTier,
  };
}
