// A Calendar is the single data shape every theme consumes:
// { user, total, cols, rows: 7, days: [{ x, y, date, count, level }] }
// x = week column (0 = oldest), y = weekday (0 = Sunday), level = 0..4

import { createRng, hashString } from './random.js';

const LEVELS = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const DAY_MS = 86400000;

function utcDay(date) {
  return new Date(`${date}T00:00:00Z`);
}

function build(user, days) {
  const cols = days.reduce((m, d) => Math.max(m, d.x + 1), 0);
  const total = days.reduce((s, d) => s + d.count, 0);
  return { user, total, cols, rows: 7, days };
}

/** From the GitHub GraphQL `contributionCalendar` object. */
export function fromGraphQL(user, calendar) {
  const days = [];
  calendar.weeks.forEach((week, x) => {
    for (const d of week.contributionDays) {
      days.push({
        x,
        y: d.weekday,
        date: d.date,
        count: d.contributionCount,
        level: LEVELS[d.contributionLevel] ?? levelFromCount(d.contributionCount, 1),
      });
    }
  });
  return build(user, days);
}

/** From a flat, date-sorted list of { date, count, level? } (e.g. github-contributions-api). */
export function fromDailyList(user, list) {
  if (!list.length) return build(user, []);
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
  const start = utcDay(sorted[0].date);
  const offset = start.getUTCDay();
  const thresholds = quartiles(sorted.map((d) => d.count));
  const days = sorted.map((d) => {
    const i = Math.round((utcDay(d.date) - start) / DAY_MS) + offset;
    return {
      x: Math.floor(i / 7),
      y: i % 7,
      date: d.date,
      count: d.count,
      level: d.level ?? levelFromCount(d.count, thresholds),
    };
  });
  return build(user, days);
}

/** Upper bounds of levels 1..3, computed like GitHub: quartiles of the non-zero days. */
export function quartiles(counts) {
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (!active.length) return [1, 1, 1];
  const at = (p) => active[Math.min(active.length - 1, Math.floor(p * active.length))];
  return [at(0.25), at(0.5), at(0.75)];
}

/** `limit` is either the quartile thresholds or a single max count. */
export function levelFromCount(count, limit) {
  if (count <= 0) return 0;
  if (Array.isArray(limit)) {
    const i = limit.findIndex((t) => count <= t);
    return i === -1 ? 4 : i + 1;
  }
  if (limit <= 0) return 1;
  return Math.min(4, Math.max(1, Math.ceil((count / limit) * 4)));
}

/**
 * Deterministic, realistic-looking fake calendar. Used for previews,
 * examples and tests so nothing depends on the network.
 */
export function demoCalendar(user = 'octocat', { weeks = 53, seed } = {}) {
  const rng = createRng(seed ?? hashString(user));
  const end = Date.UTC(2026, 9, 10); // a Saturday, so the last column is full
  const totalDays = weeks * 7;
  const start = end - (totalDays - 1) * DAY_MS;
  const list = [];
  let streak = 0;
  let vacation = 0;
  for (let i = 0; i < totalDays; i++) {
    const t = start + i * DAY_MS;
    const date = new Date(t).toISOString().slice(0, 10);
    const weekday = new Date(t).getUTCDay();
    if (vacation > 0) {
      vacation--;
      list.push({ date, count: 0 });
      continue;
    }
    if (rng() < 0.012) vacation = 4 + Math.floor(rng() * 9);
    const trend = 0.35 + 0.65 * (i / totalDays);
    const weekend = weekday === 0 || weekday === 6 ? 0.35 : 1;
    streak = rng() < 0.85 ? streak + 1 : 0;
    const active = rng() < 0.25 + 0.6 * trend * weekend;
    const burst = rng() < 0.05 ? 3 + rng() * 4 : 1;
    const count = active ? Math.round((1 + rng() * 6 * trend + Math.min(streak, 10) * 0.3) * burst) : 0;
    list.push({ date, count });
  }
  return fromDailyList(user, list);
}
