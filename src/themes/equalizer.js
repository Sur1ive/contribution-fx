import { CELL, GAP, PITCH, n, rect } from '../core/svg.js';

// Every week becomes a bar of a graphic equalizer: its seven days light up
// bottom-up like LED segments and bounce to a beat, busier weeks peaking
// higher. Peak-hold markers float above the bars, then the graph returns.

const CYCLE = 12.5; // seconds; one step = 1% of the cycle
const STEPS = 100;
const IN = 12; // steps of the real graph before the first column switches
const SWEEP = 8; // steps the switch takes to travel across the graph
const RAMP = 3;
const OUT = 82; // first column starts falling back
const BEAT = 4; // steps per beat (120 bpm)
const FIRST_BEAT = 16;
const HOLD = 2; // steps a peak marker hangs before falling
const FALL = 0.25; // fall acceleration, segments per step per step
const DIM = 0; // opacity of the real graph while the equalizer plays
const PULSE = [0.3, 0.6]; // light, dark: how far empty slots flash towards level 1 on a drop beat
// Segment fill by height, bottom first.
const GRADE = [1, 2, 2, 3, 3, 4, 4];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const beatKind = (i) => (i % 4 === 0 ? 'drop' : i % 2 ? 'snare' : 'kick');
const offset = (x, cols) => Math.round((x * SWEEP) / Math.max(1, cols - 1));

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

/** Bar heights (segments) per column per step. */
export function spectrum(cal, rng) {
  const cols = Math.max(1, cal.cols);
  const sum = new Array(cols).fill(0);
  const size = new Array(cols).fill(0);
  for (const d of cal.days) {
    sum[d.x] += d.level;
    size[d.x] += 1;
  }
  // Activity blends rank and magnitude, so uniform years sit mid-height.
  const raw = sum.map((s, x) => (size[x] ? s / (4 * size[x]) : 0));
  const max = Math.max(...raw);
  const min = Math.min(...raw);
  const order = raw.map((v, x) => x).sort((a, b) => raw[a] - raw[b]);
  const rank = new Array(cols).fill(0.5);
  for (let i = 0; i < cols;) {
    let j = i;
    while (j + 1 < cols && raw[order[j + 1]] === raw[order[i]]) j++;
    for (let k = i; k <= j; k++) rank[order[k]] = cols > 1 ? (i + j) / 2 / (cols - 1) : 0.5;
    i = j + 1;
  }
  const norm = raw.map((v, x) => 0.5 * rank[x] + 0.5 * (max > min ? (v - min) / (max - min) : 0.5));
  const act = norm.map((v, x) => 0.25 * (norm[x - 1] ?? v) + 0.5 * v + 0.25 * (norm[x + 1] ?? v));

  const waves = [
    [1.1, 0.32, 2.4],
    [0.8, 0.85, -3.6],
    [0.5, 1.9, 5.3],
  ].map(([a, k, w]) => ({ a, k, w, p: rng() * Math.PI * 2 }));

  const beats = [];
  for (let s = FIRST_BEAT, i = 0; s <= OUT + SWEEP; s += BEAT, i++) {
    const kind = beatKind(i);
    const bumps = kind === 'snare'
      ? [0, 1].map(() => ({ c: rng() * cols, w: 3 + rng() * 4, a: 2.2 }))
      : [{ c: rng() * cols, w: 9 + rng() * 8, a: kind === 'drop' ? 2.6 : 2 }];
    beats.push({ s, all: kind === 'drop' ? 1.4 : kind === 'kick' ? 0.6 : 0.2, bumps });
  }

  const heights = [];
  for (let x = 0; x < cols; x++) {
    const d = offset(x, cols);
    const row = [];
    for (let s = 0; s <= STEPS; s++) {
      const env = clamp(Math.min((s - IN - d) / RAMP, (OUT + d + RAMP - s) / RAMP), 0, 1);
      if (env <= 0) {
        row.push(0);
        continue;
      }
      const t = (s - IN) * (CYCLE / STEPS);
      let v = 2.1 + 2.9 * act[x];
      for (const w of waves) v += w.a * Math.sin(w.k * x - w.w * t + w.p);
      for (const b of beats) {
        if (b.s > s) break;
        const decay = 0.5 ** (s - b.s);
        if (decay < 0.05) continue;
        let k = b.all;
        for (const m of b.bumps) {
          const dx = Math.min(Math.abs(x - m.c), cols - Math.abs(x - m.c));
          k += m.a * Math.exp(-((dx / m.w) ** 2));
        }
        v += k * (0.6 + 0.6 * act[x]) * decay;
      }
      v += (rng() - 0.5) * 1.2;
      row.push(clamp(Math.round(v * env), env >= 1 ? 1 : 0, 7));
    }
    heights.push(row);
  }
  return heights;
}

/** Peak-hold trajectory for one bar. */
export function peaks(row) {
  const out = [];
  let p = 0;
  let hold = 0;
  let speed = 0;
  let off = 0;
  for (const h of row) {
    off = h ? 0 : off + 1;
    if (off > 2) {
      p = 0;
    } else if (h >= p) {
      p = h;
      hold = HOLD;
      speed = 0;
    } else if (hold > 0) {
      hold--;
    } else {
      speed = Math.min(1.25, speed + FALL);
      p = Math.max(h, p - speed);
    }
    out.push(p);
  }
  out[out.length - 1] = 0;
  return out;
}

