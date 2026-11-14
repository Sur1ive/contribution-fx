import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { render } from '../src/render.js';

const days = (count) => Array.from({ length: 365 }, (_, i) => ({
  date: new Date(Date.UTC(2025, 9, 12) + i * 86400000).toISOString().slice(0, 10),
  count: count(i),
}));

const count = (svg, re) => (svg.match(re) || []).length;
const figures = (svg) => count(svg, /class="fx-const-f /g);

test('constellation: demo calendar draws several figures and stays small', () => {
  for (const mode of ['light', 'dark']) {
    const svg = render(demoCalendar('octocat'), { theme: 'constellation', mode });
    assert.ok(figures(svg) >= 3 && figures(svg) <= 5, `figures: ${figures(svg)}`);
    assert.ok(svg.length < 150 * 1024, `too large: ${svg.length} bytes`);
  }
});

test('constellation: static view is the real graph with a star per active day', () => {
  const cal = demoCalendar('octocat');
  const svg = render(cal, { theme: 'constellation' });
  const levels = [...svg.matchAll(/<rect [^>]*class="l(\d)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(levels, cal.days.map((d) => d.level));
  assert.equal(count(svg, /<use /g), cal.days.filter((d) => d.level > 0).length);
  assert.match(svg, /\.fx-const-f\{opacity:0\}/, 'figures are hidden without animation');
  assert.match(svg, /\.ss\{opacity:0;/, 'shooting star is hidden without animation');
});

test('constellation: ids are prefixed', () => {
  const svg = render(demoCalendar('octocat'), { theme: 'constellation', mode: 'dark' });
  for (const [, id] of svg.matchAll(/ id="([^"]+)"/g)) assert.match(id, /^fx-const-/);
  for (const [, ref] of svg.matchAll(/(?:href="#|url\(#)([^")]+)/g)) assert.match(svg, new RegExp(` id="${ref}"`));
});

test('constellation: empty and nearly empty calendars draw no figures', () => {
  const empty = render(fromDailyList('empty', days(() => 0)), { theme: 'constellation' });
  assert.equal(figures(empty), 0);
  assert.equal(count(empty, /<use /g), 0);
  const two = render(fromDailyList('two', days((i) => (i === 40 || i === 200 ? 5 : 0))), { theme: 'constellation' });
  assert.equal(figures(two), 0);
  assert.equal(count(two, /<use /g), 2);
});

test('constellation: a short partial calendar gets a single small figure', () => {
  const cal = fromDailyList('partial', days((i) => i % 3).slice(0, 40));
  const svg = render(cal, { theme: 'constellation', mode: 'dark' });
  assert.equal(figures(svg), 1);
  assert.equal(count(svg, /<rect [^>]*class="l\d"/g), cal.days.length);
});
