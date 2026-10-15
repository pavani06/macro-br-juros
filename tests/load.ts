import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { asNss, marketOn, parseAnbimaCz, parseAnbimaCzParams, parseFocusPayload, parseSgs, parseTesouroCsv, type MarketSnapshot } from '../src/index.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export const DATES = ['2026-09-14', '2026-09-18', '2026-10-01', '2026-10-09', '2026-10-13'] as const;

export type ExpectedDate = {
  asOf: string;
  params: { pre: number[]; ipca: number[] };
  vertices: { label: string; years: number; nominal: number; real: number | null; implied: number | null }[];
  forwards: { label: string; breakeven: number; focus: number | null; meta: number }[];
  slope5y1y: number;
  tesouro: {
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
    cdiExpected: number;
    termPremium: number;
  };
};

export function readExpected(): { dates: Record<string, ExpectedDate> } {
  return JSON.parse(readFileSync(join(root, 'expected.json'), 'utf8'));
}

export function fixtureText(path: string): string {
  return readFileSync(join(root, path), 'latin1');
}

export function snapshot(asOf: string): MarketSnapshot {
  const cz = fixtureText(`cz/${asOf}.csv`);
  const params = parseAnbimaCzParams(cz);
  const focusIpca = parseFocusPayload(JSON.parse(fixtureText('focus/ipca.json')));
  const focusSelic = parseFocusPayload(JSON.parse(fixtureText('focus/selic.json')));
  const selic = parseSgs(JSON.parse(fixtureText('sgs/selic-432.json')));
  const bonds = parseTesouroCsv(fixtureText('preco-taxa.csv')).get(asOf);
  if (!bonds) throw new Error(`no Tesouro rows for ${asOf}`);
  return marketOn({
    asOf,
    nominal: asNss(params.pre),
    real: asNss(params.ipca),
    focusIpca,
    focusSelic,
    selicMeta: selic,
    tesouro: bonds,
  });
}

export function curveFile(asOf: string) {
  return parseAnbimaCz(fixtureText(`cz/${asOf}.csv`));
}

/** Difference in basis points. Rates are in percent, so 0.01 percent = 1 bp. */
export function bp(a: number, b: number): number {
  return Math.abs(a - b) * 100;
}
