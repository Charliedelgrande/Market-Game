import { useState } from 'react';
import type { Settings } from '../types';
import Seg from './Seg';

interface Props {
  settings: Settings;
  inSession: boolean;
  onApply: (s: Settings) => void;
  onClose: () => void;
}

export default function SettingsSheet({ settings, inSession, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<Settings>(settings);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        {inSession && <p className="note">Changes apply from the next question.</p>}

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

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="btn btn-block" onClick={onClose}>Cancel</button>
          <button className="btn btn-brass btn-block" onClick={() => onApply(draft)}>Apply</button>
        </div>
      </div>
    </div>
  );
}
