import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoCalendar, fromDailyList } from '../src/core/calendar.js';
import { render } from '../src/render.js';

const DAY = 86400000;
const days = (start, count, fn) => Array.from({ length: count }, (_, i) => ({
  date: new Date(start + i * DAY).toISOString().slice(0, 10),
  count: fn(i),
}));

/** Moving cells with their home position and the position they land on when sorted. */
function moves(svg) {
  const out = [];
  const re = /<rect x="([\d.]+)" y="([\d.]+)"[^>]*class="l(\d) c" style="animation-name:(s\d+)"/g;
  let m;
  while ((m = re.exec(svg))) {
    const [, x, y, level, id] = m;
    const kf = svg.match(new RegExp(`@keyframes ${id}\\{(.*?)\\}\\}`))[1];
    const [, dx, dy] = kf.match(/\{translate:(-?[\d.]+)px (-?[\d.]+)px;scale:1\}/);
    assert.match(kf, /^0%,[^{]*,to\{translate:0;scale:1\}/, `${id} must start and end at home`);
    out.push({ level: +level, x: +x, y: +y, tx: +x + +dx, ty: +y + +dy });
  }
  return out;
}

function homes(svg) {
  return [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)"[^>]*class="l0/g)].map((m) => `${m[1]},${m[2]}`);
}

for (const [label, cal] of [
  ['demo', demoCalendar('octocat')],
  // Starts mid-week and ends mid-week: both edge columns are partial.
  ['partial', fromDailyList('p', days(Date.UTC(2025, 9, 15), 200, (i) => (i * 7) % 5))],
  ['full', fromDailyList('f', days(Date.UTC(2025, 9, 12), 365, (i) => 1 + (i % 9)))],
]) {
  test(`sort (${label}): cells start at home and land on existing slots in sorted order`, () => {
    const svg = render(cal, { theme: 'sort' });
    const slots = homes(svg);
    assert.equal(slots.length, cal.days.length, 'one background slot per existing day');
    const active = cal.days.filter((d) => d.level > 0);
    const ms = moves(svg);
    assert.equal(ms.length, active.length);

    const home = new Set(active.map((d) => `${16 + d.x * 14},${16 + d.y * 14}`));
    assert.deepEqual(new Set(ms.map((m) => `${m.x},${m.y}`)), home);

    const targets = ms.map((m) => `${m.tx},${m.ty}`);
    assert.equal(new Set(targets).size, targets.length, 'no two cells share a slot');
    const order = (a, b) => a.tx - b.tx || a.ty - b.ty;
    const landed = [...ms].sort(order);
    const slotSet = new Set(slots);
    for (const m of landed) assert.ok(slotSet.has(`${m.tx},${m.ty}`), 'lands on a real day');
    for (let i = 1; i < landed.length; i++) assert.ok(landed[i - 1].level <= landed[i].level, 'gradient is sorted');
    // Active cells fill the tail of the column-major slot list.
    const tail = [...slots].sort((a, b) => {
      const [ax, ay] = a.split(',').map(Number);
      const [bx, by] = b.split(',').map(Number);
      return ax - bx || ay - by;
    }).slice(slots.length - active.length);
    assert.deepEqual(landed.map((m) => `${m.tx},${m.ty}`), tail);
  });
}

test('sort: an empty year renders only the static grid', () => {
  const svg = render(fromDailyList('e', days(Date.UTC(2025, 9, 12), 365, () => 0)), { theme: 'sort' });
  assert.ok(!svg.includes('@keyframes s'));
  assert.ok(!svg.includes('class="h"'));
});
