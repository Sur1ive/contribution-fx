import { CELL, PITCH, n, pct, rect } from '../core/svg.js';

// The year as a night sky: active days glow as twinkling stars on top of
// their cells, and clusters of the busiest days are linked into
// constellations that draw themselves, hold, fade and make way for the next.
// Figures and the shooting star rest at opacity 0, so the static /
// reduced-motion view is the plain graph with stars on top.

const CYCLE = 12; // seconds
const MAX_FIGURES = 5;
const MIN_STARS = 3;
const SPEED = 75; // line drawing speed, px per second
const MAX_DRAW = 2.8; // longest root-to-leaf drawing time
const HOLD = 1.9;
const FADE = 0.8;
const KEEP = 70; // % of the cycle an edge / ring stays up after it appears
const SHORT = 9; // lines stop short of the stars, star-chart style
const RING = 7.5;
const CAPTION = 18;
const TWINKLES = 12;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

// Per level: glow radius, core radius, sparkle radius (0 = none).
const STAR = [null, [5, 0.85, 0], [7, 1.15, 0], [10, 1.5, 4.5], [14, 1.9, 7.5]];

const short = (v) => n(v).replace(/^(-?)0\./, '$1.');
const at = (t) => pct((t / CYCLE) * 100);

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

function luma(hex) {
  const c = hexToRgb(hex);
  if (!c) return 0.5;
  const [r, g, b] = c.map((v) => (v / 255) ** 2.2);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luma(a), luma(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function segDist(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function crosses(p1, p2, p3, p4) {
  const o = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return o(p1, p2, p3) * o(p1, p2, p4) < 0 && o(p3, p4, p1) * o(p3, p4, p2) < 0;
}

/** Busiest days of one stretch of the year, never touching each other. */
function pickStars(days, want) {
  const ranked = days
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count || b.date.localeCompare(a.date));
  const picked = [];
  // Roomy spacing first so lines stay long enough to read; tighten if the stretch is sparse.
  for (const gap of [3, 2]) {
    if (picked.length >= 5) break;
    for (const d of ranked) {
      if (picked.length >= want) break;
      if (picked.every((p) => Math.max(Math.abs(p.x - d.x), Math.abs(p.y - d.y)) >= gap)) picked.push(d);
    }
  }
  // Drop loners that would need a long line to join the figure.
  for (;;) {
    if (picked.length <= MIN_STARS) break;
    const far = picked.findIndex((d) => picked.every((o) => o === d || Math.hypot(o.x - d.x, o.y - d.y) > 5.5));
    if (far === -1) break;
    picked.splice(far, 1);
  }
  return picked;
}

/**
 * Degree-limited, non-crossing spanning tree (Kruskal), plus sometimes one
 * extra edge that closes a loop. Returns the largest connected figure.
 */
function buildFigure(pts, rng) {
  const all = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      all.push({ a: i, b: j, len: Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) });
    }
  }
  all.sort((e, f) => e.len - f.len || e.a - f.a || e.b - f.b);
  const root = pts.map((_, i) => i);
  const find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
  const deg = pts.map(() => 0);
  const edges = [];
  const ok = (e) =>
    deg[e.a] < 3 && deg[e.b] < 3 &&
    pts.every((p, k) => k === e.a || k === e.b || segDist(p, pts[e.a], pts[e.b]) > 6) &&
    edges.every((f) => !crosses(pts[e.a], pts[e.b], pts[f.a], pts[f.b]));
  for (const e of all) {
    if (find(e.a) === find(e.b) || !ok(e)) continue;
    root[find(e.a)] = find(e.b);
    deg[e.a]++;
    deg[e.b]++;
    edges.push(e);
  }

  const groups = new Map();
  pts.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  const keep = [...groups.values()].sort((g, h) => h.length - g.length)[0];
  if (!keep || keep.length < MIN_STARS) return null;
  const inFigure = new Set(keep);
  const tree = edges.filter((e) => inFigure.has(e.a));

  const adj = new Map(keep.map((i) => [i, []]));
  for (const e of tree) {
    adj.get(e.a).push({ to: e.b, e });
    adj.get(e.b).push({ to: e.a, e });
  }
  const walk = (from, weight) => {
    const dist = new Map([[from, 0]]);
    const queue = [from];
    while (queue.length) {
      const i = queue.shift();
      for (const { to, e } of adj.get(i)) {
        if (dist.has(to)) continue;
        dist.set(to, dist.get(i) + weight(e));
        queue.push(to);
      }
    }
    return dist;
  };

  // Close one loop (>= 4 stars) when a short, clean edge allows it.
  const longest = Math.max(...tree.map((e) => e.len));
  let extra = null;
  if (rng() < 0.65) {
    extra = all.find((e) =>
      inFigure.has(e.a) && inFigure.has(e.b) && !tree.includes(e) &&
      e.len <= longest * 1.15 && ok(e) && walk(e.a, () => 1).get(e.b) >= 3) ?? null;
  }

  // Start at one end of the longest chain so the figure unfolds from a tip.
  const far = (dist) => [...dist].sort((p, q) => q[1] - p[1] || p[0] - q[0])[0][0];
  const u = far(walk(keep[0], (e) => e.len));
  const v = far(walk(u, (e) => e.len));
  return { stars: keep, tree, extra, start: rng() < 0.5 ? u : v, walk };
}

