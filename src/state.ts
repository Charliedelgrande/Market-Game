import type {
  BotDecision, Inventory, Mode, Question, RoundRecord, Settings,
} from './types';
import { rawPnl } from './lib/bot';
import { roundScore } from './lib/scoring';

export type Screen = 'start' | 'game' | 'stats';

export interface GameState {
  screen: Screen;
  settings: Settings;
  pendingSettings: Settings | null; // applied at the next question
  probQueue: Question[];
  probIdx: number;
  realQueue: Question[];
  realIdx: number;
  rounds: RoundRecord[];
  current: Question | null;
  phase: 'quote' | 'reveal';
  last: RoundRecord | null;
  inv: Inventory;
  roundNo: number;
}

export const defaultSettings: Settings = { mode: 'mixed', difficulty: 'normal', timer: 0 };

export const initialState: GameState = {
  screen: 'start',
  settings: defaultSettings,
  pendingSettings: null,
  probQueue: [],
  probIdx: 0,
  realQueue: [],
  realIdx: 0,
  rounds: [],
  current: null,
  phase: 'quote',
  last: null,
  inv: { pos: 0, avgEntry: 0, lastV: null },
  roundNo: 0,
};

export type Action =
  | { type: 'start'; settings: Settings; probQueue: Question[]; realQueue: Question[] }
  | { type: 'resolve'; bid: number; ask: number; decision: BotDecision }
  | { type: 'timeout' }
  | { type: 'next' }
  | { type: 'end' }
  | { type: 'updateSettings'; settings: Settings }
  | { type: 'reset' };

interface Drawn {
  q: Question | null;
  probIdx: number;
  realIdx: number;
}

// Draw without replacement, alternating deterministically in mixed mode.
function draw(
  mode: Settings['mode'],
  probQueue: Question[], probIdx: number,
  realQueue: Question[], realIdx: number,
  roundNo: number,
): Drawn {
  const probLeft = probIdx < probQueue.length;
  const realLeft = realIdx < realQueue.length;
  let pick: Mode | null = null;
  if (mode === 'prob') pick = probLeft ? 'prob' : null;
  else if (mode === 'real') pick = realLeft ? 'real' : null;
  else {
    const prefer: Mode = roundNo % 2 === 0 ? 'prob' : 'real';
    if (prefer === 'prob') pick = probLeft ? 'prob' : realLeft ? 'real' : null;
    else pick = realLeft ? 'real' : probLeft ? 'prob' : null;
  }
  if (pick === 'prob') return { q: probQueue[probIdx], probIdx: probIdx + 1, realIdx };
  if (pick === 'real') return { q: realQueue[realIdx], probIdx, realIdx: realIdx + 1 };
  return { q: null, probIdx, realIdx };
}

/** Standard position accounting: same-sign adds re-average the entry,
 *  opposite-sign trades reduce first, and a flip resets the entry price. */
function applyTrade(inv: Inventory, delta: number, price: number): Inventory {
  let { pos, avgEntry } = inv;
  if (pos === 0 || Math.sign(delta) === Math.sign(pos)) {
    avgEntry = (avgEntry * Math.abs(pos) + price * Math.abs(delta)) / (Math.abs(pos) + Math.abs(delta));
    pos += delta;
  } else {
    const newPos = pos + delta;
    if (newPos === 0) { pos = 0; avgEntry = 0; }
    else if (Math.sign(newPos) === Math.sign(pos)) { pos = newPos; }
    else { pos = newPos; avgEntry = price; }
  }
  return { ...inv, pos, avgEntry };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'start': {
      const d = draw(action.settings.mode, action.probQueue, 0, action.realQueue, 0, 0);
      return {
        ...initialState,
        screen: 'game',
        settings: action.settings,
        probQueue: action.probQueue,
        realQueue: action.realQueue,
        probIdx: d.probIdx,
        realIdx: d.realIdx,
        current: d.q,
        roundNo: 1,
      };
    }
    case 'resolve': {
      const q = state.current;
      if (!q || state.phase !== 'quote') return state;
      const { bid, ask, decision } = action;
      const raw = rawPnl(decision.action, decision.size, bid, ask, q.value);
      const rec: RoundRecord = {
        qid: q.id, mode: q.mode, tier: q.tier, prompt: q.prompt, V: q.value,
        bid, ask, timedOut: false,
        informed: decision.informed, action: decision.action, size: decision.size,
        price: decision.action === 'buy' ? ask : decision.action === 'sell' ? bid : null,
        raw, score: roundScore(q.mode, raw, q.value),
      };
      let inv: Inventory = { ...state.inv, lastV: q.value };
      if (decision.action === 'buy') inv = applyTrade(inv, -decision.size, ask);
      else if (decision.action === 'sell') inv = applyTrade(inv, decision.size, bid);
      return { ...state, phase: 'reveal', last: rec, rounds: [...state.rounds, rec], inv };
    }
    case 'timeout': {
      const q = state.current;
      if (!q || state.phase !== 'quote') return state;
      const rec: RoundRecord = {
        qid: q.id, mode: q.mode, tier: q.tier, prompt: q.prompt, V: q.value,
        bid: null, ask: null, timedOut: true,
        informed: null, action: null, size: 0, price: null, raw: 0, score: 0,
      };
      return {
        ...state, phase: 'reveal', last: rec,
        rounds: [...state.rounds, rec],
        inv: { ...state.inv, lastV: q.value },
      };
    }
    case 'next': {
      const settings = state.pendingSettings ?? state.settings;
      const d = draw(settings.mode, state.probQueue, state.probIdx, state.realQueue, state.realIdx, state.roundNo);
      if (!d.q) return { ...state, settings, pendingSettings: null, screen: 'stats', current: null };
      return {
        ...state, settings, pendingSettings: null,
        current: d.q, probIdx: d.probIdx, realIdx: d.realIdx,
        phase: 'quote', last: null, roundNo: state.roundNo + 1,
      };
    }
    case 'end':
      return { ...state, screen: 'stats', current: null };
    case 'updateSettings':
      if (state.screen === 'game') return { ...state, pendingSettings: action.settings };
      return { ...state, settings: action.settings };
    case 'reset':
      return { ...initialState, settings: state.pendingSettings ?? state.settings };
    default:
      return state;
  }
}
