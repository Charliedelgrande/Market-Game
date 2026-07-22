import type { Question, Tier } from '../types';

interface RawEntry {
  id?: unknown; prompt?: unknown; value?: unknown; source?: unknown;
  asOf?: unknown; tier?: unknown; magnitude?: unknown;
}

/** Load the bundled real-world question bank (a static asset of this app —
 *  the app makes no external network calls at runtime). */
export async function loadRealWorldQuestions(): Promise<Question[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}questions-realworld.json`);
  if (!res.ok) throw new Error(`failed to load question bank: ${res.status}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error('question bank is not an array');
  const out: Question[] = [];
  for (const e of data as RawEntry[]) {
    if (
      typeof e.id !== 'string' ||
      typeof e.prompt !== 'string' ||
      typeof e.value !== 'number' ||
      !Number.isFinite(e.value) ||
      e.value <= 0 ||
      ![1, 2, 3].includes(e.tier as number)
    ) continue;
    out.push({
      id: e.id,
      mode: 'real',
      prompt: e.prompt,
      value: e.value,
      tier: e.tier as Tier,
      source: typeof e.source === 'string' ? e.source : undefined,
      asOf: typeof e.asOf === 'string' ? e.asOf : undefined,
      magnitude: typeof e.magnitude === 'number' ? e.magnitude : undefined,
    });
  }
  return out;
}
