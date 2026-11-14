import { CELL, PITCH, escapeXml, n, rect } from '../core/svg.js';

// A time-lapse of the year: days pop in chronologically behind a playhead while
// a counter ticks up, a shine sweeps the finished graph, then it rewinds.

const CYCLE = 11; // seconds
const START = 0.4; // first day pops
const PLAY = 5.4; // the whole year plays back in this long
const SHINE = 6.15; // finale sweep starts
const SWEEP = 1.25;
const REWIND = 9.7;
const REWIND_LEN = 0.7;
const FRAMES = 40; // counter steps during playback
const PEAK = [1, 1.3, 1.45, 1.62, 1.85]; // pop scale per level
const SKEW = 0.36; // lean of the shine band (tan 20deg)
const BAND = 70;
const ID = 'fx-replay-';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

const thousands = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const month = (date) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
const at = (sec) => `${n((sec / CYCLE) * 100)}%`;

/** Merge [a, b) windows (seconds), split the ones wrapping past the cycle end. */
function normalize(windows) {
  const out = [];
  for (const [a, b] of windows) {
    if (b - a <= 0.001) continue;
    if (b > CYCLE) out.push([a, CYCLE], [0, b - CYCLE]);
    else out.push([a, b]);
  }
  out.sort((p, q) => p[0] - q[0]);
  const merged = [];
  for (const w of out) {
    const last = merged[merged.length - 1];
    if (last && w[0] <= last[1] + 0.001) last[1] = Math.max(last[1], w[1]);
    else merged.push([...w]);
  }
  return merged;
}

/** Step-timed keyframes: opacity 1 inside the windows, 0 elsewhere. */
function blink(name, windows) {
  const ws = normalize(windows);
  let k = `0%{opacity:${ws.length && ws[0][0] <= 0.001 ? 1 : 0}}`;
  for (const [a, b] of ws) {
    if (a > 0.001) k += `${at(a)}{opacity:1}`;
    if (b < CYCLE - 0.001) k += `${at(b)}{opacity:0}`;
  }
  return `@keyframes ${name}{${k}}`;
}

