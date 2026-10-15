/**
 * Curve math ported from macro-brasil-dashboard lib/mercado.ts at fc22eb8.
 * Formulas are unchanged. Callers pass data in; nothing is fetched.
 */

export type Nss = readonly number[];
export type Series = [string, number][];

export type FocusRow = {
  Data: string;
  DataReferencia: string;
  Mediana: number;
  DesvioPadrao?: number;
};

/** Standard tenors. `1m` is 1/12, which equals 21/252. */
export const VERTICES: { label: string; years: number }[] = [
  { label: '1m', years: 1 / 12 },
  { label: '3m', years: 0.25 },
  { label: '6m', years: 0.5 },
  { label: '1a', years: 1 },
  { label: '2a', years: 2 },
  { label: '3a', years: 3 },
  { label: '5a', years: 5 },
  { label: '10a', years: 10 },
];

/** DI1 January contracts on the dashboard vertex table. 2030/32/34 are not in that list. */
export const DI1_YEARS = [2027, 2028, 2029, 2031, 2033, 2035] as const;

/**
 * Forward buckets hardcoded in the dashboard (not "the next N calendar years").
 * The 2031 label uses an en dash, and its Focus year is 2031.
 */
export const FORWARD_BUCKETS: { label: string; fromYear: number; toYear: number; focusYear: number }[] = [
  { label: '2027', fromYear: 2027, toYear: 2028, focusYear: 2027 },
  { label: '2028', fromYear: 2028, toYear: 2029, focusYear: 2028 },
  { label: '2029', fromYear: 2029, toYear: 2030, focusYear: 2029 },
  { label: '2030', fromYear: 2030, toYear: 2031, focusYear: 2030 },
  { label: '2031+ (2031\u201335, a.a.)', fromYear: 2031, toYear: 2036, focusYear: 2031 },
];

/** Calendar days / 365.25. The dashboard's stand-in for ANBIMA's business days / 252. */
export function yearFraction(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / (365.25 * 864e5);
}

/** Nelson-Siegel-Svensson zero rate, percent per year. `t` is floored at 1/252. */
export function nss(beta: Nss, years: number): number {
  const t = Math.max(years, 1 / 252);
  const [b1, b2, b3, b4, l1, l2] = beta;
  const f = (l: number) => (1 - Math.exp(-l * t)) / (l * t);
  return 100 * (b1 + b2 * f(l1) + b3 * (f(l1) - Math.exp(-l1 * t)) + b4 * (f(l2) - Math.exp(-l2 * t)));
}

/** Fisher identity, percent. Dashboard name: `fisher`. */
export function impliedInflation(nominalPct: number, realPct: number): number {
  return 100 * ((1 + nominalPct / 100) / (1 + realPct / 100) - 1);
}

/**
 * Linear interpolation in year fraction.
 * Flat extrapolation for up to 1.5 years past either end; NaN beyond that.
 * Points shorter than 0.05 years are dropped.
 */
export function interpolate(points: [number, number][], tenorYears: number): number {
  const pts = points.filter(([x]) => x > 0.05).sort((a, b) => a[0] - b[0]);
  if (!pts.length) return NaN;
  if (tenorYears <= pts[0][0]) return tenorYears >= pts[0][0] - 1.5 ? pts[0][1] : NaN;
  const last = pts[pts.length - 1];
  if (tenorYears >= last[0]) return tenorYears <= last[0] + 1.5 ? last[1] : NaN;
  for (let i = 1; i < pts.length; i++) {
    if (tenorYears <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (tenorYears - x0)) / (x1 - x0);
    }
  }
  return NaN;
}

/** Real NSS rate. Null below 6 months: the dashboard omits those vertices. */
export function realRate(beta: Nss, years: number): number | null {
  if (!(years >= 0.5)) return null;
  return nss(beta, years);
}

