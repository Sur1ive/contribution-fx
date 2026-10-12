import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { render } from '../src/render.js';
import { simulate, step } from '../src/themes/life.js';

const R = 5;
const board = (cells) => {
  const a = new Uint8Array(R * R);
  for (const [x, y] of cells) a[x * R + y] = 1;
  return a;
};
const alive = (a) => [...a].flatMap((v, i) => (v ? [[Math.floor(i / R), i % R]] : []));

test('life: blinker oscillates with period 2', () => {
  const horizontal = board([[1, 2], [2, 2], [3, 2]]);
  const vertical = step(horizontal, R, R);
  assert.deepEqual(alive(vertical), [[2, 1], [2, 2], [2, 3]]);
  assert.deepEqual(step(vertical, R, R), horizontal);
});

test('life: wraps around the torus edges', () => {
  const edge = board([[0, 2], [R - 1, 2], [1, 2]]);
  assert.deepEqual(alive(step(edge, R, R)), [[0, 1], [0, 2], [0, 3]]);
});

test('life: missing cells are never born', () => {
  const exists = new Uint8Array(R * R).fill(1);
  exists[2 * R + 1] = 0;
  const next = step(board([[1, 2], [2, 2], [3, 2]]), R, R, exists);
  assert.deepEqual(alive(next), [[2, 2], [2, 3]]);
});

test('life: simulation stops on still lifes, empty boards and oscillators', () => {
  const block = board([[1, 1], [1, 2], [2, 1], [2, 2]]);
  assert.equal(simulate(block, R, R, null).length, 1);
  assert.equal(simulate(board([[2, 2]]), R, R, null).length, 2);
  const blinker = simulate(board([[1, 2], [2, 2], [3, 2]]), R, R, null, 50);
  assert.ok(blinker.length > 4 && blinker.length < 20, `ran ${blinker.length} generations`);
});

test('life: base attributes show the real graph', () => {
  const cal = demoCalendar('octocat');
  const svg = render(cal, { theme: 'life' });
  const classes = [...svg.matchAll(/<rect [^>]*class="l(\d)/g)].map((m) => Number(m[1]));
  assert.deepEqual(classes, cal.days.map((d) => d.level));
  assert.match(svg, /@keyframes/);
  assert.match(svg, /infinite/);
});

test('life: partial weeks draw only existing days', () => {
  const list = Array.from({ length: 40 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10),
    count: (i * 7) % 5,
  }));
  const cal = fromDailyList('partial', list);
  const svg = render(cal, { theme: 'life' });
  assert.equal((svg.match(/<rect /g) || []).length, cal.days.length);
});
