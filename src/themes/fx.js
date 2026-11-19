import { CELL, escapeXml, n, rect } from '../core/svg.js';

// Your year as a candlestick chart built from your own cells: week by week
// the cells move into candles (busy days push the price up, quiet days let it
// slide) while a ticker quotes the close, then the chart tumbles off and every
// cell flies back home on its own.

const CYCLE = 12; // seconds
const PRINT0 = 0.7; // first week moves
const PRINT = 5; // the whole year moves in this long
const MOVE = 0.55; // a week's cells travel to the chart in this long
const FALL = 7.9; // the chart tumbles off
const TUMBLE = 0.7;
const RETURN = 9.3; // the first pieces take off for home
const RISE = 0.7; // each piece's flight home
const SCATTER = 0.9; // spread of the pieces' take-off times
const ROOM = 40; // headroom above the graph for the chart
const HEADER = 24;
const BODY = 9; // candle body width
const BEAD = 0.6; // cell scale while it sits on a candle
const EMA = 0.2; // how fast the price follows daily activity
const DRIFT = 1; // uptrend over the year, in activity levels
const MIN_SPAN = 1.5; // flat years don't blow noise up to full height
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const at = (sec) => `${n((sec / CYCLE) * 100)}%`;

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

/**
 * One candle per week. The price is a moving average of recent activity on a
 * gentle uptrend, so busy stretches rally and quiet ones slide.
 */
function market(cal, rng) {
  const cols = new Map();
  for (const d of cal.days) {
    if (!cols.has(d.x)) cols.set(d.x, []);
    cols.get(d.x).push(d);
  }
  const total = Math.max(1, cal.days.length);
  const weeks = [];
  let avg = cal.days.reduce((s, d) => s + d.level, 0) / total;
  let i = 0;
  let p = avg;
  for (const x of [...cols.keys()].sort((a, b) => a - b)) {
    const open = p;
    let high = p;
    let low = p;
    const days = cols.get(x).sort((a, b) => a.y - b.y).map((d) => {
      avg += (d.level + (rng() - 0.5) * 1.6 - avg) * EMA;
      p = avg + (DRIFT * ++i) / total;
      high = Math.max(high, p);
      low = Math.min(low, p);
      return { ...d, price: p };
    });
    weeks.push({ x, days, open, close: p, high: high + rng() * 0.15, low: low - rng() * 0.15 });
  }
  return weeks;
}

