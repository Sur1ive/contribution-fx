import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { render } from '../src/render.js';

const days = (count, length = 365) => Array.from({ length }, (_, i) => ({
  date: new Date(Date.UTC(2025, 9, 12) + i * 86400000).toISOString().slice(0, 10),
  count: count(i),
}));

const cells = (svg) => [...svg.matchAll(/<rect x="[^"]+" y="[^"]+" [^>]*class="l(\d) y(\d)"/g)].map((m) => ({ level: Number(m[1]), row: Number(m[2]) }));

test('railgun: demo stays small in both modes', () => {
  for (const mode of ['light', 'dark']) {
    const svg = render(demoCalendar('octocat'), { theme: 'railgun', mode });
    assert.ok(svg.length < 150 * 1024, `too large: ${svg.length} bytes`);
  }
});

test('railgun: one cell per existing day, tagged with its row', () => {
  const cal = fromDailyList('partial', days((i) => i % 4, 40));
  const svg = render(cal, { theme: 'railgun' });
  const found = cells(svg);
  assert.equal(found.length, cal.days.length);
  assert.deepEqual(found.map((c) => c.level).sort(), cal.days.map((d) => d.level).sort());
  assert.deepEqual(found.map((c) => c.row).sort(), cal.days.map((d) => d.y).sort());
});

test('railgun: static view is the plain graph', () => {
  const svg = render(demoCalendar('octocat'), { theme: 'railgun', mode: 'dark' });
  assert.match(svg, /\.ws\{opacity:0;/, 'shot hidden without animation');
  assert.match(svg, /\.wc,\.wt,\.wb,\.wr,\.wm,\.wf,\.wa,\.wv\{opacity:0;/, 'trail, rings and flares hidden');
  assert.match(svg, /\.wp0\{opacity:0;/, 'sparks hidden');
  assert.match(svg, /\.wi0\{opacity:0;/, 'inflow streaks hidden');
  assert.ok(!/<rect x="[^"]+" y="[^"]+" [^>]*class="l\d[^"]*"[^>]*(transform|style)=/.test(svg), 'cells carry no static offset');
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 0 && ids.every((id) => id.startsWith('fx-railgun-')));
});

test('railgun: every row rests at the loop seam', () => {
  const svg = render(demoCalendar('octocat'), { theme: 'railgun' });
  for (let r = 0; r < 7; r++) {
    const kf = svg.match(new RegExp(`@keyframes m${r}\\{([^@]*?)\\}(?=@|\\.|$)`))?.[1];
    assert.ok(kf, `missing keyframes m${r}`);
    const rest = 'transform:translate(0px,0px) scale(1,1)';
    assert.ok(kf.startsWith(`0%{${rest}}`), `row ${r} starts at rest`);
    assert.ok(kf.endsWith(`100%{${rest}}`), `row ${r} ends at rest`);
  }
});

test('railgun: the shot reaches later weeks later', () => {
  const svg = render(demoCalendar('octocat'), { theme: 'railgun' });
  const delays = [...svg.matchAll(/\.k(\d+) rect\{animation-delay:(-?[\d.]+)s\}/g)]
    .map((m) => [Number(m[1]), Number(m[2])])
    .sort((a, b) => a[0] - b[0]);
  assert.ok(delays.length > 50);
  for (let i = 1; i < delays.length; i++) assert.ok(delays[i][1] > delays[i - 1][1]);
});

test('railgun: speed scales the shared cycle', () => {
  const cal = demoCalendar('octocat');
  assert.match(render(cal, { theme: 'railgun' }), /9s linear infinite/);
  assert.match(render(cal, { theme: 'railgun', speed: 2 }), /4\.5s linear infinite/);
});

test('railgun: empty and tiny calendars still render every day', () => {
  for (const cal of [fromDailyList('empty', days(() => 0)), fromDailyList('tiny', days(() => 3, 5))]) {
    const svg = render(cal, { theme: 'railgun', mode: 'light' });
    assert.equal(cells(svg).length, cal.days.length);
    assert.ok(!svg.includes('NaN'));
  }
});
