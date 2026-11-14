import { CELL, n } from '../core/svg.js';

// Every day is a split-flap tile on an airport departure board. Two cascades
// per loop sweep across the board; each tile clatters through a few random
// levels before its flap clacks back down onto the real one.

const CYCLE = 9; // seconds
const FLIP = 0.14; // seconds per flap
const SWEEP = 1.7; // seconds for a cascade to cross the board
const ROW_LAG = 0.045; // seconds between rows, gives the wave a slant
const JITTER = 0.08;
const WAVES = [0.35, 4.85]; // cascade start times; the second runs right to left
const POOL = 6; // flip sequences per level, shared by many tiles
const MIN_STEPS = 2; // intermediate levels per sequence
const MAX_STEPS = 5;
const WEIGHTS = [0.35, 0.8, 1.5, 2.4, 3]; // busy board: bright levels come up more often
const HALF = 5.2; // flap height; the rest of the cell is the hinge gap
const HINGE = CELL / 2;
// Flap motion as fractions of one flip.
const EDGE = 0.42; // flap is edge-on, the face switches here
const LAND = 0.78;
const BOUNCE = 0.88;

function hexToRgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return t < 0.5 ? a : b;
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

function pick(rng, weights) {
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** Levels shown by a tile: real, a few random intermediates, real again. */
function sequence(level, rng) {
  const steps = MIN_STEPS + Math.floor(rng() * (MAX_STEPS - MIN_STEPS + 1));
  const seq = [level];
  for (let i = 0; i < steps; i++) {
    const last = i === steps - 1;
    const w = WEIGHTS.map((v, l) => (l === seq[i] || (last && l === level) ? 0 : v));
    seq.push(pick(rng, w));
  }
  seq.push(level);
  return seq;
}

/** Keyframes body from stops, merging stops that share a declaration. */
function frames(list) {
  const stops = new Map();
  for (const [t, decl] of list) {
    if (!stops.has(decl)) stops.set(decl, []);
    stops.get(decl).push(`${n(t)}%`);
  }
  return [...stops].map(([decl, times]) => `${times.join(',')}{${decl}}`).join('');
}

export default {
  name: 'splitflap',
  description: 'Your graph becomes an airport departure board, every day clattering through its flaps.',

  render(ctx) {
    const { cal, colors, rng } = ctx;
    const cycle = ctx.duration(CYCLE);
    const s = (sec) => (sec / CYCLE) * 100;
    const F = s(FLIP);
    const eps = 0.01;
    const shade = (c) => mix(c, '#000000', ctx.mode === 'dark' ? 0.5 : 0.32);
    const lv = colors.levels;

    // Flap motion for a run of k flips: falls about the hinge, lands mirrored, bounces.
    const usedK = new Set();
    const motion = (k) => {
      const list = [];
      for (let i = 0; i < k; i++) {
        const b = i * F;
        if (i) list.push([b - eps, 'transform:scaleY(-1)']);
        list.push([b, 'transform:scaleY(1);animation-timing-function:cubic-bezier(.5,0,.9,.5)']);
        list.push([b + EDGE * F, 'transform:scaleY(0);animation-timing-function:cubic-bezier(.1,.5,.6,1)']);
        list.push([b + LAND * F, 'transform:scaleY(-1);animation-timing-function:ease-out']);
        list.push([b + BOUNCE * F, 'transform:scaleY(-.8);animation-timing-function:ease-in']);
      }
      list.push([k * F - eps, 'transform:scaleY(-1)']);
      list.push([100, 'transform:scaleY(-1)']);
      return `@keyframes fx-flap-k${k}{${frames(list)}}`;
    };

    let style =
      `.fxf use{animation-duration:${n(cycle)}s;animation-iteration-count:infinite;animation-delay:var(--d);animation-timing-function:step-end}` +
      `.fxf use:nth-child(3){transform-box:fill-box;transform-origin:0 ${HINGE}px;animation-timing-function:linear}` +
      `.fxf g g{animation:fx-flap-w ${n(cycle)}s step-end infinite;animation-delay:var(--d)}`;

    // Pattern classes are applied per cascade; the second cascade's tile copy
    // is only visible while it flips.
    const pools = lv.map((_, level) => Array.from({ length: POOL }, (_, i) => {
      const seq = sequence(level, rng);
      const k = seq.length - 1;
      usedK.add(k);
      const id = `p${level}${i}`;
      const top = [];
      const bottom = [];
      const flap = [];
      for (let j = 0; j < k; j++) {
        const b = j * F;
        const from = lv[seq[j]];
        const to = lv[seq[j + 1]];
        top.push([b, `fill:${to}`]);
        bottom.push([b + LAND * F, `fill:${to}`]);
        flap.push([b, `fill:${from}`]);
        flap.push([b + EDGE * F, `fill:${shade(from)}`]);
        flap.push([b + EDGE * F + eps, `fill:${shade(to)}`]);
        flap.push([b + LAND * F, `fill:${to}`]);
      }
      if (!bottom.some(([t]) => t === 0)) bottom.unshift([0, `fill:${lv[level]}`]);
      flap.push([100, `fill:${lv[level]}`]);
      style +=
        `@keyframes fx-flap-${id}t{${frames(top)}}` +
        `@keyframes fx-flap-${id}b{${frames(bottom)}}` +
        `@keyframes fx-flap-${id}f{${frames(flap)}}` +
        `.${id}>:nth-child(1){animation-name:fx-flap-${id}t}` +
        `.${id}>:nth-child(2){animation-name:fx-flap-${id}b}` +
        `.${id}>:nth-child(3){animation-name:fx-flap-k${k},fx-flap-${id}f}`;
      return { id, k };
    }));

    for (const k of [...usedK].sort()) style += motion(k);
    const maxK = Math.max(...usedK);
    style += `@keyframes fx-flap-w{0%{visibility:visible}${n(maxK * F + s(0.1))}%,100%{visibility:hidden}}`;

    const span = Math.max(1, cal.cols - 1);
    const delay = (sec) => {
      const t = ((ctx.duration(sec) % cycle) + cycle) % cycle;
      return `${n(t - cycle)}s`;
    };
    const flaps = '<use href="#fx-flap-a"/><use href="#fx-flap-b"/><use href="#fx-flap-a"/>';

    const tiles = cal.days.map((d) => {
      const p = ctx.pos(d.x, d.y);
      const fx = d.x / span;
      const pool = pools[d.level];
      const a = pool[Math.floor(rng() * POOL)];
      const b = pool[Math.floor(rng() * POOL)];
      const t1 = WAVES[0] + SWEEP * fx + ROW_LAG * d.y + rng() * JITTER;
      const t2 = WAVES[1] + SWEEP * (1 - fx) + ROW_LAG * (6 - d.y) + rng() * JITTER;
      return `<g class="${a.id} l${d.level}" style="--d:${delay(t1)}" transform="translate(${n(p.x)} ${n(p.y)})">${flaps}` +
        `<g class="${b.id}" style="--d:${delay(t2)}">${flaps}</g></g>`;
    }).join('');

    // Halves are rounded on the outside only, square along the hinge.
    const r = 2;
    const w = CELL - 2 * r;
    const defs =
      `<defs><path id="fx-flap-a" d="M0 ${HALF}V${r}a${r} ${r} 0 0 1 ${r}-${r}h${w}a${r} ${r} 0 0 1 ${r} ${r}V${HALF}z"/>` +
      `<path id="fx-flap-b" d="M0 ${n(CELL - HALF)}h${CELL}V${CELL - r}a${r} ${r} 0 0 1-${r} ${r}h-${w}a${r} ${r} 0 0 1-${r}-${r}z"/></defs>`;

    return { style, body: `${defs}<g class="fxf">${tiles}</g>` };
  },
};
