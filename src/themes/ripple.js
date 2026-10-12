import { CELL, n, pct, rect } from '../core/svg.js';

// Drops fall onto the busiest days; each one sends a circular wave across
// the graph. Cells pop and glint as a wavefront passes, then settle.

const CYCLE = 9; // seconds
const SPEED = 320; // px per second
const FIRST_DROP = 0.7;
const LAST_DROP = 5.2;
const MAX_DROPS = 4;
const MIN_COL_GAP = 9;
const REACH = 800; // px, the wave has fully faded by this distance
const FALL = 0.45; // droplet fall time before impact
const RING_LIFE = 2.3;
// Shape of a single cell pop, relative to the moment the wavefront arrives.
const PRE = 0.04;
const PEAK = 0.05;
const TROUGH = 0.15;
const POST = 0.3;

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

/** Busiest days, spread apart in time, in a shuffled emission order. */
function pickDrops(cal, rng) {
  // One drop per stretch of the year, favouring busy days near the stretch's middle.
  const segments = Math.max(1, Math.min(MAX_DROPS, Math.floor(cal.cols / MIN_COL_GAP)));
  const width = cal.cols / segments;
  const best = new Array(segments).fill(null);
  for (const d of cal.days) {
    if (d.count <= 0) continue;
    const i = Math.min(segments - 1, Math.floor((d.x + 0.5) / width));
    const off = Math.abs((d.x + 0.5) / width - i - 0.5) * 2;
    const score = d.count * (1 - 0.6 * off);
    const b = best[i];
    if (!b || score > b.score || (score === b.score && d.date > b.day.date)) best[i] = { day: d, score };
  }
  const drops = best.filter(Boolean).map((b) => b.day);
  if (!drops.length && cal.days.length) {
    drops.push(cal.days.reduce((a, b) => (b.date > a.date ? b : a)));
  }
  for (let i = drops.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [drops[i], drops[j]] = [drops[j], drops[i]];
  }
  return drops;
}

const short = (v) => n(v).replace(/^0\./, '.');

function strength(dist) {
  if (dist >= REACH) return 0;
  return Math.min(1, 1 / Math.sqrt(1 + dist / 90)) * (1 - (dist / REACH) ** 2);
}

export default {
  name: 'ripple',
  description: 'Your busiest days fall like drops into water, sending shockwaves across the graph.',

  render(ctx) {
    const { cal, colors, rng } = ctx;
    const cycle = ctx.duration(CYCLE);
    const s = (sec) => sec / CYCLE * 100; // seconds of the unscaled cycle -> percent
    const at = (sec) => `${short(Math.round(s(sec) * 10) / 10)}%`;
    const half = CELL / 2;
    const center = (d) => {
      const p = ctx.pos(d.x, d.y);
      return { x: p.x + half, y: p.y + half };
    };

    const { accent } = colors;
    const flash = ctx.mode === 'dark' ? mix(accent, '#ffffff', 0.3) : accent;
    const drops = pickDrops(cal, rng).map((d, i, all) => ({
      ...center(d),
      day: d,
      t: all.length > 1 ? FIRST_DROP + (i * (LAST_DROP - FIRST_DROP)) / (all.length - 1) : FIRST_DROP + 0.5,
    }));

    let style =
      colors.levels.map((c, i) =>
        `.l${i}{--b:${c};--p1:${mix(c, accent, 0.3)};--p2:${mix(c, accent, 0.6)};--p3:${accent};--p4:${flash}}`).join('') +
      `.rp rect{transform-box:fill-box;transform-origin:center;animation:${n(cycle)}s ease-in-out infinite}` +
      `.rg,.dp{transform-box:fill-box;transform-origin:center;opacity:0;animation:${n(cycle)}s linear infinite}` +
      `.rg{fill:none;stroke:${accent};stroke-width:1.5;vector-effect:non-scaling-stroke;animation-name:rg}` +
      `.dp{fill:${flash};animation-name:dp;animation-timing-function:cubic-bezier(.5,0,1,1)}`;

    const ringScale = (SPEED * RING_LIFE) / 10;
    style +=
      `@keyframes rg{0%{scale:.05;opacity:0}${pct(s(0.04))}{opacity:.75}${pct(s(0.8))}{opacity:.32}` +
      `${pct(s(RING_LIFE))}{scale:${n(ringScale)};opacity:0}${pct(s(RING_LIFE))},100%{scale:${n(ringScale)};opacity:0}}` +
      `@keyframes dp{0%{scale:5;opacity:0}${pct(s(FALL * 0.6))}{opacity:.55}${pct(s(FALL))}{scale:1;opacity:1}` +
      `${pct(s(FALL + 0.15))},100%{scale:3;opacity:0}}`;

    const cells = [];
    let k = 0;
    for (const d of cal.days) {
      const p = ctx.pos(d.x, d.y);
      const c = center(d);
      const hits = [];
      for (const drop of drops) {
        const dist = Math.hypot(c.x - drop.x, c.y - drop.y);
        const st = dist < 1 ? 1.25 : strength(dist);
        if (st < 0.1) continue;
        const t = drop.t + dist / SPEED;
        if (t - PRE < 0 || t + POST > CYCLE) continue;
        const clash = hits.findIndex((h) => Math.abs(h.t - t) < PRE + POST);
        if (clash !== -1) {
          // Crossing wavefronts interfere constructively.
          const other = hits[clash];
          const strong = other.st >= st ? other : { t, st };
          hits[clash] = { t: strong.t, st: Math.min(1.25, strong.st + 0.6 * Math.min(other.st, st)) };
          continue;
        }
        hits.push({ t, st });
      }
      if (!hits.length) {
        cells.push(rect(p.x, p.y, `class="l${d.level}"`));
        continue;
      }
      hits.sort((a, b) => a.t - b.t);
      // Keyframe stops sharing the same declarations are merged into one selector.
      const stops = new Map();
      const add = (decl, ...times) => {
        if (!stops.has(decl)) stops.set(decl, []);
        stops.get(decl).push(...times.map(at));
      };
      for (const h of hits) {
        const q = Math.max(1, Math.min(4, Math.round(h.st * 4)));
        const peak = Math.round((1 + 0.5 * h.st) * 20) / 20;
        add('scale:1;fill:var(--b)', h.t - PRE, h.t + POST);
        add(`scale:${short(peak)};fill:var(--p${q})`, h.t + PEAK);
        add(`scale:${h.st >= 0.6 ? '.88' : '.95'};fill:var(--b)`, h.t + TROUGH);
      }
      const name = `c${k++}`;
      style += `@keyframes ${name}{${[...stops].map(([decl, times]) => `${times.join(',')}{${decl}}`).join('')}}`;
      cells.push(rect(p.x, p.y, `class="l${d.level}" style="animation-name:${name}"`));
    }

    const fx = drops.map((drop) => {
      const cx = n(drop.x);
      const cy = n(drop.y);
      return (
        `<circle class="dp" cx="${cx}" cy="${cy}" r="4" style="animation-delay:${n(ctx.duration(drop.t - FALL))}s"/>` +
        `<circle class="rg" cx="${cx}" cy="${cy}" r="10" style="animation-delay:${n(ctx.duration(drop.t + PEAK))}s"/>` +
        `<circle class="rg" cx="${cx}" cy="${cy}" r="10" stroke-opacity=".45" style="animation-delay:${n(ctx.duration(drop.t + 0.22))}s"/>`
      );
    }).join('');

    return {
      style,
      body: `<g class="rp">${cells.join('')}</g><g>${fx}</g>`,
    };
  },
};
