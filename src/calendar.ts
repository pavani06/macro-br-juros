/**
 * Reference-date probe from the dashboard's live ANBIMA lookup (mercado.ts).
 *
 * The clock is shifted by 3 hours (America/Sao_Paulo, no daylight saving since 2019)
 * and Saturday/Sunday are skipped (`getUTCDay() % 6 === 0`). Weekday holidays are
 * not on a calendar: the probe still requests that date, and a miss falls through
 * to the previous candidate, up to `days` calendar days back.
 *
 * Year fractions elsewhere are calendar days / 365.25, not business days / 252.
 * ANBIMA's own vertex column is the exception: those tenors are published in
 * business days, so du/252 is the tenor of the published grid.
 */

export function anbimaProbeDates(now: Date, days = 7): string[] {
  const out: string[] = [];
  for (let k = 0; k <= days; k++) {
    const t = new Date(now.getTime() - 3 * 3600e3 - k * 864e5);
    if (t.getUTCDay() % 6 === 0) continue;
    out.push(t.toISOString().slice(0, 10));
  }
  return out;
}

/** First probe date for which `hasData` is true. Same stop rule as the live lookup. */
export function firstProbeWithData(now: Date, hasData: (isoDate: string) => boolean, days = 7): string | null {
  for (const d of anbimaProbeDates(now, days)) {
    if (hasData(d)) return d;
  }
  return null;
}
