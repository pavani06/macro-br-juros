import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEttjSnapshot } from '../src/index.ts';
import { DATES, bp, fixtureText, readExpected, snapshot } from './load.ts';

test('parity: package matches dashboard lib at fc22eb8 within 0.5 bp', () => {
  const expected = readExpected();
  const table: { date: string; maxBp: number }[] = [];
  for (const date of DATES) {
    const exp = expected.dates[date];
    const got = snapshot(date);
    let maxBp = 0;
    const check = (a: number | null, b: number | null) => {
      if (a == null && b == null) return;
      assert.equal(a == null, b == null, `${date} null mismatch`);
      const d = bp(a as number, b as number);
      if (d > maxBp) maxBp = d;
    };
    assert.deepEqual(parseParams(date), exp.params);
    assert.equal(got.vertices.length, exp.vertices.length);
    got.vertices.forEach((v, i) => {
      const e = exp.vertices[i];
      assert.equal(v.label, e.label);
      assert.ok(Math.abs(v.years - e.years) <= 1e-12, `${date} ${v.label} tenor`);
      check(v.nominal, e.nominal);
      check(v.real, e.real);
      check(v.implied, e.implied);
    });
    got.forwards.forEach((f, i) => {
      const e = exp.forwards[i];
      assert.equal(f.label, e.label);
      check(f.breakeven, e.breakeven);
      check(f.focus, e.focus);
      check(f.meta, e.meta);
    });
    check(got.slope5y1y, exp.slope5y1y);
    assert.ok(got.tesouro);
    const t = got.tesouro;
    const et = exp.tesouro;
    check(t.nominal1y, et.nominal1y);
    check(t.nominal2y, et.nominal2y);
    check(t.nominal5y, et.nominal5y);
    check(t.nominal10y, et.nominal10y);
    check(t.real2y, et.real2y);
    check(t.real5y, et.real5y);
    check(t.real10y, et.real10y);
    check(t.implied2y, et.implied2y);
    check(t.implied5y, et.implied5y);
    check(t.implied10y, et.implied10y);
    check(t.slope5y1y, et.slope5y1y);
    check(t.cdiExpected, et.cdiExpected);
    check(t.termPremium, et.termPremium);
    const providers = got.sources.map((s) => s.provider);
    for (const name of ['ANBIMA', 'Tesouro Transparente', 'BCB Focus', 'BCB SGS', 'CMN']) {
      assert.ok(providers.includes(name), `${date} missing source ${name}`);
    }
    assert.ok(maxBp <= 0.5, `${date} max diff ${maxBp} bp`);
    table.push({ date, maxBp });
  }
  console.log('parity max diff (bp)');
  for (const row of table) console.log(`${row.date}  ${row.maxBp}`);
});

function parseParams(date: string): { pre: number[]; ipca: number[] } {
  const text = fixtureText(`cz/${date}.csv`);
  const lines = ['data;curva;b1;b2;b3;b4;l1;l2'];
  for (const l of text.split(/\r?\n/)) {
    const c = l.split(';');
    if ((c[0] === 'PREFIXADOS' || c[0] === 'IPCA') && c.length >= 7) {
      lines.push([date, c[0] === 'IPCA' ? 'IPCA' : 'PRE', ...c.slice(1, 7).map((x) => x.replace(',', '.'))].join(';'));
    }
  }
  const day = parseEttjSnapshot(lines.join('\n')).get(date);
  if (!day?.PRE || !day.IPCA) throw new Error(`snapshot parse ${date}`);
  return { pre: day.PRE, ipca: day.IPCA };
}
