import { CELL, GAP, PITCH, n, pct, rect } from '../core/svg.js';

// The year as a printed circuit board. The board powers down, copper traces
// etch outward from a chip on a busy day, routed through the gaps between
// cells with chamfered bends and vias. Then the chip boots, signal packets
// race down every trace and each pad they reach lights up like an LED. The
// board surges once, the copper fades and the plain graph rests.
// Everything on top of the cells rests at opacity 0, so the static /
// reduced-motion view is the plain graph.

const CYCLE = 10; // seconds
const DIM_AT = 0.35;
const ETCH_AT = 0.7;
const ETCH_MAX = 1.9;
const BOOT_AT = 2.75;
const PULSE_AT = 3.05;
const PULSE_MAX = 2.9;
const SURGE_AT = 6.25;
const FADE_AT = 6.85;
const FADE = 0.75;
const KEEP = 7.4; // an etched piece stays drawn this long after it starts
const Q = 0.05; // time quantum for shared keyframes and delays
const DIM = 0.28;
const CHAMFER = 2.6;
const PACKET = 11; // px
const EXITS = 5;
const TURN = 2.6;
const ROWS = 8; // lattice rows: node (i, j) is the top-left corner of cell (i, j)
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

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

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(k, v) {
    const a = this.a;
    a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Grow a routing tree over the gap lattice from the chip's corners until every
 * active day borders a trace (maze router with turn penalties, Prim-style).
 */
function route(cal, chip, rng) {
  const cols = cal.cols;
  const byXY = new Map(cal.days.map((d) => [d.x * 7 + d.y, d]));
  const day = (x, y) => (y >= 0 && y < 7 && x >= 0 ? byXY.get(x * 7 + y) : undefined);
  const node = (i, j) => i * ROWS + j;
  const ij = (v) => [Math.floor(v / ROWS), v % ROWS];
  // Cells on both sides of the edge leaving node (i, j) in direction k.
  const sides = (i, j, k) => {
    if (k === 0) return [day(i, j - 1), day(i, j)];
    if (k === 1) return [day(i - 1, j - 1), day(i - 1, j)];
    if (k === 2) return [day(i - 1, j), day(i, j)];
    return [day(i - 1, j - 1), day(i, j - 1)];
  };
  const edgeKey = (a, b) => (a < b ? a * 4096 + b : b * 4096 + a);
  const roots = [node(chip.x, chip.y), node(chip.x + 1, chip.y), node(chip.x, chip.y + 1), node(chip.x + 1, chip.y + 1)];
  const chipSide = new Set([
    edgeKey(roots[0], roots[1]), edgeKey(roots[2], roots[3]), edgeKey(roots[0], roots[2]), edgeKey(roots[1], roots[3]),
  ]);

  const jitter = new Map();
  const neighbours = (v) => {
    const [i, j] = ij(v);
    const out = [];
    DIRS.forEach(([dx, dy], k) => {
      const i2 = i + dx;
      const j2 = j + dy;
      if (i2 < 0 || i2 > cols || j2 < 0 || j2 >= ROWS) return;
      const s = sides(i, j, k);
      if (!s[0] && !s[1]) return;
      const w = node(i2, j2);
      const key = edgeKey(v, w);
      if (chipSide.has(key)) return;
      if (!jitter.has(key)) jitter.set(key, rng() * 0.35);
      out.push({ w, k, key, cells: s, cost: (k < 2 ? 1 : 1.15) + jitter.get(key) });
    });
    return out;
  };

  const inTree = new Set(roots);
  const deg = new Map();
  const lastDir = new Map();
  const edges = new Map();
  const served = new Set([chip]);
  const todo = cal.days.filter((d) => d.level > 0 && d !== chip);

  while (todo.some((d) => !served.has(d))) {
    const best = new Map();
    const prev = new Map();
    const heap = new Heap();
    for (const v of inTree) {
      // Branching off a straight run costs a little, a third branch a lot.
      const dg = deg.get(v) ?? 0;
      const start = dg === 0 ? 0 : dg === 1 ? 0.2 : dg === 2 ? 1.6 : 6;
      const s = v * 5 + (dg === 1 ? lastDir.get(v) : 4);
      best.set(s, start);
      heap.push(start, s);
    }
    let found = null;
    while (heap.size) {
      const [cost, s] = heap.pop();
      if (cost > (best.get(s) ?? Infinity)) continue;
      if (found && cost >= found.cost) break;
      const k0 = s % 5;
      for (const e of neighbours(Math.floor(s / 5))) {
        if (edges.has(e.key) || inTree.has(e.w)) continue;
        const turn = k0 === 4 || k0 === e.k ? 0 : (k0 >> 1) === (e.k >> 1) ? Infinity : TURN;
        const c = cost + turn + e.cost;
        if (e.cells.some((d) => d && d.level > 0 && !served.has(d)) && (!found || c < found.cost)) found = { cost: c, s, e };
        const s2 = e.w * 5 + e.k;
        if (c < (best.get(s2) ?? Infinity)) {
          best.set(s2, c);
          prev.set(s2, s);
          heap.push(c, s2);
        }
      }
    }
    if (!found) break;
    const path = [{ from: Math.floor(found.s / 5), to: found.e.w, k: found.e.k }];
    for (let s = found.s; prev.has(s); s = prev.get(s)) {
      path.unshift({ from: Math.floor(prev.get(s) / 5), to: Math.floor(s / 5), k: s % 5 });
    }
    for (const step of path) {
      edges.set(edgeKey(step.from, step.to), [step.from, step.to]);
      inTree.add(step.from);
      inTree.add(step.to);
      deg.set(step.from, (deg.get(step.from) ?? 0) + 1);
      deg.set(step.to, (deg.get(step.to) ?? 0) + 1);
      lastDir.set(step.to, step.k);
      const [i, j] = ij(step.from);
      for (const d of sides(i, j, step.k)) if (d && d.level > 0) served.add(d);
    }
  }
  return { edges: [...edges.values()], roots, ij, sides };
}

/** Busiest day in the middle of the year, so traces fan out to both ends. */
function pickChip(cal) {
  let best = null;
  for (const d of cal.days) {
    if (d.level === 0) continue;
    const off = Math.abs((d.x + 0.5) / cal.cols - 0.5) * 2;
    const score = (off < 0.35 ? 1e6 : 0) + d.level * 1000 + Math.min(d.count, 999) * (d.y === 0 || d.y === 6 ? 0.5 : 1);
    if (!best || score > best.score || (score === best.score && off < best.off)) best = { d, score, off };
  }
  return best?.d ?? null;
}

/** Polyline through the points with chamfered (45°) corners, as a compact path. */
function tracePath(p) {
  const q = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = q[q.length - 1];
    const b = p[i];
    const c = p[i + 1];
    if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) > 0.01) q.push(b);
  }
  q.push(p[p.length - 1]);
  const out = [q[0]];
  for (let i = 1; i < q.length - 1; i++) {
    const [a, b, c] = [q[i - 1], q[i], q[i + 1]];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y);
    const l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const k = Math.min(CHAMFER, l1 / 2, l2 / 2);
    out.push({ x: b.x - ((b.x - a.x) / l1) * k, y: b.y - ((b.y - a.y) / l1) * k });
    out.push({ x: b.x + ((c.x - b.x) / l2) * k, y: b.y + ((c.y - b.y) / l2) * k });
  }
  out.push(q[q.length - 1]);
  let len = 0;
  let d = `M${n(out[0].x)} ${n(out[0].y)}`;
  for (let i = 1; i < out.length; i++) {
    const dx = out[i].x - out[i - 1].x;
    const dy = out[i].y - out[i - 1].y;
    len += Math.hypot(dx, dy);
    d += Math.abs(dy) < 0.01 ? `h${n(dx)}` : Math.abs(dx) < 0.01 ? `v${n(dy)}` : `l${n(dx)} ${n(dy)}`;
  }
  return { d, len };
}

