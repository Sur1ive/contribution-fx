import { PITCH, n, pct, rect } from '../core/svg.js';

// A sorting pass over your year: a read head sweeps the graph and lifts every
// active day, the days land in sorted order (quiet -> busiest, column-major),
// a "verified" pulse runs through the sorted array, then everything rewinds home.

const CYCLE = 10; // seconds
// Timeline (percent of cycle)
// Each landing window opens 2 * LIFT + 3 after its lift-off window closes,
// so even the latest pick / earliest drop pair still has a real flight.
const PICK = [8, 19]; // lift-off, ordered by home position
const DROP = [27, 43]; // landing, ordered by sorted position
const CHECK = [46, 58]; // verification pulse
const UNPICK = [61, 70]; // rewind lift-off, sorted position descending
const UNDROP = [78, 89]; // rewind landing, home position descending
const LIFT = 2.5; // percent spent lifting / landing
const POP = 1.6; // percent of one verification pulse
const SCALE = 1.2; // lifted cells
const PULSE = 1.25; // verified cells
const RISE = 2; // px a lifted cell floats up

const lerp = ([a, b], t) => a + (b - a) * t;
const q = (v) => `${Math.round(v * 10) / 10}%`;

export default {
  name: 'sort',
  description: 'Your year gets sorted: every day flies to its place in a quiet-to-busiest gradient, then rewinds.',

  render(ctx) {
    const { cal, colors, origin, grid } = ctx;
    const duration = n(ctx.duration(CYCLE));
    const slots = [...cal.days].sort((a, b) => a.x - b.x || a.y - b.y);
    const last = Math.max(1, slots.length - 1);
    const home = new Map(slots.map((d, i) => [d, i]));
    const sorted = [...cal.days].sort((a, b) =>
      a.level - b.level || a.count - b.count || a.date.localeCompare(b.date));
    const empty = sorted.filter((d) => d.level === 0).length;
    const active = sorted.length - empty;
    const span = Math.max(1, active - 1);

    let style =
      `.c{animation:${duration}s cubic-bezier(.6,0,.4,1) infinite;transform-box:fill-box;transform-origin:center}` +
      `.p{animation:p ${duration}s cubic-bezier(.6,0,.4,1) infinite;transform-box:fill-box;transform-origin:center}` +
      `@keyframes p{0%,${pct(CHECK[0])}{scale:1}${pct(CHECK[0] + POP / 2)}{scale:${PULSE}}${pct(CHECK[0] + POP)},to{scale:1}}`;

    const bg = [];
    slots.forEach((d, i) => {
      const p = ctx.pos(d.x, d.y);
      if (i >= empty || !active) {
        bg.push(rect(p.x, p.y, 'class="l0"'));
        return;
      }
      const delay = (lerp(CHECK, i / last) - CHECK[0]) / 100;
      bg.push(rect(p.x, p.y, `class="l0 p" style="animation-delay:${n(ctx.duration(CYCLE * delay))}s"`));
    });

    const cells = [];
    sorted.forEach((d, k) => {
      if (d.level === 0) return;
      const h = home.get(d);
      const from = ctx.pos(d.x, d.y);
      const t = slots[k];
      const to = ctx.pos(t.x, t.y);
      const dx = n(to.x - from.x);
      const dy = to.y - from.y;
      const at = `${dx}px ${n(dy)}px`;
      const up = `${dx}px ${n(dy - RISE)}px`;
      const rank = (k - empty) / span;
      const pick = lerp(PICK, h / last);
      const drop = lerp(DROP, rank);
      const check = lerp(CHECK, k / last);
      const unpick = lerp(UNPICK, 1 - rank);
      const undrop = lerp(UNDROP, 1 - h / last);
      const id = `s${k}`;
      // Keyframe selectors may list several offsets, which keeps each cell compact.
      style +=
        `@keyframes ${id}{` +
        `0%,${q(pick)},${q(undrop)},to{translate:0;scale:1}` +
        `${q(pick + LIFT)},${q(undrop - LIFT)}{translate:0 -${RISE}px;scale:${SCALE}}` +
        `${q(drop - LIFT)},${q(unpick + LIFT)}{translate:${up};scale:${SCALE}}` +
        `${q(drop)},${q(check)},${q(check + POP)},${q(unpick)}{translate:${at};scale:1}` +
        `${q(check + POP / 2)}{scale:${PULSE}}}`;
      cells.push(rect(from.x, from.y, `class="l${d.level} c" style="animation-name:${id}"`));
    });

    let head = '';
    if (active) {
      const x0 = origin.x - 3;
      const travel = n((cal.cols - 1) * PITCH);
      // The same head reads the input, then verifies the output.
      const sweep = ([a, b], lag) =>
        `${pct(a + lag - 1)}{translate:0;opacity:0}${pct(a + lag)}{translate:0;opacity:.35}` +
        `${pct(b + lag)}{translate:${travel}px;opacity:.35}${pct(b + lag + 1)}{translate:${travel}px;opacity:0}`;
      style +=
        `.h{animation:h ${duration}s linear infinite}` +
        `@keyframes h{0%{opacity:0}${sweep(PICK, LIFT / 2)}${sweep(CHECK, POP / 2)}to{opacity:0}}`;
      head = `<rect class="h" x="${n(x0)}" y="${n(origin.y - 3)}" width="17" height="${n(grid.height + 6)}" rx="4" fill="${colors.accent}" opacity="0"/>`;
    }

    return {
      style,
      body: `<g>${bg.join('')}</g><g>${cells.join('')}</g>${head}`,
    };
  },
};
