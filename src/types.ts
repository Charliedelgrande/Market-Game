export type Mode = 'prob' | 'real';
export type SessionMode = 'prob' | 'real' | 'mixed';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Tier = 1 | 2 | 3;

export interface Question {
  id: string;
  mode: Mode;
  prompt: string;
  value: number;
  tier: Tier;
  template?: string;
  source?: string;
  asOf?: string;
  magnitude?: number;
}

export interface Settings {
  mode: SessionMode;
  difficulty: Difficulty;
  timer: 0 | 30 | 15; // seconds, 0 = off
}

export interface DifficultyParams {
  p: number; // probability the bot is informed
  T: number; // edge threshold
}

export const DIFFICULTY: Record<Difficulty, DifficultyParams> = {
  easy: { p: 0.25, T: 0.15 },
  normal: { p: 0.5, T: 0.05 },
  hard: { p: 0.8, T: 0.0 },
};

export type BotAction = 'buy' | 'sell' | 'pass';

export interface BotDecision {
  informed: boolean;
  action: BotAction;
  size: number;
}

export interface RoundRecord {
  qid: string;
  mode: Mode;
  tier: Tier;
  prompt: string;
  V: number;
  bid: number | null;
  ask: number | null;
  timedOut: boolean;
  informed: boolean | null; // null when timed out (bot never acted)
  action: BotAction | null;
  size: number;
  price: number | null; // ask if bot bought, bid if bot sold
  raw: number; // raw P&L in question units
  score: number; // prob: raw; real: (raw / V) * 100
}

export interface Inventory {
  pos: number; // player position in units (+long / -short)
  avgEntry: number;
  lastV: number | null; // most recent true value, for mark-to-market
}
