import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { render } from '../src/render.js';

const days = (count, length = 365) => Array.from({ length }, (_, i) => ({
  date: new Date(Date.UTC(2025, 9, 12) + i * 86400000).toISOString().slice(0, 10),
  count: count(i),
}));

/** Text of every header frame that is visible without animation. */
const staticTexts = (svg) => [...svg.matchAll(/<text class="rf" style="[^"]*">(.*?)<\/text>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, ''));

test('replay: static attributes keep the full graph', () => {
  const cal = demoCalendar('octocat');
  const svg = render(cal, { theme: 'replay' });
  const slots = svg.match(/<g id="fx-replay-s">(.*?)<\/g>/)[1];
  assert.equal((slots.match(/<rect /g) || []).length, cal.days.length);
  const levels = [...svg.matchAll(/<rect [^>]*class="l(\d) rc"/g)].map((m) => Number(m[1]));
  const active = [...cal.days].sort((a, b) => a.x - b.x || a.y - b.y).filter((d) => d.level > 0);
  assert.deepEqual(levels, active.map((d) => d.level));
  assert.ok(svg.length < 150 * 1024, `too large: ${svg.length} bytes`);
});

test('replay: without animation the header shows the final total and the date range', () => {
  const cal = demoCalendar('octocat');
  const texts = staticTexts(render(cal, { theme: 'replay' }));
  assert.deepEqual(texts, ['Oct 2025 – Oct 2026', `${cal.total.toLocaleString('en-US')} contributions`]);
});

test('replay: the counter only ever counts up to the total', () => {
  const cal = demoCalendar('octocat');
  const svg = render(cal, { theme: 'replay' });
  const values = [...svg.matchAll(/<tspan class="rn">([\d,]+)<\/tspan>/g)].map((m) => Number(m[1].replace(/,/g, '')));
  assert.ok(values.length >= 20, `only ${values.length} counter frames`);
  assert.equal(Math.max(...values), cal.total);
  assert.ok(values.includes(0));
});

test('replay: an empty year still plays and shines', () => {
  const svg = render(fromDailyList('empty', days(() => 0)), { theme: 'replay' });
  assert.deepEqual(staticTexts(svg), ['Oct 2025 – Oct 2026', '0 contributions']);
  assert.match(svg, /<mask [^>]*><use href="#fx-replay-s"/);
  assert.ok(!svg.includes(' rc"'));
});

test('replay: narrow graphs keep only the counter', () => {
  const svg = render(fromDailyList('partial', days((i) => i % 3, 40)), { theme: 'replay' });
  assert.deepEqual(staticTexts(svg), ['39']);
});
