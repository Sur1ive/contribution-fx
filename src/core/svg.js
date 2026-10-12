export const CELL = 11;
export const GAP = 3;
export const PITCH = CELL + GAP;
export const RADIUS = 2;
export const PAD = 16;

/** Compact number formatting: max 2 decimals, no trailing zeros. */
export function n(value) {
  return String(Math.round(value * 100) / 100);
}

export function pct(value) {
  return `${n(Math.min(100, Math.max(0, value)))}%`;
}

export function escapeXml(str) {
  return String(str).replace(/[<>&"']/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[c]);
}

export function rect(x, y, attrs = '') {
  return `<rect x="${n(x)}" y="${n(y)}" width="${CELL}" height="${CELL}" rx="${RADIUS}"${attrs ? ` ${attrs}` : ''}/>`;
}

/** Shared CSS classes `.l0`..`.l4` so cells only carry a class name. */
export function levelClasses(colors) {
  return colors.levels.map((c, i) => `.l${i}{fill:${c}}`).join('');
}

export function gridSize(cols) {
  return { width: cols * PITCH - GAP, height: 7 * PITCH - GAP };
}
