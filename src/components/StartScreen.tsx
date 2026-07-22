import { useState } from 'react';
import type { Settings } from '../types';
import Seg from './Seg';

interface Props {
  settings: Settings;
  probCount: number;
  realCount: number;
  loading: boolean;
  loadError: string | null;
  onStart: (s: Settings) => void;
  onHowTo: () => void;
}

export default function StartScreen({ settings, probCount, realCount, loading, loadError, onStart, onHowTo }: Props) {
  const [draft, setDraft] = useState<Settings>(settings);
  const needsReal = draft.mode !== 'prob';
  const ready = !loading && (!needsReal || realCount > 0);

  return (
    <div className="start">
      <h1>SPREAD</h1>
      <p className="tagline">Make a market. Survive the flow.</p>

      <div className="field-label">Questions</div>
      <Seg
        options={[
          { value: 'prob', label: 'Probability' },
          { value: 'real', label: 'Real world' },
          { value: 'mixed', label: 'Mixed' },
        ]}
        value={draft.mode}
        onChange={(mode) => setDraft({ ...draft, mode: mode as Settings['mode'] })}
      />

      <div className="field-label">Difficulty</div>
      <Seg
        options={[
          { value: 'easy', label: 'Easy' },
          { value: 'normal', label: 'Normal' },
          { value: 'hard', label: 'Hard' },
        ]}
        value={draft.difficulty}
        onChange={(d) => setDraft({ ...draft, difficulty: d as Settings['difficulty'] })}
      />

      <div className="field-label">Timer</div>
      <Seg
        options={[
          { value: '0', label: 'Off' },
          { value: '30', label: '30s' },
          { value: '15', label: '15s' },
        ]}
        value={String(draft.timer)}
        onChange={(t) => setDraft({ ...draft, timer: Number(t) as Settings['timer'] })}
      />

      <div className="actions">
        <button className="btn btn-brass btn-block" disabled={!ready} onClick={() => onStart(draft)}>
          {loading ? 'Loading questions…' : 'Play'}
        </button>
        <button className="btn btn-ghost btn-block" onClick={onHowTo}>How to play</button>
      </div>

      <p className="mute" style={{ textAlign: 'center', marginTop: 16, fontSize: 12 }}>
        {loadError
          ? `Real-world bank failed to load — probability only. (${loadError})`
          : <span className="num">{probCount.toLocaleString()} probability · {realCount.toLocaleString()} real-world</span>}
      </p>
    </div>
  );
}
