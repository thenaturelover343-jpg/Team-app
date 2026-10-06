import assert from 'node:assert/strict';
import test from 'node:test';

function weekStartKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const noonUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
  const wd = new Date(noonUtc).getUTCDay() || 7;
  const monday = new Date(noonUtc);
  monday.setUTCDate(monday.getUTCDate() - wd + 1);
  return monday.toISOString().slice(0, 10);
}

test('Brussels week containing Tuesday 2026-10-06 starts Monday 2026-10-05', () => {
  assert.equal(weekStartKey('2026-10-06'), '2026-10-05');
  assert.ok('2026-10-05' >= weekStartKey('2026-10-06'));
});

test('today-only filter would hide Monday plan on Tuesday', () => {
  const today = '2026-10-06';
  const shifts = [{ date: '2026-10-05', title: 'Werkdienst' }];
  const todayOnly = shifts.filter(s => s.date === today);
  const week = shifts.filter(s => s.date >= weekStartKey(today));
  assert.equal(todayOnly.length, 0);
  assert.equal(week.length, 1);
});