export default {
  name: 'replay',
  description: 'Your year replays as a time-lapse: every day pops in behind a playhead while the counter ticks up to your total.',
  extraTop: 22,

  render(ctx) {
    const { cal, colors, origin, grid, width } = ctx;
    const dark = ctx.mode === 'dark';
    const cycle = n(ctx.duration(CYCLE));
    const delay = (sec) => `${n(ctx.duration(sec - CYCLE))}s`;

    const order = (d) => d.x * 7 + d.y;
    const days = [...cal.days].sort((a, b) => order(a) - order(b));
    const first = days.length ? order(days[0]) : 0;
    const span = Math.max(1, (days.length ? order(days[days.length - 1]) : 0) - first);
    const frac = (d) => (order(d) - first) / span;
    const tPlay = (f) => START + f * PLAY;
    const tRew = (f) => REWIND + (1 - f) * REWIND_LEN;
    const both = (fa, fb) => [[tPlay(fa), tPlay(fb)], [tRew(fb), tRew(fa)]];
    const idle = [tRew(0), CYCLE + START]; // empty board between loops

    // Cells hide this long before their pop; must cover the wait inside their column.
    const hold = Math.min(6.5, (6 * PLAY) / span + 0.12);
    const flash = (lv) => (dark ? mix(colors.accent, '#ffffff', 0.25 + lv * 0.1) : mix(colors.accent, colors.levels[4], (lv - 1) * 0.12));
    const settle = (lv) => mix(flash(lv), colors.levels[lv], 0.55);

    let style =
      `.rc{transform-box:fill-box;transform-origin:center;animation:${cycle}s infinite}` +
      `.rr{fill:none;stroke:${flash(4)};stroke-width:1.5;vector-effect:non-scaling-stroke;opacity:0;transform-box:fill-box;transform-origin:center;animation:rr ${cycle}s ease-out infinite}` +
      `.rg,.rf{animation:${cycle}s step-end infinite}` +
      `@keyframes rr{0%{scale:1;opacity:.9}${at(0.55)},to{scale:2.6;opacity:0}}` +
      `@keyframes rw{0%{transform:translate(0,0) scale(1)}${at(0.12)}{transform:translate(0,-1.5px) scale(1.2)}${at(0.36)},to{transform:translate(0,0) scale(1)}}`;
    for (let lv = 1; lv <= 4; lv++) {
      style +=
        `.l${lv}.rc{animation-name:p${lv},rw}` +
        `@keyframes p${lv}{0%{scale:0;fill:${flash(lv)};animation-timing-function:cubic-bezier(.2,.7,.3,1)}` +
        `${at(0.1)}{scale:${PEAK[lv]};fill:${flash(lv)};animation-timing-function:ease-in-out}` +
        `${at(0.24)}{scale:.88}${at(0.34)}{scale:1.05;fill:${settle(lv)}}` +
        `${at(0.44)}{scale:1}${at(0.9)},${at(CYCLE - hold)}{scale:1;fill:${colors.levels[lv]}}` +
        `${at(CYCLE - hold + 0.02)},to{scale:0;fill:${flash(lv)}}}`;
    }

    const plain = (list) => list.map((d) => {
      const p = ctx.pos(d.x, d.y);
      return rect(p.x, p.y);
    }).join('');
    const lit = days.filter((d) => d.level > 0);

    // Active days, grouped by week so each column can appear and rewind on its own.
    const B0 = -BAND / 2 - 6;
    const B1 = grid.width + SKEW * grid.height + BAND / 2 + 6;
    const wave = (d) => SHINE - 0.12 + ((d.x * PITCH + CELL / 2 + SKEW * (d.y * PITCH + CELL / 2) - B0) / (B1 - B0)) * SWEEP;
    const cols = new Map();
    for (const d of days) {
      if (d.level === 0) continue;
      if (!cols.has(d.x)) cols.set(d.x, []);
      cols.get(d.x).push(d);
    }
    const groups = [];
    for (const [x, list] of cols) {
      const f = frac(list[0]);
      style += blink(`c${x}`, [[tPlay(f) - 0.03, tRew(f)]]);
      const cells = list.map((d) => {
        const p = ctx.pos(d.x, d.y);
        const t = tPlay(frac(d));
        const cell = rect(p.x, p.y, `class="l${d.level} rc" style="animation-delay:${delay(t)},${delay(wave(d))}"`);
        return d.level === 4 ? cell + rect(p.x, p.y, `class="rr" style="animation-delay:${delay(t)}"`) : cell;
      });
      groups.push(`<g class="rg" style="animation-name:c${x}">${cells.join('')}</g>`);
    }

    // Shine band, masked to the cells.
    style +=
      `.sh{opacity:0;animation:sh ${cycle}s linear infinite}` +
      `@keyframes sh{0%,${at(SHINE - 0.01)}{translate:${n(B0)}px;opacity:0}${at(SHINE)}{translate:${n(B0)}px;opacity:1}` +
      `${at(SHINE + SWEEP)}{translate:${n(B1)}px;opacity:1}${at(SHINE + SWEEP + 0.01)},to{translate:${n(B1)}px;opacity:0}}`;
    const shine =
      `<g mask="url(#${ID}m)"><g transform="translate(${origin.x} ${origin.y})"><g class="sh">` +
      `<rect x="${-BAND / 2}" y="0" width="${BAND}" height="${grid.height}" transform="skewX(-20)" fill="url(#${ID}g)"/></g></g></g>`;
    // On white a white glint reads as fading, so light mode sweeps in the accent.
    const glint = dark ? '#ffffff' : colors.accent;
    // An empty year still gets its shine, across the empty board.
    const defs =
      `<defs><g id="${ID}s">${plain(days)}</g>` +
      `<linearGradient id="${ID}g"><stop offset="0" stop-color="${glint}" stop-opacity="0"/>` +
      `<stop offset=".5" stop-color="${glint}" stop-opacity=".75"/><stop offset="1" stop-color="${glint}" stop-opacity="0"/></linearGradient>` +
      `<mask id="${ID}m" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">` +
      `${lit.length ? `<g fill="#fff">${plain(lit)}</g>` : `<use href="#${ID}s" fill="#fff"/>`}</mask></defs>`;

    // Playhead on the current week; streaks back during the rewind.
    const colA = days.length ? days[0].x : 0;
    const colB = days.length ? days[days.length - 1].x : 0;
    const px = (c) => `${n(c * PITCH)}px`;
    const ph = (sec, c, o) => `${at(sec)}{translate:${px(c)};opacity:${o}}`;
    // Centred on the week being played, clamped to the first and last week.
    const clamp = (f) => Math.min(1, Math.max(0, f));
    const fA = clamp((7 * colA + 3.5 - first) / span);
    const fB = Math.max(fA, clamp((7 * colB + 3.5 - first) / span));
    const track = [[fA, colA], [fB, colB]];
    style +=
      `.ph{opacity:0;animation:ph ${cycle}s linear infinite}` +
      `@keyframes ph{0%{translate:${px(colA)};opacity:0}${ph(START - 0.2, colA, 0)}${ph(START, colA, 1)}` +
      `${track.map(([f, c]) => ph(tPlay(f), c, 1)).join('')}` +
      `${ph(tPlay(1), colB, 1)}${ph(tPlay(1) + 0.35, colB, 0)}${ph(REWIND - 0.05, colB, 0)}${ph(REWIND + 0.05, colB, 1)}` +
      `${track.reverse().map(([f, c]) => ph(tRew(f), c, 1)).join('')}` +
      `${ph(tRew(0), colA, 1)}${ph(tRew(0) + 0.25, colA, 0)}to{translate:${px(colA)};opacity:0}}`;
    const playhead =
      `<g class="ph" fill="${colors.accent}"><rect x="${n(origin.x - 1.5)}" y="${n(origin.y - 2)}" width="14" height="${n(grid.height + 4)}" rx="3" opacity="${dark ? '.22' : '.16'}"/>` +
      `<path d="M${n(origin.x + 1.5)} ${n(origin.y - 8)}h8l-4 4.5z"/></g>`;

    // Header: month on the left, running total on the right.
    const base = n(origin.y - 12);
    let k = 0;
    const frame = (content, windows, isFinal, tag = 'text') => {
      const name = `f${k++}`;
      style += blink(name, windows);
      return `<${tag} class="rf"${isFinal ? '' : ' opacity="0"'} style="animation-name:${name}">${content}</${tag}>`;
    };

    const monthTexts = new Map();
    const addMonth = (text, windows) => {
      if (!monthTexts.has(text)) monthTexts.set(text, []);
      monthTexts.get(text).push(...windows);
    };
    const starts = [];
    for (const d of days) {
      const key = d.date.slice(0, 7);
      if (!starts.length || starts[starts.length - 1].key !== key) starts.push({ key, text: month(d.date), f: frac(d) });
    }
    starts.forEach((s, i) => addMonth(s.text, both(s.f, i + 1 < starts.length ? starts[i + 1].f : 1)));
    if (starts.length) addMonth(starts[0].text, [idle]);
    const range = starts.length
      ? (starts.length > 1 ? `${starts[0].text} – ${starts[starts.length - 1].text}` : starts[0].text)
      : 'Last year';
    // Short graphs only have room for the counter, right after the icon.
    const narrow = grid.width < 330;
    let left = '';
    if (!narrow) {
      for (const [text, windows] of monthTexts) {
        if (text !== range) left += frame(escapeXml(text), windows, false);
      }
      left += frame(escapeXml(range), [[tPlay(1), REWIND], ...(monthTexts.get(range) || [])], true);
    }

    const word = grid.width < 170 ? '' : ' contribution';
    const label = (v) => `<tspan class="rn">${thousands(v)}</tspan>${word}${word && v !== 1 ? 's' : ''}`;
    const totals = new Map();
    const addTotal = (v, windows) => {
      if (!totals.has(v)) totals.set(v, []);
      totals.get(v).push(...windows);
    };
    const active = days.filter((d) => d.count > 0);
    let sum = 0;
    let j = 0;
    for (let s = 0; s < FRAMES; s++) {
      const f = s / FRAMES;
      while (j < active.length && frac(active[j]) <= f + 1e-9) sum += active[j++].count;
      addTotal(sum, both(f, (s + 1) / FRAMES));
    }
    addTotal(0, [idle]);
    let right = '';
    for (const [v, windows] of totals) {
      if (v !== cal.total) right += frame(label(v), windows, false);
    }
    right += `<g class="pu">${frame(label(cal.total), [[tPlay(1), REWIND], ...(totals.get(cal.total) || [])], true)}</g>`;

    const land = tPlay(1);
    style +=
      `.rh{font:600 12px ${FONT};fill:${colors.text}}.rk{text-anchor:end}` +
      `.rn{font-weight:700;font-size:13px;fill:${colors.accent}}` +
      `.pu{transform-box:fill-box;transform-origin:${narrow ? 0 : '100%'} 60%;animation:pu ${cycle}s ease-out infinite}` +
      `@keyframes pu{0%,${at(land)}{scale:1}${at(land + 0.14)}{scale:1.16}${at(land + 0.5)},to{scale:1}}`;
    const iy = n(origin.y - 21);
    const header =
      `<g fill="${colors.accent}">` +
      frame(`<path d="M${n(origin.x + 0.5)} ${iy}l7 4.5-7 4.5z"/>`, [[tRew(0), CYCLE + REWIND]], true, 'g') +
      frame(`<path d="M${n(origin.x + 4)} ${n(origin.y - 20.5)}v8l-4-4zm4.5 0v8l-4-4z"/>`, [[REWIND, tRew(0)]], false, 'g') +
      '</g>' +
      (narrow ? '' : `<g class="rh" transform="translate(${n(origin.x + 12)} ${base})">${left}</g>`) +
      `<g class="rh${narrow ? '' : ' rk'}" transform="translate(${n(narrow ? origin.x + 12 : width - origin.x)} ${base})">${right}</g>`;

    return {
      style,
      body: `${defs}<use href="#${ID}s" class="l0"/>${playhead}<g>${groups.join('')}</g>${shine}${header}`,
    };
  },
};