export function spotImpliedAt(nominal: Nss, real: Nss, years: number): number | null {
  if (!(years >= 0.5)) return null;
  return impliedInflation(nss(nominal, years), nss(real, years));
}

/**
 * One-year (or multi-year) forward breakeven between 1 January of `fromYear` and `toYear`.
 * Spot breakevens inside the compound use NSS even when the tenor is under 6 months.
 */
export function forwardImpliedInflation(asOf: string, nominal: Nss, real: Nss, fromYear: number, toYear: number): number {
  const cum = (y: number) => {
    const t = yearFraction(asOf, `${y}-01-01`);
    return t <= 0 ? 1 : ((1 + nss(nominal, t) / 100) / (1 + nss(real, t) / 100)) ** t;
  };
  return 100 * ((cum(toYear) / cum(fromYear)) ** (1 / yearFraction(`${fromYear}-01-01`, `${toYear}-01-01`)) - 1);
}

/** CMN inflation target, percent. From the dashboard's META(). */
export function metaCmn(year: number): number {
  if (year <= 2018) return 4.5;
  const table: Record<number, number> = { 2019: 4.25, 2020: 4.0, 2021: 3.75, 2022: 3.5, 2023: 3.25 };
  return table[year] ?? 3.0;
}

/**
 * Latest Focus median for a reference year in the rows you pass.
 * The dashboard does not clip this to the curve date; pass only rows you want considered.
 */
export function focusMedian(rows: readonly FocusRow[], year: number): number | null {
  let best: FocusRow | undefined;
  for (const r of rows) {
    if (+r.DataReferencia !== year) continue;
    if (!best || r.Data > best.Data) best = r;
  }
  return best ? best.Mediana : null;
}

/** ETTJ nominal slope, 5y minus 1y, percentage points. */
export function ettjSlope(nominal: Nss): number {
  return nss(nominal, 5) - nss(nominal, 1);
}

/**
 * Last value with date <= asOf, walking in array order and stopping at the first later date.
 * Matches the dashboard's forward pointer. The series must be chronological, as SGS returns it.
 */
export function carryValue(series: Series, asOf: string): number {
  let cur = NaN;
  for (const [d, v] of series) {
    if (d <= asOf) cur = v;
    else break;
  }
  return cur;
}

/** Focus medians carried forward to asOf, one value per reference year. */
export function carryFocus(rows: readonly FocusRow[], asOf: string): Map<number, number> {
  const byDate = new Map<string, Map<number, number>>();
  for (const r of rows) {
    let bucket = byDate.get(r.Data);
    if (!bucket) {
      bucket = new Map();
      byDate.set(r.Data, bucket);
    }
    bucket.set(+r.DataReferencia, r.Mediana);
  }
  const cur = new Map<number, number>();
  for (const d of [...byDate.keys()].sort()) {
    if (d > asOf) break;
    for (const [y, v] of byDate.get(d)!) cur.set(y, v);
  }
  return cur;
}

/**
 * Average of a piecewise-linear Selic path over the next year, sampled every 5 days
 * from today through day 365, minus 0.10 (CDI ≈ Selic − 0.10).
 * The path runs from the current meta to Focus at 31 Dec this year, then to Focus at 31 Dec next year.
 */
export function expectedCdi(asOf: string, selicMeta: number, focusThisYear: number, focusNextYear: number): number {
  const y = +asOf.slice(0, 4);
  const t0 = Date.parse(asOf);
  const tA = Date.parse(`${y}-12-31`);
  const tB = Date.parse(`${y + 1}-12-31`);
  let sum = 0;
  let n = 0;
  for (let k = 0; k <= 365; k += 5) {
    const t = t0 + k * 864e5;
    const v =
      t <= tA
        ? selicMeta + ((focusThisYear - selicMeta) * (t - t0)) / Math.max(tA - t0, 1)
        : t <= tB
          ? focusThisYear + ((focusNextYear - focusThisYear) * (t - tA)) / (tB - tA)
          : focusNextYear;
    sum += v;
    n++;
  }
  return sum / n - 0.1;
}

