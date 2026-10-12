import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { render } from '../src/render.js';

const cal = demoCalendar('octocat');
const days = (n, count) => fromDailyList('t', Array.from({ length: n }, (_, i) => ({
  date: new Date(Date.UTC(2025, 9, 12) + i * 86400000).toISOString().slice(0, 10),
  count: count(i),
})));

test('fireworks: launches up to 10 rockets from the busiest days', () => {
  const svg = render(cal, { theme: 'fireworks' });
  const rockets = svg.match(/<g class="f\d+">/g) ?? [];
  assert.ok(rockets.length > 0 && rockets.length <= 10, `rockets: ${rockets.length}`);
});

test('fireworks: draws exactly one graph cell per existing day', () => {
  const partial = days(40, (i) => i % 4);
  const svg = render(partial, { theme: 'fireworks' });
  const cells = svg.match(/class="l\d"/g) ?? [];
  assert.equal(cells.length, partial.days.length);
});

test('fireworks: an empty calendar renders just the graph', () => {
  const svg = render(days(365, () => 0), { theme: 'fireworks', mode: 'dark' });
  assert.ok(!svg.includes('class="f0"'));
  assert.ok(!svg.includes('@keyframes'));
});

test('fireworks: every animated class rests invisible', () => {
  for (const mode of ['light', 'dark']) {
    const svg = render(cal, { theme: 'fireworks', mode });
    const style = svg.match(/<style>(.*)<\/style>/s)[1];
    for (const cls of ['s0', 's1', 's2', 's3', 's4', 'gl', 'fc', 'fr', 'fg', 'r0']) {
      assert.match(style, new RegExp(`\\.${cls}\\{opacity:0;animation:`), `.${cls} must default to opacity 0`);
    }
    // Spark keyframes start and end invisible, so the loop seam is clean.
    for (const kf of style.matchAll(/@keyframes s\d\{0%,[\d.]+%\{opacity:0;.*?([\d.]+)%,100%\{opacity:0;/g)) {
      assert.ok(Number(kf[1]) < 100);
    }
  }
});
