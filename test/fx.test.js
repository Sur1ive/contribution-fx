import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { render } from '../src/render.js';

const days = (count, length = 365) => Array.from({ length }, (_, i) => ({
  date: new Date(Date.UTC(2025, 9, 12) + i * 86400000).toISOString().slice(0, 10),
  count: count(i),
}));

/** Quotes visible without animation. */
const staticQuotes = (svg) => [...svg.matchAll(/<text class="kf" style="[^"]*"><tspan[^>]*>(.*?)<\/tspan>/g)].map((m) => m[1]);

for (const theme of ['fx1', 'fx2']) {
  test(`${theme}: static attributes keep the full graph`, () => {
    const cal = demoCalendar('octocat');
    const svg = render(cal, { theme });
    const levels = [...svg.matchAll(/<rect [^>]*class="l(\d) kx"/g)].map((m) => Number(m[1]));
    assert.equal(levels.length, cal.days.length);
    assert.deepEqual(levels.sort(), cal.days.map((d) => d.level).sort());
    // Candles only appear through animation.
    assert.ok([...svg.matchAll(/<g class="kc [^"]*"([^>]*)>/g)].every((m) => m[1].includes('opacity="0"')));
  });

  test(`${theme}: the ticker quotes the user and one final price`, () => {
    const svg = render(demoCalendar('octocat'), { theme });
    assert.match(svg, />\$OCTOCAT<\/text>/);
    const quotes = staticQuotes(svg);
    assert.equal(quotes.length, 1);
    assert.match(quotes[0], /^\$\d+\.\d\d [▲▼]\d+\.\d\d%$/);
  });

  test(`${theme}: narrow graphs keep only the quote`, () => {
    const svg = render(fromDailyList('partial', days((i) => i % 3, 40)), { theme });
    assert.ok(!svg.includes('$PARTIAL'));
    assert.equal(staticQuotes(svg).length, 1);
  });
}

test('fx1: every day travels onto the chart', () => {
  const svg = render(demoCalendar('octocat'), { theme: 'fx1' });
  assert.ok(!/--o:0[;"]/.test(svg));
});

test('fx2: only active days build the candles', () => {
  const cal = demoCalendar('octocat');
  const svg = render(cal, { theme: 'fx2' });
  const hidden = (svg.match(/--o:0[;"]/g) || []).length;
  assert.equal(hidden, cal.days.filter((d) => d.level === 0).length);
});
