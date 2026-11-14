import { CELL, n, pct } from '../core/svg.js';

// Hyperspace jump. Cells live in a few "depth" groups, each scaled around the
// vanishing point (graph centre) at its own speed, so positions fly outward
// while every cell is counter-scaled to keep its size. A streak per cell runs
// from the cell back toward the vanishing point; its length (a scale around the
// cell) is the distance covered over a short exposure time. All keyframes are
// shared, so no element needs its own animation.

const CYCLE = 9; // seconds
const CHARGE = 2.2;
const JUMP = 4.4;
const DEPART = 1;
const ARRIVE = 5.45;
const LAND = 0.75; // ease-out flight back into the grid
const SETTLE = 0.5; // overshoot recovery
const COOL = 0.9;
const PULL = 0.975; // recoil before the jump
const S_MAX = 22;
const S_IN = 5;
const DIP = 0.962;
const LAG_OUT = 0.2;
const LAG_IN = 0.13;
// Vertical flight is the horizontal one raised to FLAT: the canvas is short.
const FLAT = 0.55;
const DEPTHS = [0.75, 0.92, 1.1, 1.3];
const STARS = 110;
const STAR_FAR = 3.2;
const STAR_NEAR = 0.22;

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const at = (t) => pct((t / CYCLE) * 100);
const num = (v) => n(v).replace(/^(-?)0\./, '$1.');
const clampStreak = (v) => Math.max(-1.6, Math.min(0.9, v));

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

const K_OUT = Math.log(S_MAX / PULL);

// Scale = shared recoil/overshoot x flight ** depth, so only the flight itself
// differs between depth layers and the grid stays aligned at rest.
function departScale(t, k) {
  if (t <= CHARGE) return 1;
  if (t <= JUMP) return 1 - (1 - PULL) * ease((t - CHARGE) / (JUMP - CHARGE));
  const u = Math.min(1, (t - JUMP) / DEPART);
  return PULL * Math.exp(K_OUT * k * u * u);
}

/** Extrapolates before ARRIVE so streaks are already long on the first frame. */
function arriveScale(t, k) {
  const v = t - ARRIVE;
  const flight = v < LAND ? 1 + (S_IN - 1) * (1 - v / LAND) ** 3 : 1;
  const dip = v < LAND ? ease((v - LAND * 0.5) / (LAND * 0.5)) : 1 - ease((v - LAND) / SETTLE);
  return flight ** k * (1 - (1 - DIP) * dip);
}

const scaleAt = (t, k) => (t < ARRIVE ? departScale(t, k) : arriveScale(t, k));

/** Streak length as a fraction of the cell's distance to the vanishing point. */
function streakAt(t, k) {
  if (t < JUMP || t > ARRIVE + LAND + SETTLE) return 0;
  const lag = t < ARRIVE ? LAG_OUT : LAG_IN;
  const fn = t < ARRIVE ? departScale : arriveScale;
  return clampStreak(1 - fn(t - lag, k) / fn(t, k));
}

/** Cell size on screen: shrinks to a bright head while flying. */
function headAt(t) {
  if (t < JUMP) return 1;
  if (t < ARRIVE) return 1 - 0.55 * ease((t - JUMP) / 0.3);
  return 0.6 + 0.4 * ease((t - ARRIVE) / 0.45);
}

const K_STAR = Math.log(STAR_FAR / STAR_NEAR);

function starScale(t) {
  if (t <= CHARGE) return STAR_FAR;
  if (t <= JUMP) {
    const w = (t - CHARGE) / (JUMP - CHARGE);
    return STAR_FAR * Math.exp(-K_STAR * w * w);
  }
  return (STAR_NEAR * departScale(t, 1)) / PULL;
}

function starStreakAt(t) {
  if (t < CHARGE || t > JUMP + DEPART) return 0;
  return clampStreak(1 - starScale(t - LAG_OUT) / starScale(t));
}

