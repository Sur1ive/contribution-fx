import { CELL, PAD, n, pct, rect } from '../core/svg.js';

// The busiest days launch rockets into a sky above the graph and burst
// into palette-colored sparks. Every element rests at opacity 0, so the
// static / reduced-motion view is just the plain graph.

const CYCLE = 9; // seconds
const SKY = 140;
const MAX_ROCKETS = 10;
const RISE = 1.05; // launch -> burst (s)
const LIFE = 1.9; // burst -> sparks gone (s)
const BURST = RISE;
const END = RISE + LIFE;
const RADIUS = 54; // spark travel at scale 1 (px)
const SPARK = 16; // streak length at full speed (px)
const DROOP = 20;
// Spark travel distances (fraction of RADIUS); each gets one shared keyframe set.
const REACH = [1, 0.9, 0.8, 0.55, 0.47];
const STARS = 30;

const at = (t) => pct((t / CYCLE) * 100);

/** Busiest days first, newest wins ties, kept a few weeks apart when possible. */
function pickDays(days, max) {
  const ranked = days
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count || b.date.localeCompare(a.date));
  const picked = [];
  for (const gap of [4, 2, 0]) {
    for (const d of ranked) {
      if (picked.length >= max) return picked;
      if (picked.includes(d)) continue;
      if (picked.every((p) => Math.abs(p.x - d.x) >= gap)) picked.push(d);
    }
  }
  return picked;
}

function mix(hex, other, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex);
  const b = p(other);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

function luma(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A spark flies out along +x with ease-out; its streak shrinks as it slows. */
function sparkKeyframes(name, dist) {
  const samples = [0.015, 0.05, 0.1, 0.17, 0.26, 0.37, 0.5, 0.64, 0.8, 1];
  let kf = `0%,${at(BURST)}{opacity:0;transform:translateX(0) scaleX(.1)}`;
  for (const u of samples) {
    const x = dist * (1 - (1 - u) ** 3);
    const sx = Math.max(0.1, Math.min(1, x / SPARK, 1.4 * (1 - u) ** 2));
    const op = u < 0.6 ? 1 : 1 - ((u - 0.6) / 0.4) ** 1.3;
    kf += `${u === 1 ? `${at(END)},100%` : at(BURST + u * LIFE)}{opacity:${n(op)};transform:translateX(${n(x)}px) scaleX(${n(sx)})}`;
  }
  return `@keyframes ${name}{${kf}}`;
}

function sharedStyle(duration) {
  const loop = `${n(duration)}s linear infinite`;
  let css = '';
  REACH.forEach((r, i) => {
    css += sparkKeyframes(`s${i}`, r * RADIUS) + `.s${i}{opacity:0;animation:s${i} ${loop}}`;
  });
  css +=
    `@keyframes dr{0%,${at(BURST)}{transform:translateY(0);animation-timing-function:cubic-bezier(.55,.08,.68,.53)}` +
    `${at(END)},100%{transform:translateY(${DROOP}px)}}.dr{animation:dr ${loop}}` +
    `@keyframes tw{0%,${at(END - 0.8)}{opacity:1}${at(END - 0.68)}{opacity:.3}${at(END - 0.58)}{opacity:1}` +
    `${at(END - 0.45)}{opacity:.2}${at(END - 0.34)}{opacity:1}${at(END - 0.2)}{opacity:.25}${at(END - 0.1)}{opacity:.9}${at(END)},100%{opacity:1}}` +
    `.tw{animation:tw ${loop}}` +
    `@keyframes gl{0%,${at(BURST - 0.02)}{opacity:0;transform:scale(.2);animation-timing-function:cubic-bezier(.1,.8,.3,1)}` +
    `${at(BURST + 0.05)}{opacity:1}${at(BURST + 0.9)},100%{opacity:0;transform:scale(1)}}` +
    `.gl{opacity:0;animation:gl ${loop}}` +
    `@keyframes fc{0%,${at(BURST - 0.02)}{opacity:0;transform:scale(.5)}${at(BURST + 0.03)}{opacity:1}` +
    `${at(BURST + 0.3)},100%{opacity:0;transform:scale(2.2)}}` +
    `.fc{opacity:0;animation:fc ${loop}}` +
    `@keyframes tl{0%{transform:scaleY(1);animation-timing-function:cubic-bezier(.3,.6,.5,1)}` +
    `${at(BURST)},100%{transform:scaleY(.12)}}.tl{animation:tl ${loop}}` +
    `@keyframes fr{0%{opacity:0;transform:scale(1);animation-timing-function:cubic-bezier(.2,.7,.4,1)}` +
    `${at(0.04)}{opacity:1}${at(0.65)},100%{opacity:0;transform:scale(2.4)}}` +
    `.fr{opacity:0;animation:fr ${loop}}` +
    `@keyframes fg{0%{opacity:0}${at(0.05)}{opacity:1}${at(0.75)},100%{opacity:0}}` +
    `.fg{opacity:0;animation:fg ${loop}}`;
  return css;
}

/** `count` streaks evenly around a circle; `reach` lists the allowed REACH indexes. */
function ring(rng, { count, reach, fill, thick = 2, offset = 0, transform = '' }) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const angle = offset + (i / count) * 360 + (rng() - 0.5) * (120 / count);
    const s = reach[Math.floor(rng() * reach.length)];
    out += `<g transform="rotate(${n(angle)})"><rect x="${-SPARK}" y="${n(-thick / 2)}" width="${SPARK}" height="${n(thick)}" rx="${n(thick / 2)}" class="s${s}"/></g>`;
  }
  return `<g fill="${fill}"${transform ? ` transform="${transform}"` : ''}>${out}</g>`;
}

