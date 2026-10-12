import { PITCH, n, pct, rect } from '../core/svg.js';

// Every active day drops to the bottom of its week, bounces, rests,
// then floats back into place. Empty days stay behind as faint slots.

const CYCLE = 9; // seconds
// Timeline (percent of cycle)
const FALL_START = 18;
const LAND = 30;
const BOUNCE = 34;
const SETTLE = 38;
const RISE_START = 72;
const RISE_END = 88;

export default {
  name: 'gravity',
  description: 'Your contributions fall and stack up at the bottom of each week, then float back.',

  render(ctx) {
    const { cal, colors, rng } = ctx;
    const duration = ctx.duration(CYCLE);
    const byCol = new Map();
    for (const d of cal.days) {
      if (!byCol.has(d.x)) byCol.set(d.x, []);
      byCol.get(d.x).push(d);
    }

    const slots = [];
    const cells = [];
    const usedDrops = new Set();

    for (const [x, days] of byCol) {
      const active = days.filter((d) => d.level > 0).sort((a, b) => a.y - b.y);
      const colStagger = (x / Math.max(1, cal.cols - 1)) * 0.9;
      // The pile keeps the original top-to-bottom order of the week.
      const drops = new Map(active.map((d, i) => [d, 7 - active.length + i - d.y]));
      for (const d of days) {
        const p = ctx.pos(d.x, d.y);
        slots.push(rect(p.x, p.y, 'class="l0"'));
        if (d.level === 0) continue;
        const drop = drops.get(d);
        if (drop === 0) {
          cells.push(rect(p.x, p.y, `class="l${d.level}"`));
          continue;
        }
        usedDrops.add(drop);
        const delay = colStagger + rng() * 0.35;
        cells.push(rect(p.x, p.y, `class="l${d.level} g${drop}" style="animation-delay:${n(ctx.duration(delay))}s"`));
      }
    }

    let style = '';
    for (const drop of usedDrops) {
      const dy = drop * PITCH;
      const bounce = Math.min(5, dy * 0.18);
      style +=
        `@keyframes g${drop}{` +
        `0%,${pct(FALL_START)}{transform:translateY(0);animation-timing-function:cubic-bezier(.55,0,1,.45)}` +
        `${pct(LAND)}{transform:translateY(${n(dy)}px);animation-timing-function:cubic-bezier(0,.55,.45,1)}` +
        `${pct(BOUNCE)}{transform:translateY(${n(dy - bounce)}px);animation-timing-function:cubic-bezier(.55,0,1,.45)}` +
        `${pct(SETTLE)},${pct(RISE_START)}{transform:translateY(${n(dy)}px);animation-timing-function:cubic-bezier(.65,0,.35,1)}` +
        `${pct(RISE_END)},100%{transform:translateY(0)}}` +
        `.g${drop}{animation:g${drop} ${n(duration)}s infinite}`;
    }

    return {
      style,
      body: `<g>${slots.join('')}</g><g>${cells.join('')}</g>`,
    };
  },
};
