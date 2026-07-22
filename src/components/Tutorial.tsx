import { useState } from 'react';

interface Props {
  onClose: () => void;
}

const SLIDES: { title: string; body: JSX.Element }[] = [
  {
    title: 'You quote two sides',
    body: (
      <>
        <p>
          Each round asks for a single number. You don't answer it directly —
          you post a <strong>bid</strong> (the price you'll buy at) and an{' '}
          <strong>ask</strong> (the price you'll sell at), with bid below ask.
        </p>
        <div className="ex num">
          Q: expected sum of two dice?<br />
          Your quote: <span className="up">6.5 bid</span> / <span className="down">7.5 ask</span>
        </div>
        <p>A trading bot then decides whether to hit your bid or lift your ask.</p>
      </>
    ),
  },
  {
    title: 'Mid is your estimate, spread is your margin',
    body: (
      <>
        <p>
          The midpoint of your quote is your best estimate of the true value.
          The spread around it is the margin you charge for being wrong.
        </p>
        <p>
          Confident? Quote tight and earn more on noise flow. Unsure? Widen out —
          a wide spread is protection, not cowardice. What kills you is a{' '}
          <em>mis-centered</em> quote: a tight spread around the wrong number.
        </p>
      </>
    ),
  },
  {
    title: 'The bot picks the side that hurts you',
    body: (
      <>
        <p>
          Some rounds the bot is <strong>informed</strong> — it knows the true
          value. If your ask is below true value it buys from you; if your bid is
          above true value it sells to you. It only ever trades the side where{' '}
          <em>you</em> are mispriced, and it sizes up when your error is big.
        </p>
        <p>
          That's adverse selection: informed flow only shows up when you're wrong.
          The rest of the time you face harmless noise flow — that's where your
          spread earns its keep.
        </p>
      </>
    ),
  },
  {
    title: 'Quote the mean, not the most likely value',
    body: (
      <>
        <p>
          Center your quote on the <strong>expected value</strong> — the
          probability-weighted average — not the most likely outcome.
        </p>
        <div className="ex num">
          Max of three dice: most likely outcome 6,<br />
          expected value ≈ 4.96
        </div>
        <p>
          Skewed questions punish quoting the mode. Over many rounds, only the
          mean keeps your P&L centered at zero against informed flow.
        </p>
      </>
    ),
  },
  {
    title: 'How P&L is computed',
    body: (
      <>
        <p>Trades settle against the true value V:</p>
        <div className="ex num">
          Bot buys at your ask A → you are short:<br />
          P&L = (A − V) × size<br /><br />
          Bot sells at your bid B → you are long:<br />
          P&L = (V − B) × size
        </div>
        <p>
          Real-world rounds are scored as a percentage of the true value so huge
          numbers can't dominate. Your position carries across rounds and is
          marked to the latest true value.
        </p>
      </>
    ),
  },
];

export default function Tutorial({ onClose }: Props) {
  const [i, setI] = useState(0);
  const lastSlide = i === SLIDES.length - 1;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet tut" onClick={(e) => e.stopPropagation()}>
        <div className="body">
          <h2>{SLIDES[i].title}</h2>
          {SLIDES[i].body}
        </div>
        <div className="dots">
          {SLIDES.map((_, j) => <span key={j} className={j === i ? 'on' : ''} />)}
        </div>
        <div className="nav">
          {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>Back</button>}
          <button
            className="btn btn-brass"
            onClick={() => (lastSlide ? onClose() : setI(i + 1))}
          >
            {lastSlide ? "Let's trade" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
