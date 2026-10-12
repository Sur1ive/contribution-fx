import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { PALETTES } from '../src/core/palette.js';
import { render } from '../src/render.js';
import { THEMES } from '../src/themes/index.js';

const cal = demoCalendar('octocat');
const MAX_BYTES = 400 * 1024;

/** Cheap well-formedness check: every opened tag gets closed in order. */
function assertBalanced(svg) {
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(svg))) {
    const [, closing, name, selfClosing] = m;
    if (selfClosing) continue;
    if (closing) assert.equal(stack.pop(), name, `mismatched </${name}>`);
    else stack.push(name);
  }
  assert.deepEqual(stack, [], 'unclosed tags');
}

for (const name of Object.keys(THEMES)) {
  test(`${name}: renders well-formed SVG in light and dark`, () => {
    for (const mode of ['light', 'dark']) {
      const svg = render(cal, { theme: name, mode });
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      assert.ok(svg.endsWith('</svg>'));
      assert.ok(!svg.includes('NaN'), 'contains NaN');
      assert.ok(!svg.includes('undefined'), 'contains undefined');
      assert.ok(svg.length < MAX_BYTES, `too large: ${svg.length} bytes`);
      assertBalanced(svg);
    }
  });

  test(`${name}: is deterministic`, () => {
    assert.equal(render(cal, { theme: name }), render(cal, { theme: name }));
  });

  test(`${name}: survives empty, partial and maxed-out calendars`, () => {
    const empty = fromDailyList('empty', Array.from({ length: 365 }, (_, i) => ({
      date: new Date(Date.UTC(2025, 9, 12) + i * 86400000).toISOString().slice(0, 10),
      count: 0,
    })));
    const full = fromDailyList('full', empty.days.map((d) => ({ date: d.date, count: 20, level: 4 })));
    const partial = fromDailyList('partial', empty.days.slice(0, 40).map((d, i) => ({ date: d.date, count: i % 3 })));
    for (const c of [empty, full, partial]) {
      const svg = render(c, { theme: name, palette: 'ocean', speed: 2, label: true });
      assertBalanced(svg);
      assert.ok(!svg.includes('NaN'));
    }
  });
}

test('every palette works in both modes', () => {
  for (const palette of Object.keys(PALETTES)) {
    for (const mode of ['light', 'dark']) render(cal, { palette, mode });
  }
});

test('unknown theme / palette throw helpful errors', () => {
  assert.throws(() => render(cal, { theme: 'nope' }), /Available/);
  assert.throws(() => render(cal, { palette: 'nope' }), /Available/);
});
