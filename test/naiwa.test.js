import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { render } from '../src/render.js';

const days = (count, length = 365) => Array.from({ length }, (_, i) => ({
  date: new Date(Date.UTC(2025, 9, 12) + i * 86400000).toISOString().slice(0, 10),
  count: count(i),
}));

const cellLevels = (svg) => [...svg.matchAll(/<rect x="[^"]+" y="[^"]+" [^>]*class="l(\d)/g)].map((m) => Number(m[1]));

test('naiwa: demo stays small in both modes', () => {
  for (const mode of ['light', 'dark']) {
    const svg = render(demoCalendar('octocat'), { theme: 'naiwa', mode });
    assert.ok(svg.length < 150 * 1024, `too large: ${svg.length} bytes`);
  }
});

test('naiwa: one cell per existing day and one laughing face per active day', () => {
  const cal = fromDailyList('partial', days((i) => i % 4, 40));
  const svg = render(cal, { theme: 'naiwa' });
  const levels = cellLevels(svg);
  assert.equal(levels.length, cal.days.length);
  assert.deepEqual([...levels].sort(), cal.days.map((d) => d.level).sort());
  const active = cal.days.filter((d) => d.level > 0).length;
  assert.equal((svg.match(/class="mh"/g) || []).length, active);
});

test('naiwa: static view is the plain graph', () => {
  const svg = render(demoCalendar('octocat'), { theme: 'naiwa', mode: 'dark' });
  assert.match(svg, /\.nx,\.mh,\.ht,\.du,\.zz\{opacity:0\}/, 'character and effects hidden without animation');
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 0 && ids.every((id) => id.startsWith('fx-naiwa-')));
});

test('naiwa: speed scales the shared cycle', () => {
  const cal = demoCalendar('octocat');
  assert.match(render(cal, { theme: 'naiwa' }), /12s linear infinite/);
  assert.match(render(cal, { theme: 'naiwa', speed: 2 }), /6s linear infinite/);
});

test('naiwa: empty calendar has no laughing faces', () => {
  const cal = fromDailyList('empty', days(() => 0));
  const svg = render(cal, { theme: 'naiwa', mode: 'light' });
  assert.equal(cellLevels(svg).length, cal.days.length);
  assert.ok(!svg.includes('class="mh"'));
  assert.ok(!svg.includes('NaN'));
});
