import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList, fromGraphQL, levelFromCount } from '../src/core/calendar.js';
import { parseOutputs } from '../src/outputs.js';

test('fromDailyList places days on the right week/weekday', () => {
  // 2025-10-14 is a Tuesday
  const cal = fromDailyList('u', [
    { date: '2025-10-14', count: 1 },
    { date: '2025-10-15', count: 0 },
    { date: '2025-10-19', count: 4 },
  ]);
  assert.deepEqual(cal.days.map((d) => [d.x, d.y]), [[0, 2], [0, 3], [1, 0]]);
  assert.equal(cal.cols, 2);
  assert.equal(cal.total, 5);
});

test('fromGraphQL maps contribution levels', () => {
  const cal = fromGraphQL('u', {
    weeks: [{ contributionDays: [
      { contributionCount: 0, contributionLevel: 'NONE', date: '2025-10-12', weekday: 0 },
      { contributionCount: 9, contributionLevel: 'FOURTH_QUARTILE', date: '2025-10-13', weekday: 1 },
    ] }],
  });
  assert.deepEqual(cal.days.map((d) => d.level), [0, 4]);
});

test('levelFromCount', () => {
  assert.equal(levelFromCount(0, 10), 0);
  assert.equal(levelFromCount(1, 10), 1);
  assert.equal(levelFromCount(10, 10), 4);
});

test('demoCalendar is deterministic and full', () => {
  const a = demoCalendar('x');
  assert.deepEqual(a, demoCalendar('x'));
  assert.equal(a.days.length, 53 * 7);
  assert.ok(a.days.some((d) => d.level === 4));
});

test('parseOutputs', () => {
  assert.deepEqual(parseOutputs(`
    # comment
    dist/a.svg
    dist/b.svg?theme=life&mode=dark
  `), [
    { file: 'dist/a.svg', options: {} },
    { file: 'dist/b.svg', options: { theme: 'life', mode: 'dark' } },
  ]);
  assert.throws(() => parseOutputs('a.svg?colour=red'), /Unknown option/);
});