/** Step-end keyframes for a per-step series, stops grouped by value. */
function frames(series, lift) {
  const groups = new Map();
  series.forEach((v, s) => {
    if (s > 0 && s < STEPS && v === series[s - 1]) return;
    const decl = `translate:0 ${n(-lift(v))}px`;
    if (!groups.has(decl)) groups.set(decl, []);
    groups.get(decl).push(`${s}%`);
  });
  let out = '';
  for (const [decl, list] of groups) out += `${list.join(',')}{${decl}}`;
  return out;
}

export default {
  name: 'equalizer',
  description: 'Every week becomes an equalizer bar bouncing to the beat, your busiest weeks peaking highest.',

  render(ctx) {
    const { cal, colors, origin, rng } = ctx;
    const cols = Math.max(1, cal.cols);
    const dur = n(ctx.duration(CYCLE));
    const stepSec = ctx.duration(CYCLE / STEPS);
    const heights = spectrum(cal, rng);
    // Peak markers rest below the canvas, so they stay hidden without animation.
    const rest = ctx.height + 2;
    const barLift = (v) => v * PITCH;

    const byCol = Array.from({ length: cols }, () => []);
    for (const d of cal.days) byCol[d.x].push(d);

    let style =
      `.eq rect,.ep{animation:${dur}s step-end infinite}` +
      `.er{animation:er ${dur}s linear infinite}` +
      `@keyframes er{0%,${IN}%,${OUT + RAMP * 2}%,to{opacity:1}${IN + RAMP}%,${OUT + RAMP}%{opacity:${DIM}}}` +
      `.ep{fill:${ctx.mode === 'dark' ? mix(colors.levels[4], '#ffffff', 0.5) : colors.levels[4]}}`;

    const pulse = [];
    for (let s = FIRST_BEAT, i = 0; s < OUT; s += BEAT, i++) {
      const strength = { drop: 1, kick: 0.5, snare: 0.33 }[beatKind(i)] * PULSE[ctx.mode === 'dark' ? 1 : 0];
      pulse.push(`${n(s - 0.4)}%{fill:${colors.levels[0]}}${s}%{fill:${mix(colors.levels[0], colors.levels[1], strength)}}${s + BEAT - 1}%{fill:${colors.levels[0]}}`);
    }
    style += `.es{animation:es ${dur}s ease-out infinite}@keyframes es{${pulse.join('')}}`;

    const column = (cls) => GRADE.map((g, i) =>
      `<rect x="0" y="${n(origin.y + (6 - i) * PITCH)}" width="${CELL}" height="${CELL}" rx="2"${cls ? ` class="l${g}"` : ''}/>`).join('');
    const defs = [`<g id="eq-s">${column(false)}</g>`, `<g id="eq-l">${column(true)}</g>`];

    const slots = [];
    const real = [];
    const lit = [];
    const clips = [];
    const marks = [];
    for (let x = 0; x < cols; x++) {
      const days = byCol[x];
      if (!days.length) continue;
      const px = n(ctx.pos(x, 0).x);
      const delay = n(offset(x, cols) * stepSec);
      const active = [];
      if (days.length === 7) {
        slots.push(`<use href="#eq-s" x="${px}"/>`);
        lit.push(`<use href="#eq-l" x="${px}"/>`);
      }
      for (const d of days) {
        const p = ctx.pos(d.x, d.y);
        if (days.length < 7) {
          slots.push(rect(p.x, p.y));
          lit.push(rect(p.x, p.y, `class="l${GRADE[6 - d.y]}"`));
        }
        if (d.level) active.push(rect(p.x, p.y, `class="l${d.level}"`));
      }
      if (active.length) real.push(`<g class="er" style="animation-delay:${delay}s">${active.join('')}</g>`);

      // Partial weeks get a proportionally shorter bar that starts at their lowest day.
      let top = 6;
      let low = 0;
      for (const d of days) {
        top = Math.min(top, d.y);
        low = Math.max(low, d.y);
      }
      const len = low - top + 1;
      const row = len === 7 ? heights[x] : heights[x].map((h) => clamp(Math.round((h * len) / 7), 0, len));
      const bottom = ctx.pos(x, low).y + PITCH;
      const peakLift = (v) => (v > 0 ? rest - (bottom - GAP - v * PITCH) : 0);
      style += `@keyframes b${x}{${frames(row, barLift)}}@keyframes p${x}{${frames(peaks(row), peakLift)}}`;
      clips.push(`<rect style="animation-name:b${x}" x="${n(px - 1)}" y="${n(bottom - GAP / 2)}" width="${CELL + 2}" height="${len * PITCH + 4}"/>`);
      marks.push(`<rect class="ep" style="animation-name:p${x}" x="${px}" y="${n(rest)}" width="${CELL}" height="2" rx="1"/>`);
    }

    defs.push(`<clipPath id="eq-bars" class="eq">${clips.join('')}</clipPath>`);

    const body =
      `<defs>${defs.join('')}</defs>` +
      `<g class="l0 es">${slots.join('')}</g>` +
      `<g>${real.join('')}</g>` +
      `<g clip-path="url(#eq-bars)">${lit.join('')}</g>` +
      `<g>${marks.join('')}</g>`;
    return { style, body };
  },
};
