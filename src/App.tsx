import { useEffect, useMemo, useReducer, useState } from 'react';
import { generateProbabilityPool } from './lib/probability';
import { loadRealWorldQuestions } from './lib/realworld';
import { shuffle } from './lib/rng';
import { initialState, reducer } from './state';
import type { Question, Settings } from './types';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import StatsScreen from './components/StatsScreen';
import SettingsSheet from './components/SettingsSheet';
import Tutorial from './components/Tutorial';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  // ~1200 procedural probability questions, generated once at startup
  const probPool = useMemo(() => generateProbabilityPool(1200), []);
  const [realPool, setRealPool] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // No persistence by design: the tutorial auto-opens once per session.
  const [showTutorial, setShowTutorial] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadRealWorldQuestions().then(setRealPool, (e) => setLoadError(String(e)));
  }, []);

  const start = (settings: Settings) => {
    dispatch({
      type: 'start',
      settings,
      probQueue: shuffle(probPool),
      realQueue: shuffle(realPool ?? []),
    });
  };

  const applySettings = (settings: Settings) => {
    dispatch({ type: 'updateSettings', settings });
    setShowSettings(false);
  };

  return (
    <div className="app">
      {state.screen === 'start' && (
        <StartScreen
          settings={state.settings}
          probCount={probPool.length}
          realCount={realPool?.length ?? 0}
          loading={realPool === null && !loadError}
          loadError={loadError}
          onStart={start}
          onHowTo={() => setShowTutorial(true)}
        />
      )}
      {state.screen === 'game' && (
        <GameScreen
          state={state}
          dispatch={dispatch}
          onOpenSettings={() => setShowSettings(true)}
          onOpenHelp={() => setShowTutorial(true)}
        />
      )}
      {state.screen === 'stats' && (
        <StatsScreen rounds={state.rounds} inv={state.inv} onAgain={() => dispatch({ type: 'reset' })} />
      )}

      {showSettings && (
        <SettingsSheet
          settings={state.pendingSettings ?? state.settings}
          inSession={state.screen === 'game'}
          onApply={applySettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
    </div>
  );
}