export type TesouroBond = {
  type: 'PRE' | 'REAL';
  /** True for the "com Juros Semestrais" lines. Zero and coupon bonds are interpolated together. */
  coupon: boolean;
  maturity: string;
  rate: number;
};

export type TesouroMetrics = {
  nominal1y: number;
  nominal2y: number;
  nominal5y: number;
  nominal10y: number;
  real2y: number;
  real5y: number;
  real10y: number;
  implied2y: number;
  implied5y: number;
  implied10y: number;
  slope5y1y: number;
  cdiExpected: number | null;
  termPremium: number | null;
};

/** Tesouro Direto curve: interpolated nominal and real, breakevens, slope, and term premium. */
export function tesouroMetrics(asOf: string, bonds: readonly TesouroBond[], focusSelic: readonly FocusRow[], selicMeta: Series): TesouroMetrics {
  const pre = bonds.filter((b) => b.type === 'PRE').map((b) => [yearFraction(asOf, b.maturity), b.rate] as [number, number]);
  const real = bonds.filter((b) => b.type === 'REAL').map((b) => [yearFraction(asOf, b.maturity), b.rate] as [number, number]);
  const p = (t: number) => interpolate(pre, t);
  const q = (t: number) => interpolate(real, t);
  const nominal1y = p(1);
  const nominal2y = p(2);
  const nominal5y = p(5);
  const nominal10y = p(10);
  const real2y = q(2);
  const real5y = q(5);
  const real10y = q(10);
  const focus = carryFocus(focusSelic, asOf);
  const y = +asOf.slice(0, 4);
  const fY = focus.get(y);
  const fY1 = focus.get(y + 1);
  const curS = carryValue(selicMeta, asOf);
  let cdiExpected: number | null = null;
  let termPremium: number | null = null;
  if (Number.isFinite(curS) && fY != null && fY1 != null) {
    cdiExpected = expectedCdi(asOf, curS, fY, fY1);
    if (Number.isFinite(nominal1y)) termPremium = nominal1y - cdiExpected;
  }
  return {
    nominal1y,
    nominal2y,
    nominal5y,
    nominal10y,
    real2y,
    real5y,
    real10y,
    implied2y: impliedInflation(nominal2y, real2y),
    implied5y: impliedInflation(nominal5y, real5y),
    implied10y: impliedInflation(nominal10y, real10y),
    slope5y1y: nominal5y - nominal1y,
    cdiExpected,
    termPremium,
  };
}

export type CurvePoint = {
  label: string;
  years: number;
  nominal: number;
  real: number | null;
  implied: number | null;
};

export function curvePoints(asOf: string, nominal: Nss, real: Nss): CurvePoint[] {
  const points: CurvePoint[] = VERTICES.map(({ label, years }) => ({
    label,
    years,
    nominal: nss(nominal, years),
    real: realRate(real, years),
    implied: spotImpliedAt(nominal, real, years),
  }));
  for (const y of DI1_YEARS) {
    const years = yearFraction(asOf, `${y}-01-02`);
    const label = `DI1 jan/${String(y).slice(2)}`;
    points.push({
      label,
      years,
      nominal: nss(nominal, years),
      real: realRate(real, years),
      implied: spotImpliedAt(nominal, real, years),
    });
  }
  return points;
}

export type ForwardPoint = {
  label: string;
  breakeven: number;
  focus: number | null;
  meta: number;
};

export function forwardPoints(asOf: string, nominal: Nss, real: Nss, focusIpca: readonly FocusRow[]): ForwardPoint[] {
  return FORWARD_BUCKETS.map((b) => ({
    label: b.label,
    breakeven: forwardImpliedInflation(asOf, nominal, real, b.fromYear, b.toYear),
    focus: focusMedian(focusIpca, b.focusYear),
    meta: metaCmn(+b.label.slice(0, 4)),
  }));
}
