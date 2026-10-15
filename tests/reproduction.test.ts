import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { nss, parseAnbimaMs, yearFraction } from '../src/index.ts';
import { DATES, curveFile } from './load.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/**
 * The published ETTJ grid is in business days. t = du/252 is that tenor.
 * On the standard vertices (21, 126, 252, …) this is the same year fraction the
 * dashboard passes to nss (1/12, 0.5, 1, …).
 */
test('reproduction: NSS matches the published ETTJ rate at every vertex within 5 bp', () => {
  const table: { date: string; maxBp: number; bonds: number; anbimaBondMaxBp: number; calendarBondMaxBp: number }[] = [];
  for (const date of DATES) {
    const cz = curveFile(date);
    assert.ok(cz.pre && cz.ipca, date);
    let maxBp = 0;
    let checked = 0;
    for (const v of cz.vertices) {
      const t = v.businessDays / 252;
      if (v.nominal != null) {
        checked++;
        maxBp = Math.max(maxBp, Math.abs(nss(cz.pre, t) - v.nominal) * 100);
      }
      if (v.real != null) {
        checked++;
        maxBp = Math.max(maxBp, Math.abs(nss(cz.ipca, t) - v.real) * 100);
      }
    }
    assert.ok(checked > 0, `${date} has vertices`);
    assert.ok(maxBp <= 5, `${date} vertex error ${maxBp} bp`);

    let anbimaBondMaxBp = 0;
    for (const e of cz.bondErrors) anbimaBondMaxBp = Math.max(anbimaBondMaxBp, Math.abs(e.errorPp) * 100);
    const ms = parseAnbimaMs(readFileSync(join(root, 'ms', `${date}.txt`), 'latin1'));
    let calendarBondMaxBp = 0;
    for (const b of ms) {
      const model = b.title === 'NTN-B' ? nss(cz.ipca, yearFraction(date, b.maturity)) : nss(cz.pre, yearFraction(date, b.maturity));
      calendarBondMaxBp = Math.max(calendarBondMaxBp, Math.abs(model - b.indicative) * 100);
    }
    table.push({ date, maxBp, bonds: ms.length, anbimaBondMaxBp, calendarBondMaxBp });
  }
  console.log('reproduction max vertex error (bp) and bond residuals (not the gate)');
  for (const row of table) {
    console.log(
      `${row.date}  vertex ${row.maxBp.toFixed(4)} bp   anbima bond residual ${row.anbimaBondMaxBp.toFixed(2)} bp   calendar/365.25 vs indicative ${row.calendarBondMaxBp.toFixed(2)} bp (${row.bonds} bonds)`,
    );
  }
});
