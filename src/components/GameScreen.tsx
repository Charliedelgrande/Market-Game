import { useEffect, useRef, useState } from 'react';
import type { Action, GameState } from '../state';
import { DIFFICULTY } from '../types';
import { botDecide } from '../lib/bot';
import { fmt, fmtSigned, pnlClass } from '../lib/format';

interface Props {
  state: GameState;
  dispatch: (a: Action) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

const TIER_LABEL = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' } as const;

export default function GameScreen({ state, dispatch, onOpenSettings, onOpenHelp }: Props) {
  const q = state.current;
  const [bidStr, setBidStr] = useState('');
  const [askStr, setAskStr] = useState('');
  const [err, setErr] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const bidRef = useRef<HTMLInputElement>(null);

  // reset inputs and timer for each new question
  useEffect(() => {
    setBidStr('');
    setAskStr('');
    setErr('');
    setRemaining(state.settings.timer > 0 ? state.settings.timer : null);
  }, [q?.id, state.settings.timer]);

  useEffect(() => {
    if (state.phase !== 'quote' || state.settings.timer === 0) return;
    const iv = setInterval(() => {
      setRemaining((r) => (r === null ? null : r - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [q?.id, state.phase, state.settings.timer]);

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && state.phase === 'quote') {
      dispatch({ type: 'timeout' });
    }
  }, [remaining, state.phase, dispatch]);

  if (!q) return null;

  const totalScore = state.rounds.reduce((a, r) => a + r.score, 0);
  const { pos, avgEntry, lastV } = state.inv;
  const mtm = pos !== 0 && lastV !== null ? (lastV - avgEntry) * pos : 0;

  // strict parse: allow commas/spaces as grouping, reject anything else
  const parseNum = (s: string): number => {
    const t = s.replace(/[,\s]/g, '');
    return t === '' ? NaN : Number(t);
  };

  const submit = () => {
    const bid = parseNum(bidStr);
    const ask = parseNum(askStr);
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) { setErr('Enter both a bid and an ask (numbers only).'); return; }
    if (bid >= ask) { setErr('Bid must be strictly below ask.'); return; }
    const decision = botDecide(bid, ask, q.value, DIFFICULTY[state.settings.difficulty]);
    dispatch({ type: 'resolve', bid, ask, decision });
  };

  const last = state.last;
  const timerPct = remaining !== null && state.settings.timer > 0
    ? Math.max(0, (remaining / state.settings.timer) * 100)
    : null;

  return (
    <div className="game">
      <div className="hdr">
        <div className="stat">
          <span className="lab">Round</span>
          <span className="val num">{state.roundNo}</span>
        </div>
        <div className="stat">
          <span className="lab">Score</span>
          <span className={`val num ${pnlClass(totalScore)}`}>{fmtSigned(totalScore)}</span>
        </div>
        <div className="stat">
          <span className="lab">Position</span>
          <span className="val num">
            {pos === 0 ? 'flat' : `${pos > 0 ? '+' : ''}${pos} @ ${fmt(avgEntry)}`}
          </span>
        </div>
        {pos !== 0 && (
          <div className="stat">
            <span className="lab">MTM</span>
            <span className={`val num ${pnlClass(mtm)}`}>{fmtSigned(mtm)}</span>
          </div>
        )}
        <div className="icons">
          <button className="btn btn-ghost" onClick={onOpenHelp} aria-label="How to play">?</button>
          <button className="btn btn-ghost" onClick={onOpenSettings} aria-label="Settings">⚙</button>
          <button className="btn btn-ghost" onClick={() => dispatch({ type: 'end' })}>End</button>
        </div>
      </div>

      {timerPct !== null && state.phase === 'quote' && (
        <div className="timerbar">
          <div className={remaining !== null && remaining <= 5 ? 'low' : ''} style={{ width: `${timerPct}%` }} />
        </div>
      )}

      <div className="qwrap">
        <div className="qmeta">
          <span className="chip">{q.mode === 'prob' ? 'Probability' : 'Real world'}</span>
          <span className="chip">{TIER_LABEL[q.tier]}</span>
          {remaining !== null && state.phase === 'quote' && (
            <span className={`chip num ${remaining <= 5 ? 'down' : ''}`}>{remaining}s</span>
          )}
        </div>
        <div className="question">{q.prompt}</div>
      </div>

      {state.phase === 'quote' ? (
        <div className="quoteform">
          <div className="inputs">
            <div className="inp">
              <label htmlFor="bid">Bid — you buy</label>
              <input
                id="bid" ref={bidRef} inputMode="decimal" autoComplete="off"
                placeholder="0" value={bidStr}
                onChange={(e) => setBidStr(e.target.value)}
              />
            </div>
            <div className="inp">
              <label htmlFor="ask">Ask — you sell</label>
              <input
                id="ask" inputMode="decimal" autoComplete="off"
                placeholder="0" value={askStr}
                onChange={(e) => setAskStr(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              />
            </div>
          </div>
          <div className="err">{err}</div>
          <button className="btn btn-brass btn-block" onClick={submit}>Quote it</button>
        </div>
      ) : last && (
        <div className="reveal">
          <div className="truth card">
            <div className="lab">True value</div>
            <div className="val num">{fmt(last.V, 4)}</div>
            {q.source && <div className="src">{q.source}{q.asOf ? ` · as of ${q.asOf}` : ''}</div>}
          </div>
          <div className="rows">
            {last.timedOut ? (
              <div className="row"><span className="k">Result</span><span className="down">Timed out — no quote posted</span></div>
            ) : (
              <>
                <div className="row">
                  <span className="k">Your quote</span>
                  <span className="num">{fmt(last.bid!, 4)} / {fmt(last.ask!, 4)}</span>
                </div>
                <div className="row">
                  <span className="k">Bot</span>
                  <span>
                    {last.action === 'pass'
                      ? 'passed'
                      : <>{last.action === 'buy' ? 'bought' : 'sold'} <span className="num">{last.size}</span> @ <span className="num">{fmt(last.price!, 4)}</span></>}
                    {' '}<span className="mute">({last.informed ? 'informed' : 'noise'})</span>
                  </span>
                </div>
                <div className="row">
                  <span className="k">Round P&L{last.mode === 'real' ? ' (raw)' : ''}</span>
                  <span className={`num ${pnlClass(last.raw)}`}>{fmtSigned(last.raw)}</span>
                </div>
                {last.mode === 'real' && (
                  <div className="row">
                    <span className="k">Score (% of value)</span>
                    <span className={`num ${pnlClass(last.score)}`}>{fmtSigned(last.score)}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <button className="btn btn-brass btn-block" onClick={() => dispatch({ type: 'next' })}>
            Next question
          </button>
        </div>
      )}
    </div>
  );
}
