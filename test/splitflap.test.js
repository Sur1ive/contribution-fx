import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar } from '../src/core/calendar.js';
import { PALETTES } from '../src/core/palette.js';
import { render } from '../src/render.js';

const cal = demoCalendar('octocat');

test('splitflap: one tile per existing day, base class is the real level', () => {
  const svg = render(cal, { theme: 'splitflap', mode: 'dark' });
  const tiles = [...svg.matchAll(/<g class="p(\d)\d l(\d)"/g)];
  assert.equal(tiles.length, cal.days.length);
  tiles.forEach((m, i) => {
    assert.equal(Number(m[2]), cal.days[i].level);
    assert.equal(m[1], m[2], 'flip sequence must belong to the tile level');
  });
});

test('splitflap: every flip sequence settles on its own level', () => {
  for (const mode of ['light', 'dark']) {
    const { levels } = PALETTES.github[mode];
    const svg = render(cal, { theme: 'splitflap', mode });
    let seen = 0;
    for (const [, level, role, body] of svg.matchAll(/@keyframes fx-flap-p(\d)\d([tbf])\{(.*?\})\}/g)) {
      const stops = [...body.matchAll(/([\d.,%]+)\{fill:(#[0-9a-f]{6})\}/g)]
        .flatMap(([, times, fill]) => times.split(',').map((t) => [parseFloat(t), fill]));
      const last = stops.reduce((a, b) => (b[0] > a[0] ? b : a));
      assert.equal(last[1], levels[level], `${mode} p${level} ${role}`);
      seen++;
    }
    assert.equal(seen, 5 * 6 * 3);
  }
});

test('splitflap: ids are prefixed and the demo stays small', () => {
  for (const mode of ['light', 'dark']) {
    const svg = render(cal, { theme: 'splitflap', mode });
    for (const [, id] of svg.matchAll(/id="([^"]+)"/g)) assert.match(id, /^fx-flap-/);
    assert.ok(svg.length < 150 * 1024, `too large: ${svg.length}`);
  }
});
