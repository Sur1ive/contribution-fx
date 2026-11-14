import { PALETTES } from '../core/palette.js';
import { n, pct } from '../core/svg.js';

// Every cell is a neon tube. The sign sits dark, powers on block by block
// with stuttering flickers, glows steadily (a tube or two buzzing), then
// browns out and cuts. The resting state is the fully lit sign, so the
// static / reduced-motion view is the plain graph.

const CYCLE = 10; // seconds
const ON_START = 0.8; // first block catches
const ON_END = 3.4; // last block catches
const DOWN = 8.75; // brown-out starts
const OFF = 9.3; // dark until the loop restarts
const BUZZERS = 2;
const INSET = 0.8; // half the tube stroke, so tubes fill the 11px cell
const TUBE = 11 - INSET * 2;
const BOARD = '#0d1117'; // light mode mounts the sign on a dark backing
const FRAME = 9; // board margin around the grid (px)

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

const short = (v) => n(v).replace(/^(-?)0\./, '$1.');

/** The dark twin of a light palette, so the light-mode sign can burn on a dark board. */
function darkTwin(colors) {
  const twin = Object.values(PALETTES).find((p) => p.light.levels.join() === colors.levels.join());
  if (twin) return twin.dark;
  const A = colors.accent;
  const E = '#161b22';
  return { levels: [E, mix(E, A, 0.35), mix(E, A, 0.65), A, mix(A, '#ffffff', 0.4)], text: '#8b949e', accent: A };
}

/** Per level: unlit glass stroke, lit tube colour, lit fill opacity, white-hot core line. */
function tubeColors(colors) {
  const L = colors.levels;
  const W = '#ffffff';
  const empty = mix(L[0], colors.text, 0.2);
  const lit = [mix(empty, mix(L[2], L[3], 0.5), 0.2), mix(L[2], L[3], 0.5), L[3], mix(L[4], W, 0.1), mix(L[4], W, 0.3)];
  return {
    glass: [empty, ...lit.slice(1).map((c) => mix(empty, c, 0.28))],
    lit,
    fill: [0, 0.14, 0.22, 0.32, 0.5],
    core: [null, null, null, mix(lit[3], W, 0.55), mix(lit[4], W, 0.85)],
  };
}

/** Split the weeks into blocks of 2-4 columns, each cut once at a random row. */
function segments(cal, rng) {
  const segs = [];
  for (let x = 0; x < cal.cols;) {
    const w = Math.min(cal.cols - x, 2 + Math.floor(rng() * 3));
    const cut = 2 + Math.floor(rng() * 4);
    segs.push({ x0: x, x1: x + w, y0: 0, y1: cut, days: [] });
    segs.push({ x0: x, x1: x + w, y0: cut, y1: 7, days: [] });
    x += w;
  }
  for (const d of cal.days) {
    const s = segs.find((g) => d.x >= g.x0 && d.x < g.x1 && d.y >= g.y0 && d.y < g.y1);
    if (s) s.days.push(d);
  }
  return segs.filter((s) => s.days.length);
}

/** Opacity steps for one block: 1-3 stutters, then it catches at `t`. */
function powerOn(t, rng) {
  const ev = [];
  let cursor = t;
  const stutters = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < stutters; i++) {
    const gap = 0.05 + rng() * 0.16;
    const len = 0.03 + rng() * 0.06;
    ev.unshift([cursor - gap - len, 0.35 + rng() * 0.65], [cursor - gap, 0]);
    cursor -= gap + len;
  }
  if (rng() < 0.5) {
    ev.push([t, 0.5], [t + 0.06 + rng() * 0.06, 1]);
  } else {
    ev.push([t, 1]);
    if (rng() < 0.5) {
      const dip = t + 0.08 + rng() * 0.1;
      ev.push([dip, 0.2], [dip + 0.04 + rng() * 0.03, 1]);
    }
  }
  return ev;
}

/** A failing tube: it sputters out, stays dead for a beat, then sputters back. */
function buzz(t, rng) {
  const ev = [];
  let c = t;
  const sputter = () => {
    const steps = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < steps * 2; i++) {
      ev.push([c, i % 2 ? 0.6 + rng() * 0.4 : rng() * 0.2]);
      c += 0.03 + rng() * 0.06;
    }
  };
  sputter();
  ev.push([c, 0.05]);
  c += 0.35 + rng() * 0.4;
  sputter();
  ev.push([c, 1]);
  return ev;
}

