/**
 * Offline generator for the real-world question bank.
 *
 * Runs at build time only — the app itself makes zero network calls at
 * runtime. Queries World Bank Indicators, Wikidata SPARQL, OpenStreetMap
 * Overpass, and (optionally) Google Data Commons using parameterized
 * templates with slots filled from the validated lists below — never
 * free-form generation.
 *
 * Every candidate is rejected unless its value is a finite, positive number
 * inside the template's plausible magnitude band. Every accepted question
 * records its source and as-of date.
 *
 * Usage: node scripts/generate-realworld.mjs [--out public/questions-realworld.json]
 * Env:   DC_API_KEY  (optional, enables Data Commons templates)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'public/questions-realworld.json';

// Wikidata's query service rejects UAs without contact info
const UA = 'SpreadQuestionBot/0.1 (offline question generator for a practice game; contact: c60909956@gmail.com)';

// ---------------------------------------------------------------------------
// Validated slot lists
// ---------------------------------------------------------------------------

// ISO3 code, display name, tier (1 famous .. 3 obscure)
const COUNTRIES = [
  ['USA', 'the United States', 1], ['CHN', 'China', 1], ['IND', 'India', 1],
  ['IDN', 'Indonesia', 2], ['PAK', 'Pakistan', 2], ['BRA', 'Brazil', 1],
  ['NGA', 'Nigeria', 2], ['BGD', 'Bangladesh', 2], ['RUS', 'Russia', 1],
  ['MEX', 'Mexico', 2], ['JPN', 'Japan', 1], ['ETH', 'Ethiopia', 3],
  ['PHL', 'the Philippines', 2], ['EGY', 'Egypt', 2], ['VNM', 'Vietnam', 2],
  ['DEU', 'Germany', 1], ['TUR', 'Turkey', 2], ['IRN', 'Iran', 3],
  ['THA', 'Thailand', 2], ['GBR', 'the United Kingdom', 1], ['FRA', 'France', 1],
  ['ITA', 'Italy', 2], ['ZAF', 'South Africa', 2], ['KOR', 'South Korea', 2],
  ['COL', 'Colombia', 3], ['ESP', 'Spain', 2], ['ARG', 'Argentina', 2],
  ['DZA', 'Algeria', 3], ['UKR', 'Ukraine', 2], ['CAN', 'Canada', 1],
  ['POL', 'Poland', 2], ['MAR', 'Morocco', 3], ['SAU', 'Saudi Arabia', 2],
  ['PER', 'Peru', 3], ['AUS', 'Australia', 1], ['MYS', 'Malaysia', 3],
  ['GHA', 'Ghana', 3], ['NPL', 'Nepal', 3], ['VEN', 'Venezuela', 3],
  ['CHL', 'Chile', 3], ['NLD', 'the Netherlands', 2], ['ECU', 'Ecuador', 3],
  ['KHM', 'Cambodia', 3], ['SEN', 'Senegal', 3], ['BEL', 'Belgium', 3],
  ['GRC', 'Greece', 2], ['PRT', 'Portugal', 2], ['SWE', 'Sweden', 2],
  ['CHE', 'Switzerland', 2], ['AUT', 'Austria', 3], ['ISR', 'Israel', 2],
  ['NOR', 'Norway', 3], ['IRL', 'Ireland', 3], ['NZL', 'New Zealand', 2],
  ['SGP', 'Singapore', 2], ['DNK', 'Denmark', 3], ['FIN', 'Finland', 3],
  ['ISL', 'Iceland', 3],
  ['KEN', 'Kenya', 3], ['TZA', 'Tanzania', 3], ['UGA', 'Uganda', 3],
  ['IRQ', 'Iraq', 3], ['AFG', 'Afghanistan', 3], ['ROU', 'Romania', 3],
  ['CZE', 'Czechia', 3], ['HUN', 'Hungary', 3], ['LKA', 'Sri Lanka', 3],
  ['MMR', 'Myanmar', 3], ['UZB', 'Uzbekistan', 3], ['KAZ', 'Kazakhstan', 3],
  ['CUB', 'Cuba', 3], ['BOL', 'Bolivia', 3], ['PRY', 'Paraguay', 3],
  ['URY', 'Uruguay', 3], ['PAN', 'Panama', 3], ['CRI', 'Costa Rica', 3],
  ['JOR', 'Jordan', 3], ['TUN', 'Tunisia', 3], ['OMN', 'Oman', 3],
  ['KWT', 'Kuwait', 3], ['QAT', 'Qatar', 3], ['ARE', 'the United Arab Emirates', 2],
  ['MNG', 'Mongolia', 3],
];

// Wikidata QIDs with expected property and display name
const MOUNTAINS = [
  ['Q513', 'Mount Everest', 1], ['Q43512', 'K2', 2], ['Q1519', 'Kangchenjunga', 3],
  ['Q5451', 'Lhotse', 3], ['Q5470', 'Makalu', 3], ['Q130018', 'Denali', 2],
  ['Q39739', 'Aconcagua', 3], ['Q7296', 'Mount Kilimanjaro', 2],
  ['Q583', 'Mont Blanc', 2], ['Q3735', 'Matterhorn', 3], ['Q39231', 'Mount Fuji', 2],
];
const RIVERS = [
  ['Q3392', 'Nile', 1], ['Q3783', 'Amazon', 2], ['Q5413', 'Yangtze', 2],
  ['Q3184', 'Mekong', 3], ['Q1497', 'Mississippi', 3], ['Q626', 'Volga', 3],
  ['Q1653', 'Danube', 2], ['Q584', 'Rhine', 3], ['Q1471', 'Seine', 3],
  ['Q19686', 'Thames', 3],
];
const BUILDINGS = [
  ['Q12495', 'Burj Khalifa', 1], ['Q57965', 'Shanghai Tower', 2],
  ['Q243', 'Eiffel Tower', 1], ['Q9188', 'Empire State Building', 2],
  ['Q11259', 'One World Trade Center', 2], ['Q18712', 'Taipei 101', 3],
  ['Q83063', 'Petronas Towers', 2], ['Q172822', 'Tokyo Skytree', 2],
  ['Q131013', 'CN Tower', 3],
];

// Overpass: count subway stations inside a named city area
const OSM_CITIES = [
  ['London', 3], ['Paris', 3], ['Berlin', 3], ['Madrid', 3], ['Vienna', 3],
];

// World Bank indicator, prompt template, unit divisor, magnitude band (on the
// scaled value), tier bump, as-of preference
const WB_TEMPLATES = [
  {
    ind: 'SP.POP.TOTL',
    prompt: (c) => `Population of ${c}, in millions of people?`,
    scale: 1e6, band: [0.05, 2000],
  },
  {
    ind: 'NY.GDP.MKTP.CD',
    prompt: (c) => `Nominal GDP of ${c}, in billions of US dollars?`,
    scale: 1e9, band: [1, 40000], tierBump: 1,
  },
  {
    ind: 'SP.DYN.LE00.IN',
    prompt: (c) => `Life expectancy at birth in ${c}, in years?`,
    scale: 1, band: [40, 100], tierBump: 1,
  },
  {
    ind: 'EN.POP.DNST',
    prompt: (c) => `Population density of ${c}, in people per square kilometer?`,
    scale: 1, band: [1, 10000], tierBump: 1,
  },
  {
    ind: 'AG.SRF.TOTL.K2',
    prompt: (c) => `Total surface area of ${c}, in thousands of square kilometers?`,
    scale: 1e3, band: [0.1, 20000], tierBump: 1,
  },
];

// ---------------------------------------------------------------------------

const questions = [];
let seq = 0;

// Prompts of the hand-checked starter set: generated questions about the same
// entity are skipped so a fetch quirk can never contradict a checked fact.
let HAND_PROMPTS = [];
try {
  HAND_PROMPTS = JSON.parse(readFileSync(OUT, 'utf8'))
    .filter((q) => !q.id.startsWith('rw-gen-'))
    .map((q) => q.prompt.toLowerCase());
} catch { /* no existing bank */ }