function make({ name, description, layout }) {
  const bend = layout === 'bend';

  return {
    name,
    description,
    extraTop: HEADER + ROOM,

    render(ctx) {
      const { cal, colors, origin, grid, width, rng } = ctx;
      const dark = ctx.mode === 'dark';
      const cycle = n(ctx.duration(CYCLE));
      const up = colors.levels[3];
      const down = dark ? '#f85149' : '#cf222e';
      const weeks = market(cal, rng);
      const last = weeks.length - 1;
      const frac = (i) => (last > 0 ? i / last : 0);
      const tPrint = (i) => PRINT0 + frac(i) * PRINT;
      const home = RETURN + 0.5 + SCATTER + RISE;
      const drop = n(grid.height + ROOM + 40);

      let lo = weeks.length ? Math.min(...weeks.map((w) => w.low)) : 0;
      let hi = weeks.length ? Math.max(...weeks.map((w) => w.high)) : 1;
      if (hi - lo < MIN_SPAN) {
        const mid = (hi + lo) / 2;
        lo = mid - MIN_SPAN / 2;
        hi = mid + MIN_SPAN / 2;
      }
      const span = hi - lo;
      // Price to the centre line of a cell.
      const top = origin.y - ROOM + 4 + CELL / 2;
      const bottom = origin.y + grid.height - CELL / 2;
      const y = (v) => bottom - ((v - lo) / span) * (bottom - top);
      const cx = (w) => ctx.pos(w.x, 0).x + CELL / 2;

      let style =
        `.kf{animation:${cycle}s step-end infinite}` +
        `.kc{transform-box:view-box;animation:${cycle}s infinite}` +
        `.kc path{fill:none;stroke-width:1}` +
        `.kx{transform-box:fill-box;transform-origin:center;animation:${cycle}s infinite}` +
        `.ku{fill:${up};stroke:${up}}.kd{fill:${down};stroke:${down}}` +
        `.kh{font:600 12px ${FONT};fill:${colors.text}}.kr{text-anchor:end}` +
        `.kn{font-weight:700;font-size:13px}` +
        // Undoes the --hx/--hy/--hr offset a piece waits at, once --k is 1.
        `@keyframes kz{0%,${at(RETURN)}{transform:none;animation-timing-function:cubic-bezier(.3,.7,.3,1.1)}` +
        `${at(RETURN + RISE)},to{transform:rotate(calc(var(--hr) * var(--k) * -1)) translate(calc(var(--hx) * var(--k) * -1),calc(var(--hy) * var(--k) * -1))}}`;

      // Where the graph was: a faint ghost stays behind as chart paper.
      const ghost = cal.days.map((d) => {
        const p = ctx.pos(d.x, d.y);
        return rect(p.x, p.y, 'class="l0"');
      }).join('');

      // Each week's cells share one timeline; --y is how far a cell travels.
      const cells = [];
      const candles = [];
      weeks.forEach((w, i) => {
        const t = tPrint(i);
        const rising = w.close >= w.open;
        const yo = y(w.open);
        const yc = y(w.close);

        let targets;
        if (bend) {
          targets = w.days.map((d) => [d, y(d.price)]);
        } else {
          // Active days line up along the body, from open to close.
          const active = w.days.filter((d) => d.level > 0);
          targets = w.days.map((d) => {
            const j = active.indexOf(d);
            if (j < 0) return [d, null];
            const f = active.length === 1 ? 0.5 : j / (active.length - 1);
            return [d, rising ? yc + (yo - yc) * f : yo + (yc - yo) * f];
          });
        }

        const tint = !bend && !rising;
        const ease = 'animation-timing-function:cubic-bezier(.5,0,.3,1)';
        const atHome = `translate:0 0;scale:1;rotate:0deg;opacity:1${tint ? ';fill:var(--g)' : ''};${ease}`;
        const onChart = `translate:0 var(--y);scale:${bend ? BEAD : 1};rotate:0deg;opacity:var(--o)${tint ? ';fill:var(--r)' : ''}`;
        // Each piece then waits at --hx/--hy/--hr (--k:1) until the shared kz
        // animation, delayed per cell, flies it home.
        const f = FALL + frac(i) * 0.25 + rng() * 0.2;
        const wait = `translate:var(--hx) var(--hy);scale:1;rotate:var(--hr)${tint ? ';fill:var(--g)' : ''};--k:1`;
        // Fall out of the picture with the candles, then wait below it.
        style +=
          `@keyframes c${i}{0%,${at(t)}{${atHome};--k:0}` +
          `${at(t + MOVE)},${at(f)}{${onChart};--k:0;animation-timing-function:cubic-bezier(.5,0,.9,.5)}` +
          `${at(f + TUMBLE)}{translate:var(--dx) calc(var(--y) + ${drop}px);scale:${bend ? BEAD : 1};rotate:var(--rt);opacity:0;--k:0}` +
          `${at(f + TUMBLE + 0.05)},to{${wait};opacity:1}}`;

        for (const [d, ty] of targets) {
          const p = ctx.pos(d.x, d.y);
          const dy = ty === null ? 0 : ty - (p.y + CELL / 2);
          const hy = ctx.height - p.y + 8 + rng() * 30;
          const delay = (frac(i) * 0.5 + rng() * SCATTER) * (cycle / CYCLE);
          const vars = `--y:${n(dy)}px;--o:${ty === null ? 0 : d.level === 0 && bend ? 0.55 : 1}` +
            `;--dx:${n((rng() - 0.5) * 30)}px;--rt:${n((rng() - 0.5) * 140)}deg` +
            `;--hx:${n((rng() - 0.5) * 40)}px;--hy:${n(hy)}px;--hr:${n((rng() - 0.5) * 80)}deg` +
            (tint ? `;--g:${colors.levels[d.level]};--r:${mix(down, dark ? '#000000' : '#ffffff', [0, 0.55, 0.35, 0.15, 0][d.level])}` : '');
          cells.push(rect(p.x, p.y, `class="l${d.level} kx" style="animation-name:c${i},kz;animation-delay:0s,${n(delay)}s;${vars}"`));
        }

        // The candle fades in behind (bend) or around (stack) the cells.
        const x = cx(w);
        const fc = FALL + frac(i) * 0.25 + rng() * 0.2;
        style +=
          `@keyframes k${i}{0%,${at(t + MOVE * 0.5)}{opacity:0;translate:0 0;rotate:0deg}` +
          `${at(t + MOVE * 0.8)},${at(fc)}{opacity:1;translate:0 0;rotate:0deg;animation-timing-function:cubic-bezier(.5,0,.9,.5)}` +
          `${at(fc + TUMBLE)},to{opacity:0;translate:${n((rng() - 0.5) * 30)}px ${drop}px;rotate:${n((rng() - 0.5) * 60)}deg}}`;
        const body = bend
          ? `<rect x="${n(x - BODY / 2)}" y="${n(Math.min(yo, yc))}" width="${BODY}" height="${n(Math.max(1, Math.abs(yo - yc)))}" rx="1.5" fill-opacity="${dark ? 0.45 : 0.3}" stroke-width="1"/>`
          : '';
        candles.push(
          `<g class="kc ${rising ? 'ku' : 'kd'}" opacity="0" style="animation-name:k${i};transform-origin:${n(x)}px ${n((yo + yc) / 2)}px">` +
          `<path d="M${n(x)} ${n(y(w.high))}V${n(y(w.low))}"/>${body}</g>`,
        );
      });

      // Ticker: the user as a stock symbol, quoted at each weekly close.
      const first = weeks.length ? weeks[0].open : lo;
      const quote = (v) => 50 + 100 * ((v - lo) / span);
      const label = (v) => {
        const ch = ((quote(v) - quote(first)) / quote(first)) * 100;
        return `${ch >= 0 ? 'u' : 'd'}|$${quote(v).toFixed(2)} ${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(2)}%`;
      };
      const frames = new Map();
      const add = (key, windows) => {
        if (!frames.has(key)) frames.set(key, []);
        frames.get(key).push(...windows);
      };
      weeks.forEach((w, i) => add(label(w.close), [[tPrint(i) + MOVE / 2, i < last ? tPrint(i + 1) + MOVE / 2 : home]]));
      const final = label(weeks.length ? weeks[last].close : first);
      add(final, [[home, CYCLE + tPrint(0) + MOVE / 2]]);

      let quotes = '';
      let fi = 0;
      for (const [key, windows] of frames) {
        const [dir, text] = key.split('|');
        const nm = `f${fi++}`;
        style += blink(nm, windows);
        quotes += `<text class="kf"${key === final ? '' : ' opacity="0"'} style="animation-name:${nm}">` +
          `<tspan class="kn" fill="${dir === 'u' ? up : down}">${escapeXml(text)}</tspan></text>`;
      }
      // Short graphs only have room for the quote.
      const narrow = grid.width < 330;
      const base = n(origin.y - ROOM - 10);
      const head =
        (narrow ? '' : `<text class="kh" x="${n(origin.x)}" y="${base}">$${escapeXml(cal.user.toUpperCase().slice(0, 12))}</text>`) +
        `<g class="kh${narrow ? '' : ' kr'}" transform="translate(${n(narrow ? origin.x : width - origin.x)} ${base})">${quotes}</g>`;

      return {
        style,
        body: `<g opacity=".4">${ghost}</g><g>${candles.join('')}</g><g>${cells.join('')}</g>${head}`,
      };
    },
  };
}

export const fxBend = make({
  name: 'fx1',
  description: 'Your graph bends into a candlestick chart, one candle per week, trading under your username. Then the market crashes off the screen and every day flies back home.',
  layout: 'bend',
});

export const fxStack = make({
  name: 'fx2',
  description: "Each week's busy days stack into a candle, so active weeks rally and quiet ones slide. Then the chart tumbles off and every day flies back home.",
  layout: 'stack',
});