import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { PALETTES } from '../src/core/palette.js';
import { render } from '../src/render.js';

const cal = demoCalendar('octocat');
const days = (n, count) => fromDailyList('t', Array.from({ length: n }, (_, i) => ({
  date: new Date(Date.UTC(2025, 9, 12) + i * 86400000).toISOString().slice(0, 10),
  count: count(i),
})));
const styleOf = (svg) => svg.match(/<style>(.*)<\/style>/s)[1];

test('neon: one glass tube and one lit tube per existing day', () => {
  for (const c of [cal, days(40, (i) => i % 4), days(365, () => 0)]) {
    const svg = render(c, { theme: 'neon', mode: 'dark' });
    assert.equal((svg.match(/class="g\d"/g) ?? []).length, c.days.length);
    assert.equal((svg.match(/class="n\d"/g) ?? []).length, c.days.length);
  }
});

test('neon: lit tubes carry the real level, hot levels get a white core', () => {
  const svg = render(cal, { theme: 'neon' });
  const lit = [...svg.matchAll(/class="n(\d)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(lit.slice().sort(), cal.days.map((d) => d.level).sort());
  const hot = cal.days.filter((d) => d.level >= 3).length;
  assert.equal((svg.match(/class="c[34]"/g) ?? []).length, hot);
});

test('neon: the static view is the lit sign and the loop seam is dark on both sides', () => {
  const svg = render(cal, { theme: 'neon', mode: 'dark' });
  const style = styleOf(svg);
  // Nothing rests hidden: only keyframes ever change opacity.
  assert.ok(!/opacity:0[;}]/.test(style.replace(/@keyframes [\w-]+\{(?:[^{}]*\{[^{}]*\})*\}/g, '')));
  assert.doesNotMatch(svg, /opacity="/);
  for (const [, body] of style.matchAll(/@keyframes k\d+\{(.*?)\}\}/g)) {
    assert.match(body, /^0%\{opacity:0\}/);
    assert.match(body, /100%\{opacity:1$/);
  }
  assert.match(style, /@keyframes pw\{0%\{opacity:1\}.*100%\{opacity:0\}\}/);
});

test('neon: keyframe stops stay in order', () => {
  const style = styleOf(render(cal, { theme: 'neon' }));
  for (const [, body] of style.matchAll(/@keyframes \w+\{(.*?)\}\}/g)) {
    const stops = [...body.matchAll(/([\d.]+)%\{/g)].map((m) => Number(m[1]));
    for (let i = 1; i < stops.length; i++) assert.ok(stops[i] > stops[i - 1], `stops out of order: ${body}`);
  }
});

test('neon: light mode mounts the sign on a dark board, dark mode stays transparent', () => {
  assert.match(render(cal, { theme: 'neon', mode: 'light' }), /fill="#0d1117"/);
  assert.doesNotMatch(render(cal, { theme: 'neon', mode: 'dark' }), /fill="#0d1117"/);
});

test('neon: every palette and mode stays small and uses prefixed ids', () => {
  for (const palette of Object.keys(PALETTES)) {
    for (const mode of ['light', 'dark']) {
      const svg = render(cal, { theme: 'neon', palette, mode });
      assert.ok(svg.length < 150 * 1024, `${palette}/${mode}: ${svg.length} bytes`);
      for (const [, id] of svg.matchAll(/id="([^"]+)"/g)) assert.match(id, /^fx-neon-/);
    }
  }
});

test('neon: an empty calendar has nothing to buzz', () => {
  const svg = render(days(365, () => 0), { theme: 'neon' });
  assert.doesNotMatch(svg, /class="bz"/);
});
