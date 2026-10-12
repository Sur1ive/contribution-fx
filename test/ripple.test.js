import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { render } from '../src/render.js';

const days = (count) => Array.from({ length: 365 }, (_, i) => ({
  date: new Date(Date.UTC(2025, 9, 12) + i * 86400000).toISOString().slice(0, 10),
  count: count(i),
}));

const drops = (svg) => (svg.match(/<circle class="dp"/g) || []).length;
const cells = (svg) => (svg.match(/<rect /g) || []).length;

test('ripple: demo calendar gets several drops and stays small', () => {
  const svg = render(demoCalendar('octocat'), { theme: 'ripple' });
  assert.ok(drops(svg) >= 3 && drops(svg) <= 4);
  assert.ok(svg.length < 150 * 1024, `too large: ${svg.length} bytes`);
});

test('ripple: draws exactly one cell per existing day', () => {
  const cal = fromDailyList('partial', days((i) => i % 4));
  assert.equal(cells(render(cal, { theme: 'ripple' })), cal.days.length);
});

test('ripple: an empty calendar still gets a ripple from the latest day', () => {
  const cal = fromDailyList('empty', days(() => 0));
  const svg = render(cal, { theme: 'ripple' });
  assert.equal(drops(svg), 1);
  assert.match(svg, /@keyframes c0/);
});

test('ripple: static attributes keep the real graph', () => {
  const cal = demoCalendar('octocat');
  const svg = render(cal, { theme: 'ripple' });
  const levels = [...svg.matchAll(/<rect [^>]*class="l(\d)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(levels, cal.days.map((d) => d.level));
  assert.match(svg, /\.rg,\.dp\{[^}]*opacity:0/, 'drop and ring overlays are hidden without animation');
});