function sampleTimes() {
  const times = new Set([0, CHARGE, CYCLE]);
  for (let t = CHARGE; t < JUMP; t += 0.1) times.add(t);
  for (let t = JUMP; t <= JUMP + DEPART + 1e-9; t += 0.04) times.add(t);
  times.add(ARRIVE - 0.01);
  for (let t = ARRIVE; t <= ARRIVE + LAND + SETTLE + 1e-9; t += 0.04) times.add(t);
  times.add(ARRIVE + LAND + SETTLE + 0.05);
  return [...times].map((t) => Math.round(t * 1000) / 1000).sort((a, b) => a - b);
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

const scale2 = (sx, sy) => (num(sx) === num(sy) ? `transform:scale(${num(sx)})` : `transform:scale(${num(sx)},${num(sy)})`);

export default {
  name: 'warp',
  description: 'Your graph charges up and jumps to hyperspace, every day a streak of light, then drops back into place.',

  render(ctx) {
    const { cal, colors, rng, grid, origin } = ctx;
    const dark = ctx.mode === 'dark';
    const { accent, levels } = colors;
    const loop = `${n(ctx.duration(CYCLE))}s linear infinite`;
    const vx = origin.x + grid.width / 2;
    const vy = origin.y + grid.height / 2;
    const half = CELL / 2;

    const hot = levels.map((c, i) => {
      if (dark) return i === 0 ? mix(c, accent, 0.45) : mix(mix(c, accent, 0.3), '#ffffff', 0.12 + i * 0.08);
      return i === 0 ? mix(c, accent, 0.3) : mix(c, accent, 0.35);
    });
    const glow = dark ? mix(accent, '#ffffff', 0.55) : accent;
    const flash = dark ? mix(accent, '#ffffff', 0.75) : mix(accent, '#ffffff', 0.15);
    const star = dark ? mix(accent, '#ffffff', 0.5) : accent;
    const vp = `transform-origin:${n(vx)}px ${n(vy)}px`;

    const times = sampleTimes();
    let style =
      levels.map((c, i) => `.l${i}{--b:${c};--h:${hot[i]}}`).join('') +
      levels.map((c, i) => `.s${i}{stroke:${i ? hot[i] : accent};stroke-width:${num(i ? 1.2 + i * 0.35 : 1)}${i ? '' : `;stroke-opacity:${dark ? '.4' : '.3'}`}}`).join('') +
      `.z{${vp};animation:${loop}}` +
      `.z rect{transform-box:fill-box;transform-origin:center;animation:${loop}}` +
      `.z line,.sz line{opacity:0;fill:none;stroke-linecap:round;vector-effect:non-scaling-stroke}` +
      `.z line{animation:${loop}}` +
      `.sz{${vp};animation:sz ${loop}}` +
      `.sz line{stroke:${star};animation:ss ${loop},so ${loop}}` +
      `.tr{animation:tr ${loop}}` +
      `.gw,.fl{opacity:0;transform-box:fill-box;transform-origin:center}` +
      `.gw{animation:gw ${loop}}.fl{animation:fl ${loop}}`;

    DEPTHS.forEach((k, i) => {
      const sx = (t) => scaleAt(t, k);
      const sy = (t) => scaleAt(t, k * FLAT);
      style +=
        `.z${i}{animation-name:z${i}}.z${i} rect{animation-name:c${i},co,cb}.z${i} .l0{animation-name:c${i},cx,cb}.z${i} line{animation-name:s${i},lo}` +
        keyframes(`z${i}`, times.map((t) => [t, scale2(sx(t), sy(t))])) +
        keyframes(`c${i}`, times.map((t) => [t, scale2(headAt(t) / sx(t), headAt(t) / sy(t))])) +
        keyframes(`s${i}`, times.map((t) => [t, `transform:scale(${num(streakAt(t, k) || 0.001)})`]));
    });
    const starTimes = times.filter((t) => t <= JUMP + DEPART + 0.05).concat(CYCLE);
    style += keyframes('sz', starTimes.map((t) => [t, scale2(starScale(t), starScale(t) ** FLAT)]));
    style += keyframes('ss', starTimes.map((t) => [t, `transform:scale(${num(starStreakAt(t) || 0.001)})`]));

    const gone = JUMP + DEPART;
    style +=
      keyframes('co', [[0, 'opacity:1'], [gone - 0.15, 'opacity:1'], [gone - 0.02, 'opacity:0'], [ARRIVE - 0.01, 'opacity:0'], [ARRIVE, 'opacity:1'], [CYCLE, 'opacity:1']]) +
      keyframes('cx', [[0, 'opacity:1'], [JUMP + 0.05, 'opacity:1'], [JUMP + 0.3, 'opacity:0'], [ARRIVE - 0.01, 'opacity:0'], [ARRIVE, 'opacity:1'], [CYCLE, 'opacity:1']]) +
      keyframes('lo', [[0, 'opacity:0'], [JUMP, 'opacity:0'], [JUMP + 0.06, 'opacity:1'], [gone - 0.15, 'opacity:1'], [gone - 0.02, 'opacity:0'],
        [ARRIVE - 0.01, 'opacity:0'], [ARRIVE, 'opacity:1'], [ARRIVE + LAND * 0.6, 'opacity:1'], [ARRIVE + LAND, 'opacity:0'], [CYCLE, 'opacity:0']]) +
      keyframes('so', [[0, 'opacity:0'], [CHARGE, 'opacity:0'], [CHARGE + 0.5, 'opacity:.35'], [JUMP - 0.1, 'opacity:.7'], [JUMP + 0.1, 'opacity:1'],
        [gone - 0.12, 'opacity:1'], [gone, 'opacity:0'], [CYCLE, 'opacity:0']]) +
      keyframes('cb', [[0, 'fill:var(--b)'], [CHARGE + 0.3, 'fill:var(--b)'], [3.3, 'fill:var(--h)'], [3.5, 'fill:var(--b)'], [3.85, 'fill:var(--h)'],
        [4, 'fill:var(--b)'], [4.25, 'fill:var(--h)'], [ARRIVE + LAND, 'fill:var(--h)'], [ARRIVE + LAND + COOL, 'fill:var(--b)'], [CYCLE, 'fill:var(--b)']]) +
      keyframes('gw', [[0, 'opacity:0;transform:scale(.3)'], [CHARGE + 0.4, 'opacity:0;transform:scale(.3)'], [3.4, 'opacity:.35;transform:scale(.6)'],
        [3.55, 'opacity:.2;transform:scale(.55)'], [3.95, 'opacity:.6;transform:scale(.8)'], [4.05, 'opacity:.4;transform:scale(.75)'],
        [JUMP, 'opacity:.9;transform:scale(1)'], [JUMP + 0.25, 'opacity:.5;transform:scale(1.6)'], [gone - 0.25, 'opacity:.7;transform:scale(1.2)'],
        [gone, 'opacity:0;transform:scale(2.5)'], [CYCLE, 'opacity:0;transform:scale(.3)']]) +
      keyframes('fl', [[0, 'opacity:0'], [gone - 0.1, 'opacity:0'], [ARRIVE - 0.02, 'opacity:1'], [ARRIVE + 0.06, 'opacity:.55'], [ARRIVE + 0.28, 'opacity:0'], [CYCLE, 'opacity:0']]);

    // Tremble builds up while charging.
    const shake = [[0, 'transform:translate(0,0)'], [CHARGE + 0.6, 'transform:translate(0,0)']];
    for (let t = CHARGE + 0.65; t < JUMP - 0.02; t += 0.05) {
      const a = 0.15 + 0.75 * ((t - CHARGE - 0.6) / (JUMP - CHARGE - 0.6)) ** 1.5;
      shake.push([t, `transform:translate(${num((rng() * 2 - 1) * a)}px,${num((rng() * 2 - 1) * a)}px)`]);
    }
    shake.push([JUMP, 'transform:translate(0,0)'], [CYCLE, 'transform:translate(0,0)']);
    style += keyframes('tr', shake);

    const layers = DEPTHS.map(() => ({ streaks: [], cells: [] }));
    for (const d of cal.days) {
      const p = ctx.pos(d.x, d.y);
      const cx = p.x + half;
      const cy = p.y + half;
      const layer = layers[Math.floor(rng() * DEPTHS.length)];
      layer.streaks.push(`<g transform="translate(${n(cx)},${n(cy)})"><line x2="${n(vx - cx)}" y2="${n(vy - cy)}" class="s${d.level}"/></g>`);
      layer.cells.push(`<rect x="${n(p.x)}" y="${n(p.y)}" width="${CELL}" height="${CELL}" rx="2" class="l${d.level}"/>`);
    }

    const stars = [];
    for (let i = 0; i < STARS; i++) {
      const r = 8 * Math.exp(rng() * Math.log(420 / 8));
      const a = rng() * Math.PI * 2;
      const dx = r * Math.cos(a);
      const dy = r * Math.sin(a) * 0.4;
      const w = rng() < 0.3 ? 1.6 : 1;
      stars.push(`<g transform="translate(${n(vx + dx)},${n(vy + dy)})"><line x2="${n(-dx)}" y2="${n(-dy)}" stroke-width="${w}"/></g>`);
    }

    const defs =
      '<defs>' +
      `<radialGradient id="fx-warp-g"><stop offset="0" stop-color="${glow}"/><stop offset=".35" stop-color="${accent}" stop-opacity=".35"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="fx-warp-f"><stop offset="0" stop-color="${flash}"/><stop offset=".45" stop-color="${flash}" stop-opacity=".7"/><stop offset="1" stop-color="${flash}" stop-opacity="0"/></radialGradient>` +
      '</defs>';

    const body =
      defs +
      `<g class="sz">${stars.join('')}</g>` +
      `<g class="tr">${layers.map((l, i) => `<g class="z z${i}">${l.streaks.join('')}${l.cells.join('')}</g>`).join('')}</g>` +
      `<ellipse class="gw" cx="${n(vx)}" cy="${n(vy)}" rx="110" ry="46" fill="url(#fx-warp-g)"/>` +
      `<rect class="fl" width="${ctx.width}" height="${ctx.height}" fill="url(#fx-warp-f)"/>`;

    return { style, body };
  },
};