export default {
  name: 'circuit',
  description: 'Your graph becomes a circuit board: copper traces etch between the days and signals light them up like LEDs.',

  render(ctx) {
    const { cal, colors, rng, origin, width } = ctx;
    const dark = ctx.mode === 'dark';
    const { levels } = colors;
    const loop = `${n(ctx.duration(CYCLE))}s linear infinite`;
    const half = CELL / 2;
    const nx = (i) => origin.x + i * PITCH - GAP / 2;
    const ny = (j) => origin.y + j * PITCH - GAP / 2;
    const qt = (t) => Math.round(t / Q);

    const top = levels[4];
    const copper = dark ? mix(levels[3], top, 0.5) : mix(levels[3], top, 0.35);
    const spark = dark ? mix(top, '#ffffff', 0.8) : mix(top, '#000000', 0.3);
    const hot = dark ? mix(top, '#ffffff', 0.55) : colors.accent;
    const glow = dark ? mix(top, '#ffffff', 0.35) : levels[2];
    const halo = dark ? top : mix(levels[2], levels[1], 0.3);
    const hole = dark ? '#0d1117' : '#ffffff';

    const chip = pickChip(cal);
    const R = chip ? route(cal, chip, rng) : { edges: [], roots: [] };

    // Geometric tree: lattice nodes, edge midpoints where pads tap in, pad centres.
    const pts = new Map();
    const adj = new Map();
    const addPt = (id, x, y) => {
      if (pts.has(id)) return;
      pts.set(id, { x, y });
      adj.set(id, new Set());
    };
    const link = (a, b) => { adj.get(a).add(b); adj.get(b).add(a); };
    const unlink = (a, b) => { adj.get(a).delete(b); adj.get(b).delete(a); };
    const rootIds = new Set(R.roots.map((v) => `n${v}`));
    for (const v of R.roots) addPt(`n${v}`, nx(R.ij(v)[0]), ny(R.ij(v)[1]));
    const edgeOf = new Map();
    for (const [a, b] of R.edges) {
      const [i1, j1] = R.ij(a);
      const [i2, j2] = R.ij(b);
      addPt(`n${a}`, nx(i1), ny(j1));
      addPt(`n${b}`, nx(i2), ny(j2));
      link(`n${a}`, `n${b}`);
      const [i, j] = R.ij(Math.min(a, b));
      for (const d of R.sides(i, j, i1 === i2 ? 2 : 0)) {
        if (!d || d.level === 0) continue;
        if (!edgeOf.has(d)) edgeOf.set(d, []);
        edgeOf.get(d).push([a, b]);
      }
    }

    const distances = () => {
      const dist = new Map([...rootIds].map((id) => [id, 0]));
      const heap = new Heap();
      for (const id of rootIds) heap.push(0, id);
      while (heap.size) {
        const [du, u] = heap.pop();
        if (du > dist.get(u)) continue;
        for (const w of adj.get(u)) {
          const d = du + Math.hypot(pts.get(u).x - pts.get(w).x, pts.get(u).y - pts.get(w).y);
          if (d < (dist.get(w) ?? Infinity)) {
            dist.set(w, d);
            heap.push(d, w);
          }
        }
      }
      return dist;
    };
    let dist = distances();

    // Each pad taps the middle of its side edge that powers up first.
    const pads = [];
    for (const d of cal.days) {
      const opts = edgeOf.get(d);
      if (!opts || d === chip) continue;
      const near = (e) => Math.min(dist.get(`n${e[0]}`), dist.get(`n${e[1]}`));
      const [a, b] = opts.reduce((p, q) => (near(q) < near(p) ? q : p));
      const mid = `m${Math.min(a, b)}_${Math.max(a, b)}`;
      if (!pts.has(mid)) {
        const A = pts.get(`n${a}`);
        const B = pts.get(`n${b}`);
        addPt(mid, (A.x + B.x) / 2, (A.y + B.y) / 2);
        unlink(`n${a}`, `n${b}`);
        link(`n${a}`, mid);
        link(mid, `n${b}`);
      }
      const p = ctx.pos(d.x, d.y);
      const id = `p${d.x}_${d.y}`;
      addPt(id, p.x + half, p.y + half);
      link(mid, id);
      pads.push({ d, id });
    }
    // Trim half-edges dangling past the last tap.
    for (let again = true; again;) {
      again = false;
      for (const [id, set] of adj) {
        if (id[0] !== 'n' || set.size !== 1 || rootIds.has(id) || [...set][0][0] !== 'm') continue;
        unlink(id, [...set][0]);
        again = true;
      }
    }
    dist = distances();

    // A few traces leave the board over its top, left and right edges.
    const exits = [];
    const used = new Set([...adj].filter(([id, set]) => id[0] === 'n' && set.size).map(([id]) => Number(id.slice(1))));
    const has = (x, y) => cal.days.some((d) => d.x === x && d.y === y);
    // Free run from node (i, j) straight to the border: every node on the way unused, every gap beside a day.
    const free = (i, j, di, dj) => {
      for (let a = i, b = j; ; a += di, b += dj) {
        const [c, e] = [a + di, b + dj];
        if (c < 0 || c > cal.cols || e < 0) return true;
        if (used.has(c * ROWS + e)) return false;
        const beside = dj ? [has(a - 1, e), has(a, e)] : [has(Math.min(a, c), b - 1), has(Math.min(a, c), b)];
        if (!beside[0] && !beside[1]) return false;
      }
    };
    const edgeNodes = [];
    for (const [id, set] of adj) {
      if (id[0] !== 'n' || rootIds.has(id) || !dist.has(id) || set.size > 2) continue;
      const [i, j] = R.ij(Number(id.slice(1)));
      const p = pts.get(id);
      if (j <= 2 && free(i, j, 0, -1)) edgeNodes.push({ id, x: p.x, y: -1, r: rng() });
      if (i <= 2 && j > 0 && j < 7 && free(i, j, -1, 0)) edgeNodes.push({ id, x: -1, y: p.y, r: rng() - 1 });
      if (i >= cal.cols - 2 && j > 0 && j < 7 && free(i, j, 1, 0)) edgeNodes.push({ id, x: width + 1, y: p.y, r: rng() - 1 });
    }
    edgeNodes.sort((a, b) => a.r - b.r);
    for (const e of edgeNodes) {
      if (exits.length >= EXITS) break;
      if (exits.some((o) => Math.hypot(o.x - e.x, o.y - e.y) < 110)) continue;
      exits.push(e);
      addPt(`x${exits.length}`, e.x, e.y);
      link(e.id, `x${exits.length}`);
    }
    if (exits.length) dist = distances();

    // Orient away from the chip and cut the tree into chains, preferring straight runs.
    const kids = new Map();
    for (const [id, set] of adj) if (dist.has(id)) kids.set(id, [...set].filter((w) => dist.get(w) > dist.get(id)));
    const height = new Map();
    const h = (id) => {
      if (!height.has(id)) height.set(id, Math.max(0, ...kids.get(id).map((c) => h(c) + 1)));
      return height.get(id);
    };
    const chains = [];
    const grow = (from, first) => {
      const chain = [from, first];
      for (let cur = first; kids.get(cur).length;) {
        const p = pts.get(chain[chain.length - 2]);
        const c = pts.get(cur);
        const list = kids.get(cur);
        const next = list.find((k) => {
          const q = pts.get(k);
          return Math.abs((c.x - p.x) * (q.y - c.y) - (c.y - p.y) * (q.x - c.x)) < 0.01;
        }) ?? [...list].sort((a, b) => h(b) - h(a))[0];
        for (const k of list) if (k !== next) grow(cur, k);
        chain.push(next);
        cur = next;
      }
      chains.push(chain);
    };
    for (const id of rootIds) for (const c of kids.get(id) ?? []) grow(id, c);

    const maxDist = Math.max(1, ...dist.values());
    const etchV = Math.max(maxDist / ETCH_MAX, 160);
    const pulseV = Math.max(maxDist / PULSE_MAX, 140);
    const etchAt = (id) => ETCH_AT + dist.get(id) / etchV;
    const pulseAt = (id) => PULSE_AT + dist.get(id) / pulseV;

    // Shared delay classes, one per time quantum in use.
    const delays = new Set();
    const dc = (t) => {
      const k = qt(t);
      delays.add(k);
      return `d${k}`;
    };

    let style = '';
    const etchKeys = new Set();
    const pulseKeys = new Set();
    let traces = '';
    let packets = '';
    for (const chain of chains) {
      const p = chain.map((id) => pts.get(id));
      const end = chain[chain.length - 1];
      if (end[0] === 'p') {
        // Stop at the pad's edge.
        const [a, b] = [p[p.length - 2], p[p.length - 1]];
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        const r = 2.4;
        p[p.length - 1] = { x: b.x - ((b.x - a.x) / l) * r, y: b.y - ((b.y - a.y) / l) * r };
      }
      const { d, len } = tracePath(p);
      const eq = Math.max(1, qt(len / etchV));
      const pq = Math.max(1, qt(len / pulseV));
      etchKeys.add(eq);
      pulseKeys.add(pq);
      traces += `<path d="${d}" pathLength="1" class="e${eq} ${dc(etchAt(chain[0]))}"/>`;
      packets += `<path d="${d}" pathLength="1" class="p${pq} ${dc(pulseAt(chain[0]))}" stroke-dasharray="${short(Math.min(0.6, PACKET / len))} 2"/>`;
    }

    // Pads grow with the level: rings, then square chip pads. Junctions get vias.
    let parts = '';
    let halos = '';
    const lit = new Map();
    for (const { d, id } of pads) {
      if (!dist.has(id)) continue;
      const c = pts.get(id);
      parts += d.level >= 4
        ? `<rect x="${n(c.x - 3)}" y="${n(c.y - 3)}" width="6" height="6" rx="1" class="pd ${dc(etchAt(id))}"/>`
        : `<circle cx="${n(c.x)}" cy="${n(c.y)}" r="${[0, 1.6, 2.1, 2.4][d.level]}" class="pd ${dc(etchAt(id))}"/>`;
      lit.set(d, pulseAt(id));
      if (d.level >= 3) halos += `<circle cx="${n(c.x)}" cy="${n(c.y)}" r="${d.level === 4 ? 13 : 10}" class="lf ${dc(pulseAt(id))}"/>`;
    }
    for (const [id, set] of adj) {
      if (id[0] !== 'n' || set.size < 3 || !dist.has(id)) continue;
      const c = pts.get(id);
      parts += `<circle cx="${n(c.x)}" cy="${n(c.y)}" r="1.8" class="pd vi ${dc(etchAt(id))}"/>`;
    }
    if (chip) {
      const p = ctx.pos(chip.x, chip.y);
      parts += `<rect x="${n(p.x - 3)}" y="${n(p.y - 3)}" width="17" height="17" rx="2.5" class="pd ch ${dc(ETCH_AT)}"/>`;
      halos += `<circle cx="${n(p.x + half)}" cy="${n(p.y + half)}" r="34" class="lf ${dc(BOOT_AT)}"/>`;
      lit.set(chip, BOOT_AT);
    }

    // Lit days dim with the board and relight when their packet arrives.
    const buckets = new Set();
    const cells = [];
    for (const d of cal.days) {
      const p = ctx.pos(d.x, d.y);
      const k = lit.has(d) ? qt(lit.get(d)) : null;
      if (k !== null) buckets.add(k);
      cells.push(rect(p.x, p.y, `class="l${d.level}${k === null ? '' : ` b${k}`}"`));
    }
    const B = 'fill:var(--b)';
    for (const k of buckets) {
      const t = k * Q;
      // Opacity and fill keyframe independently; the surge only shows once the cell has settled.
      const surge = t + 0.6 < SURGE_AT ? `,${at(SURGE_AT)}{${B}}${at(SURGE_AT + 0.08)}{fill:var(--s)}${at(SURGE_AT + 0.7)}` : '';
      style +=
        `@keyframes b${k}{0%,${at(DIM_AT)}{opacity:1}${at(DIM_AT + 0.45)},${at(t)}{opacity:${short(DIM)}}${at(t + 0.03)},100%{opacity:1}` +
        `0%,${at(t)}{${B}}${at(t + 0.03)}{fill:var(--h)}${at(t + 0.6)}${surge},100%{${B}}}.b${k}{animation:b${k} ${loop}}`;
    }

    for (const q of etchKeys) {
      style +=
        `@keyframes e${q}{0%{stroke-dashoffset:1}${at(q * Q)},${at(KEEP)}{stroke-dashoffset:0}${at(KEEP + 0.01)},100%{stroke-dashoffset:1}}` +
        `.e${q}{animation-name:e${q}}`;
    }
    for (const q of pulseKeys) {
      style += `@keyframes p${q}{0%{stroke-dashoffset:0}${at(q * Q)},100%{stroke-dashoffset:-1}}.p${q}{animation-name:p${q}}`;
    }

    style +=
      levels.map((c, i) => `.l${i}{--b:${c};--h:${i ? mix(c, hot, 0.75) : c};--s:${i ? mix(c, hot, 0.4) : c}}`).join('') +
      `.fx-circuit-b{opacity:0;animation:bd ${loop}}` +
      `@keyframes bd{0%,${at(ETCH_AT - 0.05)}{opacity:0}${at(ETCH_AT)},${at(FADE_AT)}{opacity:1}${at(FADE_AT + FADE)},100%{opacity:0}}` +
      `.cu{fill:none;stroke:${copper};stroke-width:1.2;stroke-linejoin:round;animation:su ${loop}}` +
      `@keyframes su{0%,${at(SURGE_AT)}{stroke:${copper}}${at(SURGE_AT + 0.1)}{stroke:${spark}}${at(SURGE_AT + 0.6)},100%{stroke:${copper}}}` +
      `.cu path,.pk path,.pd,.lf{animation-duration:${n(ctx.duration(CYCLE))}s;animation-timing-function:linear;animation-iteration-count:infinite}` +
      `.cu path{stroke-dasharray:1 2}` +
      `.pk{fill:none;stroke:${spark};stroke-width:2}.pk path{stroke-dashoffset:-1}` +
      `.pd{opacity:0;animation-name:pd}.vi{fill:${hole}}.ch{stroke-width:1.5}` +
      `@keyframes pd{0%{opacity:0}${at(0.15)},${at(KEEP)}{opacity:1}${at(KEEP + 0.01)},100%{opacity:0}}` +
      `.lf{opacity:0;fill:url(#fx-circuit-g);animation-name:lf}` +
      `@keyframes lf{0%{opacity:0}${at(0.04)}{opacity:1}${at(0.9)},100%{opacity:0}}` +
      [...delays].map((k) => `.d${k}{animation-delay:${short(ctx.duration(k * Q - CYCLE))}s}`).join('');

    const defs =
      `<radialGradient id="fx-circuit-g"><stop offset="0" stop-color="${glow}" stop-opacity="${dark ? '.7' : '.45'}"/>` +
      `<stop offset=".45" stop-color="${glow}" stop-opacity="${dark ? '.25' : '.15'}"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>` +
      `<filter id="fx-circuit-f" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${ctx.height}">` +
      `<feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="b"/><feFlood flood-color="${halo}"/><feComposite in2="b" operator="in"/>` +
      `<feComponentTransfer><feFuncA type="linear" slope="2.2"/></feComponentTransfer>` +
      `<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

    return {
      style,
      body:
        `<defs>${defs}</defs><g>${cells.join('')}</g>` +
        `<g class="fx-circuit-b"><g>${halos}</g><g class="cu">${traces}${parts}</g><g class="pk" filter="url(#fx-circuit-f)">${packets}</g></g>`,
    };
  },
};
