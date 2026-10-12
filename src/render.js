import { resolvePalette } from './core/palette.js';
import { createRng, hashString } from './core/random.js';
import { PAD, PITCH, escapeXml, gridSize, levelClasses, n } from './core/svg.js';
import { THEMES } from './themes/index.js';

export const DEFAULTS = {
  theme: 'gravity',
  palette: 'github',
  mode: 'light',
  speed: 1,
  background: '',
  label: false,
};

const LABEL_HEIGHT = 20;

/**
 * Render a calendar to an animated SVG string.
 * @param {object} cal   Calendar from src/core/calendar.js
 * @param {object} opts  { theme, palette, mode, speed, background, label }
 */
export function render(cal, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const theme = THEMES[o.theme];
  if (!theme) {
    throw new Error(`Unknown theme "${o.theme}". Available: ${Object.keys(THEMES).join(', ')}`);
  }
  const speed = Number(o.speed) > 0 ? Number(o.speed) : 1;
  const colors = resolvePalette(o.palette, o.mode);
  const grid = gridSize(cal.cols);
  const extraTop = theme.extraTop ?? 0;
  const extraBottom = theme.extraBottom ?? 0;
  const label = o.label === true || o.label === 'true';
  const width = grid.width + PAD * 2;
  const height = PAD * 2 + extraTop + grid.height + extraBottom + (label ? LABEL_HEIGHT : 0);

  const ctx = {
    cal,
    colors,
    mode: o.mode,
    rng: createRng(hashString(`${cal.user}:${o.theme}`)),
    width,
    height,
    origin: { x: PAD, y: PAD + extraTop },
    grid,
    /** Top-left pixel position of a day cell (or of any grid coordinate). */
    pos: (x, y) => ({ x: PAD + x * PITCH, y: PAD + extraTop + y * PITCH }),
    /** Scale a base duration (seconds) by the user's speed option. */
    duration: (seconds) => seconds / speed,
  };

  const { style = '', body = '' } = theme.render(ctx);

  const title = `${cal.user}'s contributions as "${theme.name}" — contribution-fx`;
  const bg = o.background
    ? `<rect width="100%" height="100%" fill="${escapeXml(o.background)}"/>`
    : '';
  const labelSvg = label
    ? `<text x="${PAD}" y="${n(height - PAD + 4)}" fill="${colors.text}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" font-size="11">${escapeXml(`@${cal.user} · ${cal.total.toLocaleString('en-US')} contributions in the last year`)}</text>`
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">`,
    `<title>${escapeXml(title)}</title>`,
    `<style>${levelClasses(colors)}${style}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>`,
    bg,
    body,
    labelSvg,
    '</svg>',
  ].join('');
}
