import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { render } from '../src/render.js';

const cal = demoCalendar('octocat');
const days = (count, n = 365) => fromDailyList('t', Array.from({ length: n }, (_, i) => ({
  date: new Date(Date.UTC(2025, 9, 12) + i * 86400000).toISOString().slice(0, 10),
  count: count(i),
})));
const count = (svg, re) => (svg.match(re) || []).length;
const traces = (svg) => [...svg.matchAll(/<path d="([^"]+)" pathLength="1" class="e\d+/g)].map((m) => m[1]);
const styleOf = (svg) => svg.match(/<style>(.*)<\/style>/s)[1];

test('circuit: demo calendar routes every active day and stays small', () => {
  for (const mode of ['light', 'dark']) {
    const svg = render(cal, { theme: 'circuit', mode });
    assert.ok(svg.length < 100 * 1024, `too large: ${svg.length} bytes`);
    assert.ok(traces(svg).length > 50, 'draws a dense board');
    const active = cal.days.filter((d) => d.level > 0).length;
    assert.equal(count(svg, /<rect [^>]*class="l[1-4] b\d+"/g), active, 'every active day relights');
    assert.equal(count(svg, /<rect [^>]*class="l0 b/g), 0, 'empty days stay unpopulated');
    assert.equal(count(svg, / class="pd ch /g), 1, 'one chip');
  }
});

test('circuit: static view is the plain graph, every effect rests hidden', () => {
  const svg = render(cal, { theme: 'circuit', mode: 'dark' });
  const levels = [...svg.matchAll(/<rect [^>]*class="l(\d)/g)].map((m) => Number(m[1]));
  assert.deepEqual(levels, cal.days.map((d) => d.level));
  const style = styleOf(svg);
  assert.match(style, /\.fx-circuit-b\{opacity:0;/);
  assert.match(style, /\.pd\{opacity:0;/);
  assert.match(style, /\.lf\{opacity:0;/);
  assert.ok(!/ opacity="/.test(svg), 'no element is dimmed by attribute');
  // Without animation the dash pattern hides every packet past the end of its trace.
  assert.match(style, /\.pk path\{stroke-dashoffset:-1\}/);
});

test('circuit: loop seam rests on the plain graph', () => {
  const style = styleOf(render(cal, { theme: 'circuit' }));
  assert.match(style, /@keyframes bd\{0%,[\d.]+%\{opacity:0\}.*,100%\{opacity:0\}\}/);
  for (const [, body] of style.matchAll(/@keyframes b\d+\{(.*?)\}\}/g)) {
    assert.match(body, /^0%,[\d.]+%\{opacity:1\}/);
    assert.match(body, /,100%\{opacity:1\}/);
    assert.match(body, /,100%\{fill:var\(--b\)$/);
  }
});

test('circuit: copper runs in the gaps between cells', () => {
  const svg = render(cal, { theme: 'circuit' });
  const onGap = (v) => Math.abs((((v - 16 + 1.5) % 14) + 14) % 14) < 0.01;
  for (const d of traces(svg)) {
    let [x, y] = d.match(/^M(-?[\d.]+) (-?[\d.]+)/).slice(1).map(Number);
    for (const [, cmd, a, b] of d.matchAll(/([hvl])(-?[\d.]+)(?: (-?[\d.]+))?/g)) {
      const dx = cmd === 'v' ? 0 : Number(a);
      const dy = cmd === 'h' ? 0 : cmd === 'v' ? Number(a) : Number(b);
      if (cmd === 'l') assert.ok(Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.02 && Math.abs(dx) < 3, `45° chamfer only: ${d}`);
      // Straight runs sit on a gap line; only the short taps into a pad cross a cell.
      if (cmd === 'h' && Math.abs(dx) > 8) assert.ok(onGap(y), `horizontal run off the gap: ${d}`);
      if (cmd === 'v' && Math.abs(dy) > 8) assert.ok(onGap(x), `vertical run off the gap: ${d}`);
      x += dx;
      y += dy;
    }
  }
});

test('circuit: pads light after the chip boots and before the board surges', () => {
  const svg = render(cal, { theme: 'circuit' });
  const ks = [...svg.matchAll(/ b(\d+)"/g)].map((m) => Number(m[1]) * 0.05);
  assert.ok(Math.min(...ks) >= 2.75 && Math.max(...ks) <= 6.25, `${Math.min(...ks)}..${Math.max(...ks)}`);
});

test('circuit: ids are prefixed and every reference resolves', () => {
  const svg = render(cal, { theme: 'circuit', mode: 'dark' });
  for (const [, id] of svg.matchAll(/ id="([^"]+)"/g)) assert.match(id, /^fx-circuit-/);
  for (const [, ref] of svg.matchAll(/(?:href="#|url\(#)([^")]+)/g)) assert.match(svg, new RegExp(` id="${ref}"`));
});

test('circuit: empty calendars stay a plain graph, sparse and partial ones still route', () => {
  const empty = render(days(() => 0), { theme: 'circuit' });
  assert.equal(traces(empty).length, 0);
  assert.equal(count(empty, / b\d+"/g), 0);
  const one = render(days((i) => (i === 200 ? 3 : 0)), { theme: 'circuit' });
  assert.equal(count(one, / class="pd ch /g), 1, 'a lone day becomes the chip');
  const partial = days((i) => i % 3, 40);
  const svg = render(partial, { theme: 'circuit', mode: 'dark' });
  assert.equal(count(svg, /<rect [^>]*class="l\d/g), partial.days.length);
  assert.equal(count(svg, /<rect [^>]*class="l[1-4] b\d+"/g), partial.days.filter((d) => d.level > 0).length);
});
