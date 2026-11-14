import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { createRng } from '../src/core/random.js';
import { CELL, PAD, PITCH } from '../src/core/svg.js';
import { render } from '../src/render.js';
import { peaks, spectrum } from '../src/themes/equalizer.js';

const DAY = 86400000;
const days = (start, count, fn) => Array.from({ length: count }, (_, i) => ({
  date: new Date(start + i * DAY).toISOString().slice(0, 10),
  count: fn(i),
}));

const calendars = [
  ['demo', demoCalendar('octocat')],
  ['partial', fromDailyList('p', days(Date.UTC(2025, 9, 15), 200, (i) => (i * 7) % 5))],
  ['full', fromDailyList('f', days(Date.UTC(2025, 9, 12), 365, () => 9))],
  ['empty', fromDailyList('e', days(Date.UTC(2025, 9, 12), 365, () => 0))],
];

for (const [label, cal] of calendars) {
  test(`equalizer (${label}): base attributes show the real graph`, () => {
    const svg = render(cal, { theme: 'equalizer', label: true });
    const height = +svg.match(/height="(\d+)"/)[1];

    const groups = [...svg.matchAll(/<g class="er"[^>]*>(.*?)<\/g>/g)].map((m) => m[1]).join('');
    const real = [...groups.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="11" height="11" rx="2" class="l(\d)"\/>/g)]
      .map((m) => `${m[1]},${m[2]},${m[3]}`).sort();
    const expected = cal.days.filter((d) => d.level > 0)
      .map((d) => `${PAD + d.x * PITCH},${PAD + d.y * PITCH},${d.level}`).sort();
    assert.deepEqual(real, expected, 'one real cell per active day');

    const slots = svg.match(/<g class="l0 es">(.*?)<\/g>/)[1];
    const count = (slots.match(/href="#eq-s"/g) ?? []).length * 7 + (slots.match(/<rect /g) ?? []).length;
    assert.equal(count, cal.days.length, 'one slot per existing day');

    for (const m of svg.matchAll(/<rect class="ep"[^>]* y="([\d.]+)"/g)) {
      assert.ok(+m[1] >= height, 'peak markers rest off-canvas');
    }

    const clips = svg.match(/<clipPath id="eq-bars"[^>]*>(.*?)<\/clipPath>/)[1];
    for (const m of clips.matchAll(/animation-name:b(\d+)" x="[\d.]+" y="([\d.]+)"/g)) {
      const low = Math.max(...cal.days.filter((d) => d.x === +m[1]).map((d) => d.y));
      assert.ok(+m[2] >= PAD + low * PITCH + CELL, `bar ${m[1]} is collapsed at rest`);
    }
  });

  test(`equalizer (${label}): bars and peaks loop seamlessly and stay inside their week`, () => {
    const svg = render(cal, { theme: 'equalizer' });
    const all = [...svg.matchAll(/@keyframes ([bp])(\d+)\{(.*?)\}\}/g)];
    assert.equal(all.length, 2 * new Set(cal.days.map((d) => d.x)).size);
    for (const m of all) {
      const [, kind, x, body] = m;
      const groups = [...`${body}}`.matchAll(/([\d.%,]+)\{translate:0 (-?[\d.]+)px\}/g)];
      const at = (offset) => groups.find((g) => g[1].split(',').includes(offset))?.[2];
      assert.equal(at('0%'), '0', `${kind}${x} starts at rest`);
      assert.equal(at('100%'), '0', `${kind}${x} ends at rest`);
      if (kind === 'b') {
        const col = cal.days.filter((d) => d.x === +x).map((d) => d.y);
        const len = Math.max(...col) - Math.min(...col) + 1;
        for (const g of groups) assert.ok(-g[2] <= len * PITCH, `bar ${x} never outgrows its week`);
      }
    }
  });
}

test('equalizer: busier weeks bounce higher', () => {
  const cal = demoCalendar('octocat');
  const heights = spectrum(cal, createRng(7));
  const busy = new Array(cal.cols).fill(0);
  for (const d of cal.days) busy[d.x] += d.level;
  const order = busy.map((v, x) => x).sort((a, b) => busy[a] - busy[b]);
  const mean = (cols) => cols.reduce((s, x) => s + heights[x].slice(25, 80).reduce((a, b) => a + b, 0) / 55, 0) / cols.length;
  const k = Math.floor(cal.cols / 4);
  assert.ok(mean(order.slice(-k)) > mean(order.slice(0, k)) + 0.5);
  for (const row of heights) {
    assert.equal(row[0], 0);
    assert.equal(row[row.length - 1], 0);
    assert.ok(row.every((h) => Number.isInteger(h) && h >= 0 && h <= 7));
  }
});

test('equalizer: peak markers jump with the bar and fall back slowly', () => {
  const row = [0, 6, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0];
  const p = peaks(row);
  assert.equal(p[1], 6, 'jumps instantly');
  assert.equal(p[3], 6, 'holds');
  for (let i = 4; i < 10; i++) assert.ok(p[i] <= p[i - 1] && p[i] >= row[i], 'falls but never below the bar');
  assert.ok(p[4] > 4, 'falls gradually');
  assert.equal(p[p.length - 1], 0, 'hidden once the bar is gone');
});