export default {
  name: 'constellation',
  description: 'Your year as a night sky: busy days twinkle as stars and draw themselves into constellations.',
  extraBottom: CAPTION,

  render(ctx) {
    const { cal, colors, rng, origin, grid, width } = ctx;
    const dark = ctx.mode === 'dark';
    const cycle = ctx.duration(CYCLE);
    const loop = `${n(cycle)}s linear infinite`;
    const delay = (t) => `${short(ctx.duration((((t % CYCLE) + CYCLE) % CYCLE) - CYCLE))}s`;
    const half = CELL / 2;
    const center = (d) => {
      const p = ctx.pos(d.x, d.y);
      return { x: p.x + half, y: p.y + half };
    };

    const top = colors.levels[4];
    const ink = dark ? mix(top, '#ffffff', 0.8) : mix(top, '#000000', 0.15);
    const glow = dark ? mix(top, '#ffffff', 0.2) : colors.levels[3];
    const bloom = dark ? mix(top, '#ffffff', 0.6) : glow;
    const line = dark ? mix(top, '#ffffff', 0.55) : ink;

    // Shared star sprites: one radial glow per level, a core and, for busy days, a sparkle.
    let defs = '';
    for (let lv = 1; lv <= 4; lv++) {
      const [gr, cr, sp] = STAR[lv];
      // Dark: a bloom from the centre. Paper: a halo around the cell that leaves its colour untouched.
      const a = dark ? 0.3 + lv * 0.13 : 0.1 + lv * 0.07;
      const halo = dark || lv >= 3;
      const stops = dark
        ? `<stop offset="0" stop-color="${bloom}" stop-opacity="${short(a)}"/><stop offset=".3" stop-color="${glow}" stop-opacity="${short(a * 0.45)}"/>`
        : `<stop offset="${short(4.5 / gr)}" stop-color="${glow}" stop-opacity="0"/><stop offset="${short(5.8 / gr)}" stop-color="${glow}" stop-opacity="${short(a)}"/>`;
      if (halo) {
        defs += `<radialGradient id="fx-const-g${lv}">${stops}<stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>`;
      }
      // On paper, dark cells get white stars and light cells ink dots.
      const cell = colors.levels[lv];
      const core = dark || contrast(cell, ink) >= contrast(cell, '#ffffff') ? ink : '#ffffff';
      const k = short(sp * 0.12);
      const spark = sp
        ? `<path d="M0 -${sp}Q${k} -${k} ${sp} 0Q${k} ${k} 0 ${sp}Q-${k} ${k} -${sp} 0Q-${k} -${k} 0 -${sp}Z" fill="${core}" opacity="${dark ? '.85' : '.8'}"/>`
        : '';
      defs +=
        `<g id="fx-const-s${lv}">${halo ? `<circle r="${gr}" fill="url(#fx-const-g${lv})"/>` : ''}${spark}` +
        `<circle r="${short(cr)}" fill="${core}"/></g>`;
    }
    defs +=
      `<radialGradient id="fx-const-fl"><stop offset="0" stop-color="${dark ? '#ffffff' : glow}" stop-opacity=".9"/>` +
      `<stop offset=".3" stop-color="${glow}" stop-opacity=".45"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="fx-const-ss"><stop offset="0" stop-color="${line}" stop-opacity="0"/><stop offset="1" stop-color="${line}"/></linearGradient>`;

    // Twinkle: a few shared curves, desynchronised by per-class delays.
    const curves = [
      [4, '0%,100%{opacity:1}50%{opacity:.4}'],
      [6, '0%,100%{opacity:.95}30%{opacity:.35}42%{opacity:1}70%{opacity:.6}'],
      [3, '0%,100%{opacity:1}12%{opacity:.3}24%{opacity:1}'],
    ];
    let style = curves.map(([, kf], i) => `@keyframes tw${i}{${kf}}`).join('');
    for (let i = 0; i < TWINKLES; i++) {
      const [period] = curves[i % curves.length];
      style += `.t${i}{animation:tw${i % curves.length} ${n(ctx.duration(period))}s ${short(-ctx.duration(rng() * period))}s ease-in-out infinite}`;
    }

    const cells = [];
    const stars = [];
    for (const d of cal.days) {
      const p = ctx.pos(d.x, d.y);
      cells.push(rect(p.x, p.y, `class="l${d.level}"`));
      if (d.level > 0) {
        stars.push(`<use href="#fx-const-s${d.level}" x="${n(p.x + half)}" y="${n(p.y + half)}" class="t${Math.floor(rng() * TWINKLES)}"/>`);
      }
    }

    // Faint star dust in the gutters between cells.
    let dust = '';
    if (cal.days.length) {
      for (let i = 0; i < cal.cols * 3; i++) {
        const onCol = rng() < 0.5;
        let x = origin.x + rng() * grid.width;
        let y = origin.y + rng() * grid.height;
        if (onCol) x = origin.x + Math.max(1, Math.min(cal.cols - 1, Math.round((x - origin.x) / PITCH))) * PITCH - 1.5;
        else y = origin.y + (1 + Math.floor(rng() * 6)) * PITCH - 1.5;
        dust += `<circle cx="${n(x)}" cy="${n(y)}" r="${short(rng() < 0.15 ? 0.75 : 0.45)}" class="t${Math.floor(rng() * TWINKLES)}"/>`;
      }
    }

    // One figure per stretch of the year; consecutive figures sit far apart.
    const count = Math.max(1, Math.min(MAX_FIGURES, Math.round(cal.cols / 10.5)));
    const span = cal.cols / count;
    const figures = [];
    for (let s = 0; s < count; s++) {
      const days = cal.days.filter((d) => d.x >= Math.round(s * span) && d.x < Math.round((s + 1) * span));
      const picked = pickStars(days, 5 + Math.floor(rng() * 4));
      if (picked.length < MIN_STARS) continue;
      const fig = buildFigure(picked.map(center), rng);
      if (fig) figures.push({ ...fig, days: picked, pts: picked.map(center) });
    }
    const order = figures
      .map((f, i) => ({ f, k: (i * 0.618034) % 1 }))
      .sort((a, b) => a.k - b.k)
      .map((o) => o.f);

    style +=
      `.fx-const-f{opacity:0}.fx-const-f path{fill:none;transform-box:fill-box;transform-origin:0 0}` +
      `.eu{stroke:${line};stroke-width:3.2;stroke-opacity:${dark ? '.2' : '.1'}}` +
      `.el{stroke:${line};stroke-width:${dark ? '1.1' : '.9'};stroke-opacity:${dark ? '.95' : '.8'}}` +
      `.rn,.fl{opacity:0;transform-box:fill-box;transform-origin:center}` +
      `.rn{fill:none;stroke:${line};stroke-width:.9;animation:rn ${loop};animation-delay:inherit}` +
      `.fl{fill:url(#fx-const-fl);animation:fl ${loop};animation-delay:inherit}` +
      `.cp{opacity:0;animation:cp ${loop}}.cp text{font:600 8px ${FONT};letter-spacing:.2em;text-anchor:middle;fill:${colors.text}}` +
      `.cp path{fill:none;stroke:${colors.text};stroke-width:.8;stroke-opacity:.6}` +
      `@keyframes rn{0%{opacity:0;transform:scale(.2);animation-timing-function:cubic-bezier(.2,.8,.3,1)}${at(0.3)}{opacity:1;transform:scale(1.45)}` +
      `${at(0.75)}{transform:scale(1)}${KEEP}%{opacity:1;transform:scale(1)}${KEEP + 0.1}%,100%{opacity:0}}` +
      `@keyframes fl{0%{opacity:0;transform:scale(.3)}${at(0.06)}{opacity:1}${at(0.8)},100%{opacity:0;transform:scale(2.6)}}` +
      `@keyframes cp{0%{opacity:0}${at(0.6)}{opacity:1}${KEEP}%{opacity:1}${KEEP + 0.1}%,100%{opacity:0}}`;

    const edgeKeys = new Set();
    const shows = [];
    const slot = CYCLE / Math.max(1, order.length);
    const bottom = origin.y + grid.height;

    order.forEach((fig, k) => {
      const { pts, tree, extra } = fig;
      const t0 = 0.25 + k * slot;
      const dur = (e) => Math.max(0.2, e.len / SPEED);
      let reach = fig.walk(fig.start, dur);
      const depth = Math.max(...reach.values());
      const squeeze = depth > MAX_DRAW ? MAX_DRAW / depth : 1;
      const quant = (e) => Math.round(dur(e) * squeeze * 20) / 20;
      reach = fig.walk(fig.start, quant);
      const drawn = Math.max(...reach.values());
      const hold = Math.max(HOLD, Math.min(4.5, slot * 2.3 - drawn - FADE));
      const fadeAt = drawn + hold;
      style +=
        `@keyframes c${k}{0%{opacity:1}${at(fadeAt)}{opacity:1}${at(fadeAt + FADE)},100%{opacity:0}}` +
        `.c${k}{animation:c${k} ${loop};animation-delay:${delay(t0)}}`;

      let lines = '';
      const edge = (e, from, to, start) => {
        const a = pts[from];
        const b = pts[to];
        const len = e.len - SHORT * 2;
        if (len <= 0) return;
        const ux = (b.x - a.x) / e.len;
        const uy = (b.y - a.y) / e.len;
        const q = Math.max(1, Math.round(quant(e) * 20));
        edgeKeys.add(q);
        const angle = (Math.atan2(uy, ux) * 180) / Math.PI;
        lines +=
          `<g transform="translate(${n(a.x + ux * SHORT)} ${n(a.y + uy * SHORT)}) rotate(${n(angle)})" style="animation-delay:${delay(t0 + start)}">` +
          `<path d="M0 0H${n(len)}" class="eu e${q}"/><path d="M0 0H${n(len)}" class="el e${q}"/></g>`;
      };
      for (const e of tree) {
        const [from, to] = reach.get(e.a) <= reach.get(e.b) ? [e.a, e.b] : [e.b, e.a];
        edge(e, from, to, reach.get(from));
      }
      if (extra) {
        const [from, to] = reach.get(extra.a) >= reach.get(extra.b) ? [extra.a, extra.b] : [extra.b, extra.a];
        edge(extra, from, to, reach.get(from));
      }

      let nodes = '';
      for (const i of fig.stars) {
        const p = pts[i];
        const r = RING + (fig.days[i].level >= 4 ? 0.7 : 0);
        nodes +=
          `<g style="animation-delay:${delay(t0 + reach.get(i))}"><circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(r * 1.2)}" class="fl"/>` +
          `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(r)}" class="rn"/></g>`;
      }

      // Caption under the graph: the weeks this figure spans and its month.
      const xs = fig.stars.map((i) => pts[i].x);
      const x0 = Math.min(...xs) - 4;
      const x1 = Math.max(...xs) + 4;
      const mid = fig.stars.map((i) => fig.days[i]).sort((a, b) => a.date.localeCompare(b.date))[Math.floor(fig.stars.length / 2)];
      const label = `${MONTHS[Number(mid.date.slice(5, 7)) - 1] ?? ''} ${mid.date.slice(0, 4)}`;
      const cx = Math.min(width - 40, Math.max(40, (x0 + x1) / 2));
      const y = bottom + 4;
      const caption =
        `<g class="cp" style="animation-delay:${delay(t0 + drawn * 0.6)}">` +
        `<path d="M${n(x0)} ${n(y)}v2.5H${n(x1)}v-2.5"/>` +
        `<text x="${n(cx)}" y="${n(y + 12)}">${label}</text></g>`;

      shows.push(`<g class="fx-const-f c${k}">${lines}${nodes}${caption}</g>`);
    });

    for (const q of edgeKeys) {
      style +=
        `@keyframes e${q}{0%{transform:scaleX(0);animation-timing-function:cubic-bezier(.4,0,.6,1)}` +
        `${at(q / 20)}{transform:scaleX(1)}${KEEP}%{transform:scaleX(1)}${KEEP + 0.1}%,100%{transform:scaleX(0)}}` +
        `.e${q}{animation:e${q} ${loop};animation-delay:inherit}`;
    }

    // One shooting star per loop, in the quietest gap between figures.
    let meteor = '';
    if (cal.days.length) {
      const t = order.length ? 0.25 + slot * 0.55 + Math.floor(rng() * order.length) * slot : CYCLE * 0.4;
      const x = origin.x + grid.width * (0.35 + rng() * 0.55);
      const travel = 230;
      style +=
        `@keyframes ss{0%,${at(t)}{opacity:0;transform:translateX(0);animation-timing-function:cubic-bezier(.3,.1,.7,1)}` +
        `${at(t + 0.08)}{opacity:1}${at(t + 0.55)}{opacity:.9}${at(t + 0.8)},100%{opacity:0;transform:translateX(${travel}px)}}` +
        `.ss{opacity:0;animation:ss ${loop}}`;
      meteor =
        `<g transform="translate(${n(x)} ${n(origin.y - 8)}) rotate(152)"><g class="ss">` +
        `<rect x="-90" y="-.8" width="90" height="1.6" rx=".8" fill="url(#fx-const-ss)"/>` +
        `<circle r="6" fill="url(#fx-const-fl)"/><circle r="1.5" fill="${ink}"/></g></g>`;
    }

    return {
      style,
      body:
        `<defs>${defs}</defs><g>${cells.join('')}</g><g fill="${ink}" opacity="${dark ? '.55' : '.3'}">${dust}</g>` +
        `${shows.join('')}<g>${stars.join('')}</g>${meteor}`,
    };
  },
};
