import assert from 'node:assert/strict';
import { test } from 'node:test';
import { impliedInflation, nss } from '../src/index.ts';
import { DATES, curveFile, snapshot } from './load.ts';

/** 0.01 bp, with rates expressed in percent. */
const TOLERANCE_BP = 0.01;

test('identity: implied = (1+nominal)/(1+real)-1 at the same maturity within 0.01 bp', () => {
  let checked = 0;
  let maxBp = 0;
  for (const date of DATES) {
    const cz = curveFile(date);
    assert.ok(cz.pre && cz.ipca);
    const snap = snapshot(date);
    const tenors = new Set<number>([0.5, 1, 1.5, 2, 3, 4, 5, 7.25, 10, 15, 20, 30]);
    for (const v of snap.vertices) if (v.real != null) tenors.add(v.years);
    for (const years of tenors) {
      const nominal = nss(cz.pre, years);
      const real = nss(cz.ipca, years);
      const implied = impliedInflation(nominal, real);
      const identity = ((1 + nominal / 100) / (1 + real / 100) - 1) * 100;
      const diffBp = Math.abs(implied - identity) * 100;
      if (diffBp > maxBp) maxBp = diffBp;
      assert.ok(diffBp <= TOLERANCE_BP, `${date} t=${years} ${diffBp} bp`);
      const point = snap.vertices.find((v) => v.years === years && v.implied != null);
      if (point?.implied != null) {
        const viaCurve = Math.abs(point.implied - identity) * 100;
        assert.ok(viaCurve <= TOLERANCE_BP, `${date} curve point ${point.label}`);
      }
      checked++;
    }
  }
  assert.ok(checked >= DATES.length * 10);
  console.log(`identity checks ${checked}  max diff ${maxBp} bp`);
});
