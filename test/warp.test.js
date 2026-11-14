import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { render } from '../src/render.js';

const days = (count, length = 365) => Array.from({ length }, (_, i) => ({
  date: new Date(Date.UTC(2025, 9, 12) + i * 86400000).toISOString().slice(0, 10),
  count: count(i),
}));

const cellLevels = (svg) => [...svg.matchAll(/<rect x="[^"]+" y="[^"]+" [^>]*class="l(\d)"/g)].map((m) => Number(m[1]));

test('warp: demo stays small in both modes', () => {
  for (const mode of ['light', 'dark']) {
    const svg = render(demoCalendar('octocat'), { theme: 'warp', mode });
    assert.ok(svg.length < 150 * 1024, `too large: ${svg.length} bytes`);
  }
});

test('warp: one cell and one streak per existing day', () => {
  const cal = fromDailyList('partial', days((i) => i % 4, 40));
  const svg = render(cal, { theme: 'warp' });
  const levels = cellLevels(svg);
  assert.equal(levels.length, cal.days.length);
  assert.deepEqual([...levels].sort(), cal.days.map((d) => d.level).sort());
  assert.equal((svg.match(/class="s\d"/g) || []).length, cal.days.length);
});

test('warp: static view is the plain graph', () => {
  const svg = render(demoCalendar('octocat'), { theme: 'warp', mode: 'dark' });
  assert.match(svg, /\.z line,\.sz line\{opacity:0/, 'streaks hidden without animation');
  assert.match(svg, /\.gw,\.fl\{opacity:0/, 'glow and flash hidden without animation');
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 0 && ids.every((id) => id.startsWith('fx-warp-')));
});

test('warp: speed scales the shared cycle', () => {
  const cal = demoCalendar('octocat');
  assert.match(render(cal, { theme: 'warp' }), /9s linear infinite/);
  assert.match(render(cal, { theme: 'warp', speed: 2 }), /4\.5s linear infinite/);
});

test('warp: empty calendar still renders every day', () => {
  const cal = fromDailyList('empty', days(() => 0));
  const svg = render(cal, { theme: 'warp', mode: 'light' });
  assert.equal(cellLevels(svg).length, cal.days.length);
  assert.ok(!svg.includes('NaN'));
});
