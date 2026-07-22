import type { Inventory, RoundRecord } from '../types';
import { computeStats } from '../lib/scoring';
import { fmt, fmtPct, fmtSigned, pnlClass } from '../lib/format';

interface Props {
  rounds: RoundRecord[];
  inv: Inventory;
  onAgain: () => void;
}

export default function StatsScreen({ rounds, inv, onAgain }: Props) {
  const s = computeStats(rounds);
  const mtm = inv.pos !== 0 && inv.lastV !== null ? (inv.lastV - inv.avgEntry) * inv.pos : 0;

  return (
    <div className="stats">
      <h2>Session summary</h2>

      <div className="statgrid">
        <div className="statcell">
          <div className="lab">Total score</div>
          <div className={`val num ${pnlClass(s.totalScore)}`}>{fmtSigned(s.totalScore)}</div>
          <div className="sub num">{s.rounds} rounds · {s.trades} trades · {s.timeouts} timeouts</div>
        </div>
        <div className="statcell">
          <div className="lab">Containment</div>
          <div className="val num">{s.containment === null ? '—' : fmtPct(s.containment * 100, 0)}</div>
          <div className="sub">quotes where bid ≤ V ≤ ask</div>
        </div>
        <div className="statcell">
          <div className="lab">Avg spread width</div>
          <div className="val num">{fmtPct(s.avgSpreadPct)}</div>
          <div className="sub">of true value</div>
        </div>
        <div className="statcell">
          <div className="lab">Centering error</div>
          <div className="val num">
            {s.centeringPct === null ? '—' : fmtSigned(s.centeringPct)}
          </div>
          <div className="sub">mean (mid − V) / V — signed bias</div>
        </div>
      </div>

      <h3>By mode <span className="mute">(raw is never summed across modes)</span></h3>
      <div className="statgrid">
        <div className="statcell">
          <div className="lab">Probability</div>
          <div className={`val num ${pnlClass(s.prob.score)}`}>{fmtSigned(s.prob.score)}</div>
          <div className="sub num">{s.prob.rounds} rounds · raw P&L {fmtSigned(s.prob.raw)}</div>
        </div>
        <div className="statcell">
          <div className="lab">Real world</div>
          <div className={`val num ${pnlClass(s.real.score)}`}>{fmtSigned(s.real.score)}</div>
          <div className="sub num">{s.real.rounds} rounds · raw {fmtSigned(s.real.raw)} (units vary)</div>
        </div>
      </div>

      <h3>Adverse selection</h3>
      <div className="statgrid">
        <div className="statcell">
          <div className="lab">vs informed flow</div>
          <div className={`val num ${pnlClass(s.informed.score)}`}>{fmtSigned(s.informed.score)}</div>
          <div className="sub num">{s.informed.rounds} rounds · {s.informed.trades} trades</div>
        </div>
        <div className="statcell">
          <div className="lab">vs noise flow</div>
          <div className={`val num ${pnlClass(s.noise.score)}`}>{fmtSigned(s.noise.score)}</div>
          <div className="sub num">{s.noise.rounds} rounds · {s.noise.trades} trades</div>
        </div>
      </div>

      <h3>Accuracy by tier</h3>
      <table className="tiertable num">
        <thead>
          <tr><th>Tier</th><th>Rounds</th><th>Contained</th><th>|Center err|</th><th>Score</th></tr>
        </thead>
        <tbody>
          {s.byTier.filter((t) => t.rounds > 0).map((t) => (
            <tr key={t.tier}>
              <td>Tier {t.tier}</td>
              <td>{t.rounds}</td>
              <td>{t.containment === null ? '—' : fmtPct(t.containment * 100, 0)}</td>
              <td>{t.meanAbsCenteringPct === null ? '—' : fmtPct(t.meanAbsCenteringPct)}</td>
              <td className={pnlClass(t.score)}>{fmtSigned(t.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {inv.pos !== 0 && (
        <>
          <h3>Open inventory</h3>
          <div className="statgrid">
            <div className="statcell">
              <div className="lab">Position</div>
              <div className="val num">{inv.pos > 0 ? '+' : ''}{inv.pos} @ {fmt(inv.avgEntry)}</div>
              <div className={`sub num ${pnlClass(mtm)}`}>MTM {fmtSigned(mtm)} vs last value</div>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 24 }}>
        <button className="btn btn-brass btn-block" onClick={onAgain}>Play again</button>
      </div>
    </div>
  );
}
