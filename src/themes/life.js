import { n, rect } from '../core/svg.js';

// The graph seeds Conway's Game of Life on a torus. Newborn cells flash
// bright and fade as they age; after the run the real graph fades back in.

const INTRO = 1.5; // seconds showing the real graph
const STEP = 0.18; // seconds per generation
const MAX_GENS = 48;
const TRAIL = 3; // generations a dead cell takes to fade out
const MIN_RUN = 2.4; // short-lived boards still get this much screen time
const HOLD = 0.6; // pause on the final generation, must exceed TRAIL * STEP
const FADE = 1.2; // sweep back to the real graph
const BANDS = 8;
const BAND_FADE = 0.5;

/** One Life generation on a cols x rows torus. Cells are indexed x * rows + y. */
export function step(alive, cols, rows, exists) {
  const next = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const i = x * rows + y;
      if (exists && !exists[i]) continue;
      let c = 0;
      for (let dx = -1; dx <= 1; dx++) {
        const col = ((x + dx + cols) % cols) * rows;
        for (let dy = -1; dy <= 1; dy++) {
          if (dx || dy) c += alive[col + ((y + dy + rows) % rows)];
        }
      }
      next[i] = c === 3 || (c === 2 && alive[i]) ? 1 : 0;
    }
  }
  return next;
}

/**
 * Generations [seed, gen1, ...]. Stops when the board freezes or dies; an
 * oscillator is shown for a couple of periods before stopping.
 */
export function simulate(seed, cols, rows, exists, maxGens = MAX_GENS) {
  const gens = [seed];
  const seen = new Map([[seed.join(''), 0]]);
  let limit = maxGens;
  for (let g = 1; g <= limit; g++) {
    const next = step(gens[g - 1], cols, rows, exists);
    const key = next.join('');
    if (seen.has(key)) {
      const period = g - seen.get(key);
      if (period === 1) break;
      if (limit === maxGens) limit = Math.min(maxGens, g + Math.min(12, Math.max(6, period * 2)) - 1);
    } else {
      seen.set(key, g);
    }
    gens.push(next);
  }
  return gens;
}

// Fill level by age: newborn 4, then 3, then 2. Level 1 is reserved for the
// trails of dead cells.
const levelForAge = (age) => (age === 0 ? 4 : age === 1 ? 3 : 2);
const ageForLevel = [0, 2, 2, 1, 0];

export default {
  name: 'life',
  description: "Your contributions seed Conway's Game of Life, evolve, then reassemble.",

  render(ctx) {
    const { cal, colors } = ctx;
    const rows = 7;
    const cols = Math.max(1, cal.cols);
    const exists = new Uint8Array(cols * rows);
    const seed = new Uint8Array(cols * rows);
    const level0 = new Uint8Array(cols * rows);
    for (const d of cal.days) {
      const i = d.x * rows + d.y;
      exists[i] = 1;
      seed[i] = d.level > 0 ? 1 : 0;
      level0[i] = d.level;
    }

    const gens = simulate(seed, cols, rows, exists);
    const last = gens.length - 1;
    if (last === 0) {
      const body = cal.days.map((d) => {
        const p = ctx.pos(d.x, d.y);
        return rect(p.x, p.y, `class="l${d.level}"`);
      }).join('');
      return { style: '', body };
    }

    // Per-cell level for every generation.
    const seqs = Array.from({ length: cols * rows }, (_, i) => [level0[i]]);
    const age = Int16Array.from(level0, (l) => ageForLevel[l]);
    for (let g = 1; g <= last; g++) {
      const prev = gens[g - 1];
      const cur = gens[g];
      for (let i = 0; i < cur.length; i++) {
        if (!cur[i]) {
          seqs[i].push(0);
          continue;
        }
        age[i] = prev[i] ? age[i] + 1 : 0;
        seqs[i].push(levelForAge(age[i]));
      }
    }

    const run = Math.max(MIN_RUN, last * STEP + HOLD);
    const cycle = INTRO + run + FADE;
    const at = (t) => `${Math.round((t / cycle) * 1000) / 10}%`;
    const genStart = (g) => at(INTRO + (g - 1) * STEP);
    // The real graph is restored in a left-to-right sweep of column bands.
    const bandFade = (b) => {
      const start = INTRO + run + (b * (FADE - BAND_FADE)) / (BANDS - 1);
      return [at(start), b === BANDS - 1 ? null : at(start + BAND_FADE)];
    };

    const names = new Map();
    let style = '';
    const cells = [];
    for (const d of cal.days) {
      const i = d.x * rows + d.y;
      const seq = seqs[i];
      const p = ctx.pos(d.x, d.y);
      if (seq.every((l) => l === seq[0])) {
        cells.push(rect(p.x, p.y, `class="l${d.level}"`));
        continue;
      }
      const band = seq[last] === seq[0] ? -1 : Math.floor((d.x * BANDS) / cols);
      const key = `${seq.join('')}:${band}`;
      let name = names.get(key);
      if (!name) {
        name = `k${names.size.toString(36)}`;
        names.set(key, name);
        // Keyframe stops grouped by "level + easing"; linear segments are the
        // fading trails of dead cells and the final restore.
        const groups = new Map([[`${seq[0]}`, ['0%', '100%']]]);
        const add = (t, l, linear = false) => {
          const k = `${l}${linear ? 'l' : ''}`;
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(t);
        };
        for (let g = 1; g <= last; g++) {
          const l = seq[g];
          const prev = seq[g - 1];
          if (l) {
            if (l !== prev) add(genStart(g), l);
          } else if (prev) {
            const reborn = seq.slice(g + 1, g + TRAIL).some(Boolean);
            add(genStart(g), 1, !reborn);
            if (!reborn) add(genStart(g + TRAIL), 0);
          }
        }
        if (band >= 0) {
          const [start, end] = bandFade(band);
          add(start, seq[last], true);
          if (end) add(end, seq[0]);
        }
        let frames = '';
        for (const [k, list] of groups) {
          const linear = k.endsWith('l') ? ';animation-timing-function:linear' : '';
          frames += `${list.join(',')}{fill:${colors.levels[k[0]]}${linear}}`;
        }
        style += `@keyframes ${name}{${frames}}.${name}{animation-name:${name}}`;
      }
      cells.push(rect(p.x, p.y, `class="l${d.level} ${name}"`));
    }

    style = `.lf rect{animation-duration:${n(ctx.duration(cycle))}s;animation-timing-function:step-end;animation-iteration-count:infinite}${style}`;
    return { style, body: `<g class="lf">${cells.join('')}</g>` };
  },
};
