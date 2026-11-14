import { CELL, PITCH, n, pct } from '../core/svg.js';

// Railgun. A shot charges up at the left edge, then tears along the middle
// row at warp speed. Its Mach cone sweeps through the graph: every cell is hit
// when the cone reaches it, blasted away from the lane and dragged forward, then
// springs back with a damped wobble. Cells share one keyframe set per row; the
// column only shifts the timing (animation-delay = time for the shot to get there).

const CYCLE = 9; // seconds
const T0 = 4.2; // launch
const V = 1700; // px per second
const TAN = 0.26; // Mach cone slope (dy / dx)
const LANE = 3; // row the shot flies along
const TRAIL = 320;
const ANT = 1.8; // the graph pinches toward the lane before the launch
const RISE = 0.05;
const PULSES = [1.9, 2.6, 3.1, 3.45, 3.7, 3.88]; // charge rings, accelerating
const INFLOW = 26; // streaks of light drawn into the shot while it charges
const INFLOW_REACH = [140, 240, 360];
const SPARKS = 34;
const SPARK_REACH = [16, 26, 38];
// Peak response per row distance from the lane.
const PEAK = [
  { x: 6, y: 0, sx: 2.2, sy: 0.45, in: 0, lean: 2 },
  { x: 3.5, y: 7, sx: 1.5, sy: 0.78, in: 2.2, lean: 1.6 },
  { x: 2, y: 4.5, sx: 1.22, sy: 0.88, in: 2, lean: 1.2 },
  { x: 1, y: 2.5, sx: 1.1, sy: 0.94, in: 1.6, lean: 0.9 },
];

const at = (t) => pct((t / CYCLE) * 100);
const num = (v) => {
  const s = n(Math.abs(v) < 0.005 ? 0 : v);
  return s.replace(/^(-?)0\./, '$1.');
};

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

/** Sharp rise to 1, then a damped oscillation around 0. */
function spring(u, tau, period) {
  if (u <= 0) return 0;
  if (u < RISE) return 1 - (1 - u / RISE) ** 2;
  const v = u - RISE;
  return Math.exp(-v / tau) * Math.cos((2 * Math.PI * v) / period);
}

/** Keyframes from [time, declarations] pairs; identical neighbours collapse. */
function keyframes(name, stops) {
  const out = [];
  for (let i = 0; i < stops.length; i++) {
    const [t, decl] = stops[i];
    const prev = stops[i - 1]?.[1];
    const next = stops[i + 1]?.[1];
    if (decl === prev && decl === next) continue;
    out.push(`${at(t)}{${decl}}`);
  }
  return `@keyframes ${name}{${out.join('')}}`;
}

const lagOf = (dr) => (dr * PITCH) / (V * TAN);

function rowFrames(r) {
  const dr = Math.abs(r - LANE);
  const s = Math.sign(r - LANE);
  const p = PEAK[dr];
  const hit = T0 + lagOf(dr);
  const lean = (t) => Math.min(1, Math.max(0, (t - (T0 - ANT)) / (ANT - 0.05))) ** 2.2;
  const times = new Set([0, T0 - ANT, CYCLE]);
  for (let t = T0 - ANT; t < hit; t += 0.12) times.add(t);
  times.add(T0 - 0.05);
  for (const u of [0, 0.01, 0.025, 0.04]) times.add(hit + u);
  for (let u = RISE; u < 0.4; u += 0.02) times.add(hit + u);
  for (let u = 0.4; u <= 1.5; u += 0.045) times.add(hit + u);
  const sorted = [...times].map((t) => Math.round(t * 1000) / 1000).sort((a, b) => a - b);
  return keyframes(`m${r}`, sorted.map((t) => {
    const u = t - hit;
    const pre = lean(t) * (1 - Math.min(1, Math.max(0, u / RISE)));
    const fd = spring(u, 0.22, 0.36);
    const fs = spring(u, 0.1, 0.24);
    const dx = -p.lean * pre + p.x * fd;
    const dy = -s * p.in * pre + s * p.y * fd;
    const sx = 1 + (p.sx - 1) * fs;
    const sy = 1 + (p.sy - 1) * fs;
    return [t, `transform:translate(${num(dx)}px,${num(dy)}px) scale(${num(sx)},${num(sy)})`];
  }));
}

