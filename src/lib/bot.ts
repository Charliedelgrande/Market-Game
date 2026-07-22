import type { BotDecision, DifficultyParams } from '../types';
import type { Rand } from './rng';

const EPSILON = 1e-9;

/**
 * Per round the bot is informed with probability p, otherwise it is a noise
 * trader. Informed flow knows the true value V and trades the profitable
 * side when its edge (in spread units) exceeds threshold T.
 */
export function botDecide(
  bid: number,
  ask: number,
  V: number,
  { p, T }: DifficultyParams,
  rand: Rand = Math.random,
): BotDecision {
  const informed = rand() < p;

  if (informed) {
    const spreadUnit = Math.max(ask - bid, EPSILON);
    const edgeBuy = (V - ask) / spreadUnit;
    const edgeSell = (bid - V) / spreadUnit;
    // bid < ask means at most one side can be profitable
    const side: 'buy' | 'sell' = edgeBuy >= edgeSell ? 'buy' : 'sell';
    const edge = Math.max(edgeBuy, edgeSell);
    if (edge > T) {
      const size = Math.min(5, Math.max(1, Math.round(edge * 2)));
      return { informed, action: side, size };
    }
    return { informed, action: 'pass', size: 0 };
  }

  // Noise trader: ignores V, trades with probability 0.5, random side, size 1-2
  if (rand() < 0.5) {
    return {
      informed,
      action: rand() < 0.5 ? 'buy' : 'sell',
      size: rand() < 0.5 ? 1 : 2,
    };
  }
  return { informed, action: 'pass', size: 0 };
}

/**
 * Raw P&L from the player's perspective.
 * Bot buys at ask A  -> player is short -> raw = (A - V) * size
 * Bot sells at bid B -> player is long  -> raw = (V - B) * size
 */
export function rawPnl(
  action: 'buy' | 'sell' | 'pass',
  size: number,
  bid: number,
  ask: number,
  V: number,
): number {
  if (action === 'buy') return (ask - V) * size;
  if (action === 'sell') return (V - bid) * size;
  return 0;
}
