import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anbimaProbeDates, firstProbeWithData, yearFraction } from '../src/index.ts';

test('dates: weekends are skipped on the UTC-3 probe, holidays are not', () => {
  // Tuesday 13 Oct 2026, 15:00Z = 12:00 in São Paulo. 12 Oct was a Monday holiday.
  const tuesday = new Date('2026-10-13T15:00:00Z');
  const probes = anbimaProbeDates(tuesday);
  assert.deepEqual(probes, [
    '2026-10-13',
    '2026-10-12', // holiday Monday is still requested
    '2026-10-09',
    '2026-10-08',
    '2026-10-07',
    '2026-10-06',
  ]);
  assert.equal(probes.includes('2026-10-11'), false); // Sunday
  assert.equal(probes.includes('2026-10-10'), false); // Saturday

  const seen: string[] = [];
  const found = firstProbeWithData(tuesday, (d) => {
    seen.push(d);
    return d === '2026-10-09';
  });
  // 13 Oct has no special role here; 12 Oct is asked and misses; Friday 9 Oct is the first hit.
  assert.equal(found, '2026-10-09');
  assert.deepEqual(seen, ['2026-10-13', '2026-10-12', '2026-10-09']);

  // Saturday noon in São Paulo. The first candidate is the previous Friday.
  const saturday = anbimaProbeDates(new Date('2026-10-10T15:00:00Z'));
  assert.equal(saturday[0], '2026-10-09');
  assert.equal(saturday.includes('2026-10-10'), false);
  assert.equal(saturday.includes('2026-10-11'), false);

  // 02:30Z Saturday is still Friday evening in São Paulo (UTC-3), so Friday is not skipped.
  const fridayEvening = anbimaProbeDates(new Date('2026-10-10T02:30:00Z'));
  assert.equal(fridayEvening[0], '2026-10-09');
  // 03:30Z Saturday is Saturday 00:30 in São Paulo, so that calendar day is skipped.
  const justSaturday = anbimaProbeDates(new Date('2026-10-10T03:30:00Z'));
  assert.equal(justSaturday[0], '2026-10-09');
  assert.equal(justSaturday.includes('2026-10-10'), false);
});

test('dates: year fractions count calendar days, including weekends and holidays', () => {
  // Friday 9 Oct to Tuesday 13 Oct is 4 calendar days: Sat, Sun, the Monday holiday, and Tuesday.
  const span = yearFraction('2026-10-09', '2026-10-13');
  assert.equal(span, 4 / 365.25);
  assert.equal(yearFraction('2026-09-30', '2026-10-01'), 1 / 365.25);
  // A business-day count of that Friday-to-Tuesday span would be 1, not 4.
  assert.notEqual(span, 1 / 252);
});