const SHAPES = [
  // peony: full shell + contrasting core
  { twinkle: false, draw: (rng, a, b, spin) => ring(rng, { count: 24, reach: [0, 1, 1, 2], fill: a, thick: 1.9, offset: spin }) + ring(rng, { count: 12, reach: [3, 4], fill: b, thick: 1.6, offset: spin + 15 }) },
  // tilted ring around a small core
  { twinkle: false, draw: (rng, a, b, spin) => ring(rng, { count: 22, reach: [0], fill: a, thick: 1.9, offset: spin, transform: `rotate(${n(rng() * 50 - 25)}) scale(1,.42)` }) + ring(rng, { count: 10, reach: [3, 4], fill: b, thick: 1.6, offset: spin }) },
  // glittering double shell
  { twinkle: true, draw: (rng, a, b, spin) => ring(rng, { count: 20, reach: [0, 1, 2], fill: a, thick: 1.8, offset: spin }) + ring(rng, { count: 14, reach: [3, 4], fill: b, thick: 1.6, offset: spin + 13 }) },
];

export default {
  name: 'fireworks',
  description: 'Your busiest days launch fireworks into the sky above your graph.',
  extraTop: SKY,

  render(ctx) {
    const { cal, colors, rng, width } = ctx;
    const duration = ctx.duration(CYCLE);
    const dark = ctx.mode === 'dark';
    const palette = [...new Set([colors.levels[2], colors.levels[3], colors.levels[4], colors.accent])];
    // Shell colors must read against the background: no dim greens on dark, no near-black on light.
    const readable = palette.map((c, i) => i).filter((i) => (dark ? luma(palette[i]) > 0.15 : luma(palette[i]) > 0.02));
    const main = readable.length ? readable : palette.map((c, i) => i);
    const contrast = (i) => (dark ? luma(palette[i]) : -luma(palette[i]));
    const bright = palette[main.reduce((a, b) => (contrast(b) > contrast(a) ? b : a))];
    const lift = (c, t) => (dark ? mix(c, '#ffffff', t) : c);
    const head = lift(bright, 0.55);

    const cells = cal.days.map((d) => {
      const p = ctx.pos(d.x, d.y);
      return rect(p.x, p.y, `class="l${d.level}"`);
    });

    const picks = pickDays(cal.days, MAX_ROCKETS);
    if (!picks.length) return { style: '', body: `<g>${cells.join('')}</g>` };

    // Low-discrepancy launch order: consecutive rockets come from far-apart weeks.
    const order = [...picks]
      .sort((a, b) => a.x - b.x)
      .map((d, i) => ({ d, k: (i * 0.618034) % 1 }))
      .sort((a, b) => a.k - b.k)
      .map((o) => o.d);
    const maxCount = picks[0].count;
    const minCount = picks[picks.length - 1].count;
    const interval = CYCLE / order.length;

    let defs =
      `<linearGradient id="ft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${head}" stop-opacity=".9"/><stop offset="1" stop-color="${bright}" stop-opacity="0"/></linearGradient>` +
      `<radialGradient id="fh"><stop offset="0" stop-color="${bright}" stop-opacity=".7"/><stop offset="1" stop-color="${bright}" stop-opacity="0"/></radialGradient>`;
    palette.forEach((c, i) => {
      defs +=
        `<linearGradient id="fs${i}"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset=".7" stop-color="${lift(c, 0.15)}" stop-opacity=".85"/><stop offset="1" stop-color="${lift(c, 0.4)}"/></linearGradient>` +
        `<radialGradient id="fg${i}"><stop offset="0" stop-color="${lift(c, 0.35)}" stop-opacity=".5"/><stop offset=".4" stop-color="${c}" stop-opacity=".16"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    });

    let style = sharedStyle(duration);
    let delays = '';
    const shows = [];
    const half = CELL / 2;
    const skyTop = PAD + 52;
    const skyBottom = PAD + SKY - 60;

    order.forEach((d, k) => {
      const launch = (k + 0.5 + (rng() - 0.5) * 0.45) * interval;
      const weight = maxCount === minCount ? 1 : (d.count - minCount) / (maxCount - minCount);
      const scale = 0.78 + weight * 0.3 + rng() * 0.08;
      const p = ctx.pos(d.x, d.y);
      const cx = p.x + half;
      const cy = p.y + half;
      const margin = RADIUS * scale + 2;
      const bx = Math.min(width - margin, Math.max(margin, cx + (rng() - 0.5) * 40));
      const by = skyTop + rng() * (skyBottom - skyTop) - weight * 8;
      const len = Math.hypot(bx - cx, cy - by);
      const tilt = (Math.atan2(bx - cx, cy - by) * 180) / Math.PI;

      const mi = Math.floor(rng() * main.length);
      const ci = main[mi];
      const cj = main[(mi + 1 + Math.floor(rng() * Math.max(1, main.length - 1))) % main.length];
      const shape = SHAPES[Math.floor(rng() * SHAPES.length)];
      const spin = rng() * 360;

      style +=
        `@keyframes r${k}{0%{opacity:0;transform:translateY(0);animation-timing-function:cubic-bezier(.3,.6,.5,1)}` +
        `${at(0.12)}{opacity:1}${at(RISE - 0.06)}{opacity:1}${at(RISE)},100%{opacity:0;transform:translateY(${n(-len)}px)}}` +
        `.r${k}{opacity:0;animation:r${k} ${n(duration)}s linear infinite}`;
      delays += `.f${k} *{animation-delay:${n(ctx.duration(launch - CYCLE))}s}`;

      shows.push(
        `<g class="f${k}">` +
          `<g transform="translate(${n(cx)},${n(cy)})">` +
          `<circle r="13" fill="url(#fh)" class="fg"/>` +
          `<rect x="${-half}" y="${-half}" width="${CELL}" height="${CELL}" rx="2" fill="none" stroke="${bright}" stroke-width="1.2" class="fr"/>` +
          `<g transform="rotate(${n(tilt)})"><g class="r${k}">` +
          `<rect x="-.9" width="1.8" height="22" rx=".9" fill="url(#ft)" class="tl"/><circle r="1.8" fill="${head}"/>` +
          `</g></g></g>` +
          `<g transform="translate(${n(bx)},${n(by)})">` +
          `<circle r="${n(46 * scale)}" fill="url(#fg${ci})" class="gl"/>` +
          `<circle r="3" fill="${lift(palette[ci], 0.6)}" class="fc"/>` +
          `<g class="dr"><g${shape.twinkle ? ' class="tw"' : ''} transform="scale(${n(scale)})">` +
          shape.draw(rng, `url(#fs${ci})`, `url(#fs${cj})`, spin) +
          `</g></g></g></g>`,
      );
    });

    // Faint twinkling stars on dark backgrounds; periods divide the cycle so the loop stays seamless.
    let stars = '';
    if (dark) {
      for (let i = 0; i < STARS; i++) {
        const v = i % 3;
        const x = PAD + rng() * (width - PAD * 2);
        const y = PAD + rng() * (SKY - 20);
        stars += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(0.5 + rng() * 0.5)}" class="st${v}" style="animation-delay:${n(-rng() * duration)}s"/>`;
      }
      for (let v = 0; v < 3; v++) style += `.st${v}{opacity:0;animation:st ${n(duration / (v + 1))}s ease-in-out infinite}`;
      style += `@keyframes st{0%,100%{opacity:.12}50%{opacity:.55}}`;
    }

    return {
      style: style + delays,
      body: `<defs>${defs}</defs><g fill="${colors.text}">${stars}</g><g>${cells.join('')}</g>${shows.join('')}`,
    };
  },
};
