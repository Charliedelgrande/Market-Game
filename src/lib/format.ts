/** Format a number for display: grouped, trimmed to a sensible precision. */
export function fmt(x: number, maxDecimals = 3): string {
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  let decimals: number;
  if (abs >= 1000) decimals = Math.min(1, maxDecimals);
  else if (abs >= 100) decimals = Math.min(1, maxDecimals);
  else if (abs >= 1) decimals = Math.min(2, maxDecimals);
  else decimals = maxDecimals;
  return x.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/** Signed formatting with an arrow glyph, so meaning survives color blindness. */
export function fmtSigned(x: number, maxDecimals = 2): string {
  const sign = x > 0 ? '+' : x < 0 ? '−' : '';
  const arrow = x > 0 ? ' ▲' : x < 0 ? ' ▼' : '';
  return `${sign}${fmt(Math.abs(x), maxDecimals)}${arrow}`;
}

export function pnlClass(x: number): string {
  return x > 0 ? 'up' : x < 0 ? 'down' : 'dim';
}

export function fmtPct(x: number | null, decimals = 1): string {
  if (x === null || !Number.isFinite(x)) return '—';
  return `${x.toFixed(decimals)}%`;
}
