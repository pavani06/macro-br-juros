/**
 * Parsers for the inputs the dashboard reads. Strings in, data out.
 * NSS parameter parsing matches the live CZ loop: first comma becomes a decimal point.
 */

import type { FocusRow, Nss, Series, TesouroBond } from './curve.js';

export type EttjDay = { PRE?: number[]; IPCA?: number[] };

export type PublishedVertex = {
  businessDays: number;
  /** Null when that column is blank (long IPCA vertices have no nominal rate). */
  nominal: number | null;
  real: number | null;
  implied: number | null;
};

export type BondFitError = {
  title: string;
  maturity: string;
  /** ANBIMA "Erro Título a Título", percentage points. */
  errorPp: number;
};

export type AnbimaCurveFile = {
  pre?: number[];
  ipca?: number[];
  vertices: PublishedVertex[];
  bondErrors: BondFitError[];
};

function brazilianNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/[eE]/.test(s)) {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Live CZ-down.asp parameters. Later PREFIXADOS / IPCA rows overwrite earlier ones. */
export function parseAnbimaCzParams(text: string): { pre?: number[]; ipca?: number[] } {
  const out: { pre?: number[]; ipca?: number[] } = {};
  for (const l of text.split(/\r?\n/)) {
    const c = l.split(';');
    if ((c[0] === 'PREFIXADOS' || c[0] === 'IPCA') && c.length >= 7) {
      const beta = c.slice(1, 7).map((x) => +x.replace(',', '.'));
      if (c[0] === 'IPCA') out.ipca = beta;
      else out.pre = beta;
    }
  }
  return out;
}

/**
 * Published ETTJ vertices (business days) and the title-by-title residual section.
 * Vertex numbers use a dot as a thousands separator (`1.008` = 1008 business days).
 */
export function parseAnbimaCz(text: string): AnbimaCurveFile {
  const params = parseAnbimaCzParams(text);
  const vertices: PublishedVertex[] = [];
  const bondErrors: BondFitError[] = [];
  let mode: 'none' | 'impl' | 'circ' | 'err' = 'none';
  for (const ln of text.split(/\r?\n/)) {
    if (ln.startsWith('Vertices;ETTJ')) {
      mode = 'impl';
      continue;
    }
    if (ln.startsWith('Vertices;Taxa')) {
      mode = 'circ';
      continue;
    }
    if (ln.startsWith('Erro ')) {
      mode = 'err';
      continue;
    }
    const c = ln.split(';');
    if (mode === 'impl' || mode === 'circ') {
      if (!c[0] || !/^\d/.test(c[0])) continue;
      const du = brazilianNumber(c[0]);
      if (du == null) continue;
      if (mode === 'circ') {
        const nominal = brazilianNumber(c[1] ?? '');
        if (nominal == null) continue;
        vertices.push({ businessDays: du, nominal, real: null, implied: null });
      } else {
        vertices.push({
          businessDays: du,
          real: brazilianNumber(c[1] ?? ''),
          nominal: brazilianNumber(c[2] ?? ''),
          implied: brazilianNumber(c[3] ?? ''),
        });
      }
    } else if (mode === 'err') {
      if (c[0] !== 'LTN' && c[0] !== 'NTN-F' && c[0] !== 'NTN-B') continue;
      const errorPp = brazilianNumber(c[3] ?? '');
      if (errorPp == null) continue;
      bondErrors.push({ title: c[0], maturity: c[2] ?? '', errorPp });
    }
  }
  return { ...params, vertices, bondErrors };
}

/** Snapshot CSV used by mapaDeTexto: `date;PRE|IPCA;b1;b2;b3;b4;l1;l2`, dot decimals. */
export function parseEttjSnapshot(text: string): Map<string, EttjDay> {
  const m = new Map<string, EttjDay>();
  const data = /^\d{4}-\d{2}-\d{2}$/;
  for (const l of text.trim().split(/\n/).slice(1)) {
    const c = l.split(';');
    if (c.length < 8 || !data.test(c[0]) || (c[1] !== 'PRE' && c[1] !== 'IPCA')) continue;
    const b = c.slice(2, 8).map(Number);
    if (!b.every(Number.isFinite)) continue;
    const e = m.get(c[0]) ?? {};
    e[c[1]] = b;
    m.set(c[0], e);
  }
  return m;
}

export type IndicativeBond = {
  title: 'LTN' | 'NTN-F' | 'NTN-B';
  maturity: string;
  indicative: number;
};

/** ANBIMA ms*.txt indicative rates. Column 7, Brazilian number format. */
export function parseAnbimaMs(text: string): IndicativeBond[] {
  const rows: IndicativeBond[] = [];
  for (const l of text.split(/\r?\n/)) {
    const c = l.split('@');
    if (c[0] !== 'LTN' && c[0] !== 'NTN-F' && c[0] !== 'NTN-B') continue;
    if (!c[4] || c[4].length < 8 || c[7] == null) continue;
    rows.push({
      title: c[0],
      maturity: `${c[4].slice(0, 4)}-${c[4].slice(4, 6)}-${c[4].slice(6, 8)}`,
      indicative: +c[7].replace(/\./g, '').replace(',', '.'),
    });
  }
  return rows;
}

const brDate = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;

/**
 * PrecoTaxaTesouroDireto. Rate is the average of morning buy and sell when both are positive.
 * Prefixado and IPCA+ only; Educa+, Renda+, Selic and IGPM+ are ignored.
 */
export function parseTesouroCsv(text: string, from = '2023-09-01'): Map<string, TesouroBond[]> {
  const by = new Map<string, TesouroBond[]>();
  for (const l of text.split(/\r?\n/)) {
    const c = l.split(';');
    if (c.length < 5) continue;
    const type =
      c[0] === 'Tesouro Prefixado' || c[0] === 'Tesouro Prefixado com Juros Semestrais'
        ? 'PRE'
        : c[0] === 'Tesouro IPCA+' || c[0] === 'Tesouro IPCA+ com Juros Semestrais'
          ? 'REAL'
          : null;
    if (!type) continue;
    const date = brDate(c[2]);
    if (date < from) continue;
    const buy = +c[3].replace(',', '.');
    const sell = +c[4].replace(',', '.');
    const rate = buy > 0 && sell > 0 ? (buy + sell) / 2 : buy > 0 ? buy : sell;
    if (!(rate > 0)) continue;
    const row: TesouroBond = { type, coupon: c[0].includes('Semestrais'), maturity: brDate(c[1]), rate };
    const list = by.get(date);
    if (list) list.push(row);
    else by.set(date, [row]);
  }
  return by;
}

/** SGS JSON (`data` dd/mm/yyyy, `valor`). Sorted, first row kept per date. */
export function parseSgs(rows: { data: string; valor: string }[]): Series {
  const out: Series = [];
  for (const x of rows) {
    if (x.valor === '' || x.valor == null) continue;
    out.push([brDate(x.data), parseFloat(x.valor)]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const seen = new Set<string>();
  return out.filter(([d]) => (seen.has(d) ? false : (seen.add(d), true)));
}

export function parseFocusPayload(payload: { value?: FocusRow[] }): FocusRow[] {
  return payload.value ?? [];
}

export function asNss(beta: number[] | undefined): Nss {
  if (!beta || beta.length < 6) throw new Error('NSS parameters need 6 numbers');
  return beta;
}