export default {
  name: 'railgun',
  description: 'A railgun charges up and fires across your graph, its shockwave blasting the days aside.',

  render(ctx) {
    const { cal, colors, rng, grid, origin, width } = ctx;
    const dark = ctx.mode === 'dark';
    const { accent, levels } = colors;
    const dur = (s) => n(ctx.duration(s));
    const delay = (s) => String(Math.round(ctx.duration(s) * 1000) / 1000);
    const loop = `${dur(CYCLE)}s linear infinite`;
    const half = CELL / 2;
    const laneY = origin.y + LANE * PITCH + half;
    const x0 = origin.x + 4;
    const exitX = Math.max(x0 + 60, Math.min(width - 50, origin.x + grid.width - 3 * PITCH));
    const TE = T0 + (exitX - x0) / V; // shot jumps out here
    const gone = TE + TRAIL / V; // trail fully sucked into the exit point

    const hot = levels.map((c) => (dark ? mix(mix(c, accent, 0.6), '#ffffff', 0.18) : mix(c, accent, 0.6)));
    const warm = levels.map((c) => (dark ? mix(mix(c, accent, 0.35), '#ffffff', 0.06) : mix(c, accent, 0.35)));
    const white = dark ? mix(accent, '#ffffff', 0.8) : mix(accent, '#000000', 0.12);
    const core = dark ? mix(accent, '#ffffff', 0.85) : mix(accent, '#000000', 0.3);
    const beam = dark ? mix(accent, '#ffffff', 0.45) : accent;
    const flare = dark ? mix(accent, '#ffffff', 0.6) : accent;

    let style =
      levels.map((c, i) => `.l${i}{--b:${c};--h:${hot[i]};--g:${warm[i]};--w:${white}}`).join('') +
      `.wg rect{transform-box:fill-box;transform-origin:center;animation-duration:${dur(CYCLE)}s;animation-timing-function:linear;animation-iteration-count:infinite}` +
      `.wk{animation:wk ${loop}}` +
      `.ws{opacity:0;animation:ws ${loop},wo ${loop}}.wh{animation:wh ${loop}}` +
      `.wc,.wt,.wb,.wr,.wm,.wf,.wa,.wv{opacity:0;transform-box:fill-box;transform-origin:center}` +
      `.wc{animation:wc ${loop}}` +
      `.wt{transform-origin:100% 50%;animation:wt ${loop}}` +
      `.wb{transform-origin:0 50%;animation:wb ${loop}}` +
      `.wr{fill:none;stroke:${beam};stroke-width:1.3;vector-effect:non-scaling-stroke;animation:wr ${loop}}` +
      `.wm{fill:none;stroke:${beam};stroke-width:1.6;vector-effect:non-scaling-stroke;animation:wm ${loop}}` +
      `.wf{animation:wf ${loop}}.wa{animation:wa ${loop}}.wv{animation:wv ${loop}}` +
      `.wg0{opacity:.6;transform-box:fill-box;transform-origin:center;animation:wg0 ${loop}}`;

    for (let r = 0; r < 7; r++) {
      const dr = Math.abs(r - LANE);
      style += `.wg .y${r}{animation-name:m${r}${dr < 2 ? `,h${dr}` : ''}}` + rowFrames(r);
    }

    const B = 'fill:var(--b)';
    const lane = [[0, B], [T0 - ANT, B], [T0 - 0.01, 'fill:var(--g)'], [T0 + 0.02, 'fill:var(--w)'], [T0 + 0.25, 'fill:var(--w)'], [T0 + 0.65, 'fill:var(--h)'], [T0 + 1.7, B], [CYCLE, B]];
    const h1 = T0 + lagOf(1);
    style += keyframes('h0', lane) +
      keyframes('h1', [[0, B], [h1 - 0.01, B], [h1 + 0.03, 'fill:var(--h)'], [h1 + 0.15, 'fill:var(--g)'], [h1 + 0.75, B], [CYCLE, B]]);

    // Tremble while charging, camera kick at launch.
    const kick = [[0, 'transform:translate(0,0)'], [T0 - 0.8, 'transform:translate(0,0)']];
    for (let t = T0 - 0.76; t < T0 - 0.02; t += 0.04) {
      const a = 0.15 + 0.5 * ((t - T0 + 0.8) / 0.8) ** 2;
      kick.push([t, `transform:translate(${num((rng() * 2 - 1) * a)}px,${num((rng() * 2 - 1) * a)}px)`]);
    }
    kick.push([T0, 'transform:translate(0,0)']);
    for (let t = T0 + 0.03; t < T0 + 0.5; t += 0.04) {
      const a = 2.2 * (1 - (t - T0) / 0.5) ** 2;
      kick.push([t, `transform:translate(${num((rng() * 2 - 1) * a)}px,${num((rng() * 2 - 1) * a)}px)`]);
    }
    kick.push([T0 + 0.52, 'transform:translate(0,0)'], [CYCLE, 'transform:translate(0,0)']);
    style += keyframes('wk', kick);

    // Shot: trembles while charging, recoils, then flies at constant speed.
    const ship = [[0, 'transform:translate(0,0)'], [T0 - 0.9, 'transform:translate(0,0)']];
    for (let t = T0 - 0.86; t < T0 - 0.3; t += 0.05) {
      const a = 0.3 + 0.8 * ((t - T0 + 0.9) / 0.6);
      ship.push([t, `transform:translate(${num((rng() * 2 - 1) * a)}px,${num((rng() * 2 - 1) * a)}px)`]);
    }
    ship.push([T0 - 0.28, 'transform:translate(0,0);animation-timing-function:cubic-bezier(.2,.8,.3,1)'], [T0, 'transform:translate(-6px,0)'],
      [TE, `transform:translate(${num(exitX - x0)}px,0)`], [CYCLE, `transform:translate(${num(exitX - x0)}px,0)`]);
    style += keyframes('ws', ship) +
      keyframes('wo', [[0, 'opacity:0'], [1, 'opacity:0'], [1.5, 'opacity:1'], [gone, 'opacity:1'], [gone + 0.01, 'opacity:0'], [CYCLE, 'opacity:0']]) +
      keyframes('wh', [[0, 'opacity:1'], [TE, 'opacity:1'], [TE + 0.02, 'opacity:0'], [CYCLE - 0.01, 'opacity:0'], [CYCLE, 'opacity:1']]);

    const glow = [[0, 'opacity:.3;transform:scale(.3)'], [1.2, 'opacity:.3;transform:scale(.3)']];
    PULSES.forEach((p, i) => {
      const s = 0.4 + 0.11 * i;
      glow.push([p + 0.38, `opacity:${num(0.4 + 0.08 * i)};transform:scale(${num(s)})`], [p + 0.45, `opacity:${num(0.75 + 0.04 * i)};transform:scale(${num(s + 0.12)})`]);
    });
    glow.push([T0 - 0.02, 'opacity:1;transform:scale(1.15)'], [T0 + 0.04, 'opacity:1;transform:scale(1.8)'], [T0 + 0.16, 'opacity:.85;transform:scale(1)'], [CYCLE, 'opacity:.85;transform:scale(1)']);
    style += keyframes('wg0', glow.sort((a, b) => a[0] - b[0]));

    style +=
      keyframes('wc', [[0, 'opacity:0'], [T0, 'opacity:0'], [T0 + 0.03, 'opacity:.9'], [TE, 'opacity:.7'], [TE + 0.12, 'opacity:0'], [CYCLE, 'opacity:0']]) +
      keyframes('wt', [[0, 'opacity:0;transform:scaleX(0)'], [T0, 'opacity:0;transform:scaleX(0)'], [T0 + 0.01, 'opacity:1;transform:scaleX(0)'],
        [Math.min(TE, T0 + TRAIL / V), 'opacity:1;transform:scaleX(1)'], [TE, 'opacity:1;transform:scaleX(1)'], [gone, 'opacity:1;transform:scaleX(0)'],
        [gone + 0.01, 'opacity:0;transform:scaleX(0)'], [CYCLE, 'opacity:0;transform:scaleX(0)']]) +
      keyframes('wb', [[0, 'opacity:0;transform:scale(0,1)'], [T0, 'opacity:0;transform:scale(0,1)'], [T0 + 0.01, 'opacity:.9;transform:scale(0,1)'],
        [TE, 'opacity:.9;transform:scale(1,1);animation-timing-function:cubic-bezier(.3,0,.7,1)'], [TE + 1.6, 'opacity:0;transform:scale(1,.15)'], [CYCLE, 'opacity:0;transform:scale(1,.15)']]) +
      keyframes('wr', [[0, 'opacity:0;transform:scale(2.6);animation-timing-function:cubic-bezier(.5,0,.9,.6)'], [0.06, 'opacity:.85'], [0.42, 'opacity:.2;transform:scale(.25)'],
        [0.46, 'opacity:0;transform:scale(.2)'], [CYCLE, 'opacity:0;transform:scale(.2)']]) +
      keyframes('wm', [[0, 'opacity:0;transform:scale(.3)'], [T0, 'opacity:0;transform:scale(.3);animation-timing-function:cubic-bezier(.1,.7,.3,1)'],
        [T0 + 0.02, 'opacity:.8'], [T0 + 0.6, 'opacity:0;transform:scale(7)'], [CYCLE, 'opacity:0;transform:scale(7)']]) +
      keyframes('wf', [[0, 'opacity:0;transform:scale(.2)'], [TE - 0.01, 'opacity:0;transform:scale(.2);animation-timing-function:cubic-bezier(.1,.7,.3,1)'],
        [TE + 0.03, 'opacity:1'], [TE + 0.55, 'opacity:0;transform:scale(1.5)'], [CYCLE, 'opacity:0;transform:scale(1.5)']]) +
      keyframes('wa', [[0, 'opacity:0;transform:scaleX(.15)'], [TE - 0.01, 'opacity:0;transform:scaleX(.15);animation-timing-function:cubic-bezier(.1,.8,.3,1)'],
        [TE + 0.04, 'opacity:1'], [TE + 0.8, 'opacity:0;transform:scaleX(1)'], [CYCLE, 'opacity:0;transform:scaleX(1)']]) +
      keyframes('wv', [[0, 'opacity:0;transform:scale(.2)'], [TE - 0.01, 'opacity:0;transform:scale(.2);animation-timing-function:cubic-bezier(.1,.8,.3,1)'],
        [TE + 0.03, 'opacity:1;transform:scale(1)'], [TE + 0.12, 'opacity:.9;transform:scale(.8)'], [TE + 0.45, 'opacity:0;transform:scale(.3,.1)'], [CYCLE, 'opacity:0;transform:scale(.3,.1)']]);

    // Debris kicked forward off the lane in the shot's wake.
    let sparks = '';
    SPARK_REACH.forEach((r, i) => {
      style += `.wp${i}{opacity:0;animation:wp${i} ${loop}}` + keyframes(`wp${i}`, [[0, 'opacity:0;transform:translateX(0)'],
        [T0, 'opacity:0;transform:translateX(0);animation-timing-function:cubic-bezier(.1,.75,.3,1)'], [T0 + 0.01, 'opacity:1'],
        [T0 + 0.6, `opacity:0;transform:translateX(${r}px)`], [CYCLE, `opacity:0;transform:translateX(${r}px)`]]);
    });
    const sparkEnd = Math.min(exitX, origin.x + grid.width);
    for (let i = 0; i < SPARKS; i++) {
      const sx = origin.x + 10 + rng() * Math.max(1, sparkEnd - origin.x - 10);
      const side = i % 2 ? 1 : -1;
      const a = side * (20 + rng() * 45);
      const v = Math.floor(rng() * SPARK_REACH.length);
      sparks += `<g transform="translate(${n(sx)},${n(laneY + side * 2)}) rotate(${n(a)})"><rect class="wp${v}" x="-5" y="-.7" width="6" height="1.4" rx=".7" style="animation-delay:${delay((sx - x0) / V - CYCLE)}s"/></g>`;
    }

    // Light streaks pulled out of the graph into the charging shot, faster and faster.
    let inflow = '';
    const life = 0.42;
    INFLOW_REACH.forEach((r, i) => {
      style += `.wi${i}{opacity:0;animation:wi${i} ${loop}}` + keyframes(`wi${i}`, [[0, `opacity:0;transform:translateX(${r}px) scaleX(.6);animation-timing-function:cubic-bezier(.55,0,.9,.4)`],
        [0.06, 'opacity:.9'], [life, 'opacity:.9;transform:translateX(0) scaleX(1.6)'], [life + 0.02, 'opacity:0;transform:translateX(0) scaleX(1.6)'], [CYCLE, 'opacity:0;transform:translateX(0) scaleX(1.6)']]);
    });
    const reachMax = Math.max(40, origin.x + grid.width - x0);
    for (let i = 0; i < INFLOW; i++) {
      const t = 1.7 + (T0 - life - 0.05 - 1.7) * (i / (INFLOW - 1)) ** 0.55;
      const v = Math.min(INFLOW_REACH.length - 1, Math.floor(rng() * INFLOW_REACH.length));
      const dist = Math.min(INFLOW_REACH[v], reachMax);
      const a = (Math.atan2((rng() * 2 - 1) * 44, dist) * 180) / Math.PI;
      inflow += `<g transform="rotate(${n(a)})"><rect class="wi${v}" x="4" y="-.8" width="30" height="1.6" rx=".8" fill="url(#fx-railgun-i)" style="animation-delay:${dur(t - CYCLE)}s"/></g>`;
    }

    const cols = new Map();
    for (const d of cal.days) {
      const p = ctx.pos(d.x, d.y);
      if (!cols.has(d.x)) cols.set(d.x, { cx: p.x + half, cells: [] });
      cols.get(d.x).cells.push(`<rect x="${n(p.x)}" y="${n(p.y)}" width="${CELL}" height="${CELL}" rx="2" class="l${d.level} y${d.y}"/>`);
    }
    let grid2 = '';
    for (const [x, c] of [...cols].sort((a, b) => a[0] - b[0])) {
      style += `.k${x} rect{animation-delay:${delay((c.cx - x0) / V - CYCLE)}s}`;
      grid2 += `<g class="k${x}">${c.cells.join('')}</g>`;
    }

    const ang = (Math.atan(TAN) * 180) / Math.PI;
    const coneLen = (grid.height / 2 + 14) / Math.sin(Math.atan(TAN));
    const cone = [ang, -ang].map((a) =>
      `<g transform="rotate(${n(a)})"><rect class="wc" x="${n(-coneLen)}" y="-.6" width="${n(coneLen)}" height="1.2" fill="url(#fx-railgun-c)"/></g>`).join('');
    const rings = PULSES.map((p) => `<circle class="wr" r="15" style="animation-delay:${dur(p - CYCLE)}s"/>`).join('');

    const defs =
      '<defs>' +
      `<radialGradient id="fx-railgun-g"><stop offset="0" stop-color="${core}"/><stop offset=".25" stop-color="${flare}" stop-opacity=".8"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="fx-railgun-t"><stop offset="0" stop-color="${accent}" stop-opacity="0"/><stop offset=".75" stop-color="${beam}" stop-opacity=".8"/><stop offset="1" stop-color="${core}"/></linearGradient>` +
      `<linearGradient id="fx-railgun-i"><stop offset="0" stop-color="${core}"/><stop offset="1" stop-color="${beam}" stop-opacity="0"/></linearGradient>` +
      `<linearGradient id="fx-railgun-c"><stop offset="0" stop-color="${beam}" stop-opacity="0"/><stop offset="1" stop-color="${beam}" stop-opacity=".9"/></linearGradient>` +
      `<radialGradient id="fx-railgun-a"><stop offset="0" stop-color="${core}"/><stop offset=".3" stop-color="${flare}" stop-opacity=".7"/><stop offset="1" stop-color="${flare}" stop-opacity="0"/></radialGradient>` +
      '</defs>';

    const body =
      defs +
      `<g class="wk wg">${grid2}</g>` +
      `<rect class="wb" x="${n(x0)}" y="${n(laneY - 1)}" width="${n(exitX - x0)}" height="2" rx="1" fill="${beam}"/>` +
      `<g transform="translate(${n(x0)},${n(laneY)})">${rings}${inflow}` +
      `<circle class="wm" r="10"/>` +
      `<g class="ws">${cone}` +
      `<rect class="wt" x="${-TRAIL}" y="-4" width="${TRAIL}" height="8" rx="4" fill="url(#fx-railgun-t)" fill-opacity=".35"/>` +
      `<rect class="wt" x="${-TRAIL}" y="-1.2" width="${TRAIL}" height="2.4" rx="1.2" fill="url(#fx-railgun-t)"/>` +
      `<g class="wh"><circle class="wg0" r="16" fill="url(#fx-railgun-g)"/>` +
      `<ellipse rx="4.5" ry="2" fill="${core}"/></g>` +
      '</g></g>' +
      `<g transform="translate(${n(exitX)},${n(laneY)})">` +
      `<circle class="wm" r="10" style="animation-delay:${dur(TE - T0 - CYCLE)}s"/>` +
      `<ellipse class="wa" rx="420" ry="2.2" fill="url(#fx-railgun-a)"/>` +
      `<circle class="wf" r="26" fill="url(#fx-railgun-a)"/>` +
      `<path class="wv" d="M-130 0L0-2.6L130 0L0 2.6ZM0-56L2 0L0 56L-2 0Z" fill="${core}"/>` +
      '</g>' +
      `<g fill="${beam}">${sparks}</g>`;

    return { style, body };
  },
};
