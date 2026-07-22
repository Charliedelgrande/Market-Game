# Spread — market-making practice

Quote two-sided markets on probability and real-world estimation questions
against a bot that is sometimes informed and sometimes noise. Client-side
only: no auth, no backend, no persistence — state lives in memory and resets
on reload. Installable as an iOS PWA (Safari → Share → Add to Home Screen).

## Commands

| command | what it does |
| --- | --- |
| `npm run dev` | dev server on :5173 |
| `npm test` | Monte Carlo verification of every probability template (200k trials, 1% tolerance) |
| `npm run build` | typecheck + production build to `dist/` |
| `npm run icons` | regenerate PWA icons (dependency-free PNG encoder) |
| `npm run generate:realworld` | refresh the real-world question bank from World Bank / Wikidata / Overpass (build-time only; merges with the hand-checked starter set, never overwrites it) |

## How it works

- **Questions** — ~1,200 probability questions are generated procedurally at
  startup with exact expected values (enumeration or closed form, never
  approximation); real-world questions ship as a static JSON in `public/`
  with source and as-of date. Drawn without replacement per session.
- **Bot** — informed with probability *p* (difficulty dial), else noise.
  Informed flow trades the side where your quote is mispriced, sized by edge
  in spread units. Easy `p=.25 T=.15` · Normal `p=.50 T=.05` · Hard `p=.80 T=0`.
- **Scoring** — bot buys your ask → you're short → `(ask − V) × size`; bot
  sells your bid → you're long → `(V − bid) × size`. Real-world rounds are
  normalized to % of true value; raw P&L is never summed across modes.
- **Stats** — containment rate, spread width, signed centering bias, adverse
  selection split (informed vs noise), accuracy by tier, carried inventory
  marked to the latest true value.

The app makes zero external network calls at runtime; the only fetch is its
own bundled question JSON, which the service worker caches for offline use.