function accept({ prompt, value, source, asOf, tier, band, entity }) {
  if (entity && HAND_PROMPTS.some((p) => p.includes(entity.toLowerCase()))) return false;
  if (value === null || value === undefined) return false;
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return false;
  if (band && (v < band[0] || v > band[1])) return false; // implausible magnitude
  const rounded = Number(v.toPrecision(4)); // clean quoting targets, no fake precision
  questions.push({
    id: `rw-gen-${String(++seq).padStart(4, '0')}`,
    prompt,
    value: rounded,
    source,
    asOf: String(asOf),
    tier: Math.min(3, Math.max(1, tier)),
    magnitude: Math.round(Math.log10(v)),
  });
  return true;
}

async function getJson(url, opts = {}, tries = 3) {
  const { headers: extraHeaders, ...rest } = opts;
  for (let i = 1; ; i++) {
    const res = await fetch(url, { ...rest, headers: { 'User-Agent': UA, ...(extraHeaders ?? {}) } });
    if (res.ok) return res.json();
    if (i >= tries) throw new Error(`${res.status} ${url}`);
    // rate-limit bans (Wikidata 403, Overpass 429) need a long cool-down
    const throttled = res.status === 403 || res.status === 429;
    await sleep(throttled ? 30000 * i : 1500 * i);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// World Bank Indicators
// ---------------------------------------------------------------------------

async function fromWorldBank() {
  // the API rejects very long country lists — chunk them
  const chunks = [];
  for (let i = 0; i < COUNTRIES.length; i += 30) chunks.push(COUNTRIES.slice(i, i + 30));
  for (const t of WB_TEMPLATES) {
    for (const chunk of chunks) {
      const codes = chunk.map(([iso]) => iso).join(';');
      const url = `https://api.worldbank.org/v2/country/${codes}/indicator/${t.ind}?format=json&mrnev=1&per_page=400`;
      try {
        const [, rows] = await getJson(url);
        for (const row of rows ?? []) {
          const entry = COUNTRIES.find(([iso]) => iso === row.countryiso3code);
          if (!entry) continue;
          const [, name, tier] = entry;
          accept({
            prompt: t.prompt(name),
            value: row.value === null ? null : row.value / t.scale,
            source: `World Bank ${t.ind}`,
            asOf: row.date,
            tier: tier + (t.tierBump ?? 0),
            band: t.band,
          });
        }
      } catch (e) {
        console.error(`world bank ${t.ind} failed: ${e.message}`);
      }
      await sleep(400);
    }
  }
}

// ---------------------------------------------------------------------------
// Wikidata SPARQL
// ---------------------------------------------------------------------------

async function wikidataProperty(list, prop, promptFor, band, unitScale = 1) {
  // The prompt uses the label Wikidata itself reports for the QID, so a wrong
  // QID in the slot list can never mislabel a fact — it just gets rejected or
  // shows under its true name.
  const values = list.map(([q]) => `wd:${q}`).join(' ');
  const sparql = `SELECT ?item ?itemLabel ?v WHERE { VALUES ?item { ${values} } ?item wdt:${prop} ?v . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
  try {
    const data = await getJson(url, { headers: { Accept: 'application/sparql-results+json' } });
    const byQ = new Map();
    for (const b of data.results.bindings) {
      const qid = b.item.value.split('/').pop();
      if (!byQ.has(qid)) byQ.set(qid, { v: Number(b.v.value), label: b.itemLabel?.value });
    }
    const norm = (s) => s.toLowerCase().replace(/^(the|mount|mt\.?)\s+/, '').replace(/\s+(river|tower)$/, '').trim();
    for (const [qid, expectedName, tier] of list) {
      const hit = byQ.get(qid);
      if (!hit || !hit.label || /^Q\d+$/.test(hit.label)) continue;
      // a QID whose label disagrees with the slot list is a wrong QID — reject
      if (!norm(hit.label).includes(norm(expectedName)) && !norm(expectedName).includes(norm(hit.label))) {
        console.error(`skip ${qid}: label "${hit.label}" != expected "${expectedName}"`);
        continue;
      }
      const cleanLabel = hit.label.replace(/\s+river$/i, '');
      accept({
        prompt: promptFor(cleanLabel),
        value: hit.v * unitScale,
        source: `Wikidata ${prop} (${qid})`,
        asOf: new Date().toISOString().slice(0, 10),
        tier,
        band,
        entity: cleanLabel,
      });
    }
  } catch (e) {
    console.error(`wikidata ${prop} failed: ${e.message}`);
  }
  await sleep(1000);
}

async function fromWikidata() {
  await wikidataProperty(MOUNTAINS, 'P2044', (n) => `Height of ${n} above sea level, in meters?`, [1000, 9500]);
  await wikidataProperty(RIVERS, 'P2043', (n) => `Length of the ${n} river, in kilometers?`, [100, 8000]);
  await wikidataProperty(BUILDINGS, 'P2048', (n) => `Height of the ${n}, in meters?`, [100, 1200]);
}

// ---------------------------------------------------------------------------
// OpenStreetMap Overpass
// ---------------------------------------------------------------------------

async function fromOverpass() {
  for (const [city, tier] of OSM_CITIES) {
    const query = `[out:json][timeout:60];area[name="${city}"][boundary=administrative][admin_level~"^(4|5|6|8)$"]->.a;node(area.a)[railway=station][station=subway];out count;`;
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const count = Number(data.elements?.[0]?.tags?.total);
      accept({
        prompt: `Number of subway/metro stations mapped in OpenStreetMap within ${city}?`,
        value: count,
        source: 'OpenStreetMap Overpass',
        asOf: new Date().toISOString().slice(0, 10),
        tier,
        band: [10, 1000],
      });
    } catch (e) {
      console.error(`overpass ${city} failed: ${e.message}`);
    }
    await sleep(2000); // be polite to Overpass
  }
}

// ---------------------------------------------------------------------------
// Google Data Commons (optional — needs DC_API_KEY)
// ---------------------------------------------------------------------------

const US_STATES = [
  ['geoId/06', 'California', 1], ['geoId/48', 'Texas', 2], ['geoId/12', 'Florida', 2],
  ['geoId/36', 'New York State', 2], ['geoId/17', 'Illinois', 3], ['geoId/53', 'Washington State', 3],
];

async function fromDataCommons() {
  const key = process.env.DC_API_KEY;
  if (!key) { console.log('DC_API_KEY not set — skipping Data Commons'); return; }
  for (const [dcid, name, tier] of US_STATES) {
    const url = `https://api.datacommons.org/v2/observation?key=${key}&entity.dcids=${dcid}&variable.dcids=Count_Person&select=entity&select=variable&select=value&select=date`;
    try {
      const data = await getJson(url);
      const series = data.byVariable?.Count_Person?.byEntity?.[dcid]?.orderedFacets?.[0];
      const obs = series?.observations?.at(-1);
      accept({
        prompt: `Population of ${name}, in millions of people?`,
        value: obs ? obs.value / 1e6 : null,
        source: 'Google Data Commons Count_Person',
        asOf: obs?.date ?? 'unknown',
        tier,
        band: [0.3, 60],
      });
    } catch (e) {
      console.error(`data commons ${dcid} failed: ${e.message}`);
    }
    await sleep(300);
  }
}

// ---------------------------------------------------------------------------

const before = Date.now();
await fromWorldBank();
await fromWikidata();
await fromOverpass();
await fromDataCommons();

if (questions.length < 50) {
  console.error(`only ${questions.length} questions generated — refusing to touch ${OUT}`);
  process.exit(1);
}

// Merge with the existing bank: hand-checked starter questions (rw-*) are
// kept as-is; generated ones (rw-gen-*) are replaced by this run. Dedupe by
// prompt with the hand-checked version winning.
let existing = [];
try {
  existing = JSON.parse(readFileSync(OUT, 'utf8')).filter((q) => !q.id.startsWith('rw-gen-'));
} catch { /* no existing bank */ }
const seen = new Set(existing.map((q) => q.prompt));
const merged = existing.concat(
  questions.filter((q) => (seen.has(q.prompt) ? false : (seen.add(q.prompt), true))),
);

writeFileSync(OUT, JSON.stringify(merged, null, 1));
console.log(
  `wrote ${merged.length} questions (${existing.length} hand-checked + ${merged.length - existing.length} generated) ` +
  `to ${OUT} in ${((Date.now() - before) / 1000).toFixed(1)}s`,
);