export default {
  name: 'neon',
  description: 'Your graph becomes a neon sign that stutters to life block by block, hums, buzzes and cuts out.',

  render(ctx) {
    const { cal, colors, rng } = ctx;
    const dark = ctx.mode === 'dark';
    const cycle = n(ctx.duration(CYCLE));
    const at = (sec) => pct(Math.round((sec / CYCLE) * 10000) / 100);
    const keyframes = (name, ev, rest, end = 1) => {
      const stops = [`0%{opacity:${rest}}`];
      for (const [t, op] of ev) {
        if (t > 0.02 && t < CYCLE) stops.push(`${at(t)}{opacity:${short(Math.round(op * 100) / 100)}}`);
      }
      stops.push(`100%{opacity:${end}}`);
      return `@keyframes ${name}{${stops.join('')}}`;
    };

    const tc = tubeColors(dark ? colors : darkTwin(colors));
    let style =
      `.fx-neon-t rect{stroke-width:1.6;fill:none}` +
      tc.glass.map((c, i) => `.g${i}{stroke:${c}}`).join('') +
      tc.lit.map((c, i) => (c ? `.fx-neon-t .n${i}{stroke:${c}${i ? `;fill:${c};fill-opacity:${tc.fill[i]}` : ''}}` : '')).join('') +
      tc.core.map((c, i) => (c ? `.fx-neon-t .c${i}{stroke:${c};stroke-width:.6}` : '')).join('') +
      `.s,.bz,.pw{animation:${cycle}s step-end infinite}.pw{animation-name:pw}`;

    const segs = segments(cal, rng);
    // Mostly left to right, with enough jitter that blocks catch out of order.
    const order = segs
      .map((s, i) => ({ s, key: (s.x0 + s.x1) / 2 / Math.max(1, cal.cols) + rng() * 0.5, i }))
      .sort((a, b) => a.key - b.key || a.i - b.i);
    order.forEach((o, rank) => {
      o.s.t = ON_START + (order.length > 1 ? rank / (order.length - 1) : 0.5) * (ON_END - ON_START);
    });

    const hot = cal.days.filter((d) => d.level >= 3);
    const buzzers = [];
    for (let i = 0; i < BUZZERS * 3 && buzzers.length < BUZZERS && hot.length; i++) {
      const d = hot[Math.floor(rng() * hot.length)];
      if (buzzers.every((b) => Math.abs(b.x - d.x) > 8)) buzzers.push(d);
    }

    const tube = (d, cls) => {
      const p = ctx.pos(d.x, d.y);
      return `<rect x="${n(p.x + INSET)}" y="${n(p.y + INSET)}" width="${n(TUBE)}" height="${n(TUBE)}" rx="2" class="${cls}"/>`;
    };

    const glass = cal.days.map((d) => tube(d, `g${d.level}`)).join('');
    const groups = segs.map((s, k) => {
      style += keyframes(`k${k}`, powerOn(s.t, rng), 0);
      const cells = s.days.map((d) => {
        const b = buzzers.indexOf(d);
        if (!tc.lit[d.level]) return '';
        const svg = tube(d, `n${d.level}`) + (tc.core[d.level] ? tube(d, `c${d.level}`) : '');
        return b === -1 ? svg : `<g class="bz" style="animation-name:b${b}">${svg}</g>`;
      }).join('');
      return `<g class="s" style="animation-name:k${k}">${cells}</g>`;
    }).join('');

    buzzers.forEach((_, i) => {
      style += keyframes(`b${i}`, buzz(4.6 + i * 1.9 + rng() * 0.6, rng), 1);
    });
    // Mains hum: two faint whole-sign dips while lit, then the brown-out.
    style += keyframes('pw', [[5.35, 0.85], [5.4, 1], [7.7, 0.9], [7.74, 1], [DOWN, 0.45], [DOWN + 0.07, 1], [DOWN + 0.16, 0.2], [DOWN + 0.22, 0.8], [DOWN + 0.3, 0.3], [OFF, 0]], 1, 0);

    const { width, height } = ctx;
    const filter =
      `<filter id="fx-neon-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="b"/>` +
      `<feComponentTransfer in="b" result="b"><feFuncA type="linear" slope="1.7"/></feComponentTransfer>` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="a"/>` +
      `<feMerge><feMergeNode in="b"/><feMergeNode in="a"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    const { origin, grid } = ctx;
    const board = dark
      ? ''
      : `<rect x="${n(origin.x - FRAME)}" y="${n(origin.y - FRAME)}" width="${n(grid.width + FRAME * 2)}" height="${n(grid.height + FRAME * 2)}" rx="6" fill="${BOARD}"/>`;

    return {
      style,
      body:
        `<defs>${filter}</defs>${board}` +
        `<g class="fx-neon-t"><g>${glass}</g>` +
        `<g class="pw" filter="url(#fx-neon-glow)">${groups}</g></g>`,
    };
  },
};
