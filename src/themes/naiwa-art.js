import { n, pct } from '../core/svg.js';

// Shared drawing and timeline helpers for the 奶蛙 (Naiwa) themes. The figure
// is drawn front-on with its feet at (0, 0), about 61px tall.

export const SKIN = '#f7c843';
export const ARM = '#f1b92f';
export const BELLY = '#f2e7c9';
export const DARK = '#5d554b';
export const INK = '#2e2213';

export const UP = 'cubic-bezier(.3,.7,.5,1)';
export const DOWN = 'cubic-bezier(.5,0,.7,.3)';

export const pose = (r, sx, sy) => `transform:rotate(${n(r)}deg) scale(${n(sx)},${n(sy)})`;

export function timeline(cycle) {
  const p = (t) => pct((t / cycle) * 100);
  return {
    p,
    /** Keyframes from [seconds, css, easing?] stops; the ends hold the first/last value. */
    frames(name, stops) {
      const all = [...stops];
      if (all[0][0] > 0) all.unshift([0, all[0][1]]);
      if (all[all.length - 1][0] < cycle) all.push([cycle, all[all.length - 1][1]]);
      return `@keyframes ${name}{${all
        .map(([t, css, ease]) => `${p(t)}{${css}${ease ? `;animation-timing-function:${ease}` : ''}}`)
        .join('')}}`;
    },
    /** Opacity 1 inside [from, to], 0 outside (or the reverse). */
    shown(name, from, to, inside = true) {
      const a = inside ? 0 : 1;
      const b = 1 - a;
      return `@keyframes ${name}{0%,${p(from)}{opacity:${a}}${p(from + 0.02)},${p(to)}{opacity:${b}}${p(to + 0.02)},100%{opacity:${a}}}`;
    },
  };
}

export const gradient = (id) =>
  `<radialGradient id="${id}" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#ffe68f"/><stop offset=".55" stop-color="${SKIN}"/><stop offset="1" stop-color="#dfa021"/></radialGradient>`;

export const line = `fill="none" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round"`;

/** Legs, feet and the bean-shaped body. */
export const torso = (fill) =>
  `<rect x="-13" y="-16" width="8" height="14" rx="3.8" fill="${ARM}"/>` +
  `<rect x="5" y="-16" width="8" height="14" rx="3.8" fill="${ARM}"/>` +
  `<ellipse cx="-9.5" cy="-1.8" rx="6.5" ry="2.4" fill="${DARK}"/>` +
  `<ellipse cx="9.5" cy="-1.8" rx="6.5" ry="2.4" fill="${DARK}"/>` +
  `<path d="M0-61C7.5-61 10.5-56 11.5-48C17.5-44 22.5-34 22.5-23C22.5-13 14.5-10 0-10C-14.5-10-22.5-13-22.5-23C-22.5-34-17.5-44-11.5-48C-10.5-56-7.5-61 0-61Z" fill="url(#${fill})" stroke="#c48a12" stroke-width=".7"/>`;

export const belly = (attrs = '') => `<ellipse cx="0" cy="-23.5" rx="15" ry="12" fill="${BELLY}"${attrs ? ` ${attrs}` : ''}/>`;

export const armsDown = (cls) =>
  `<g class="${cls}"><path d="M-15-39Q-21-33-22.5-25M15-39Q21-33 22.5-25" fill="none" stroke="${ARM}" stroke-width="6.5" stroke-linecap="round"/>` +
  `<circle cx="-22.8" cy="-23.2" r="2.7" fill="${DARK}"/><circle cx="22.8" cy="-23.2" r="2.7" fill="${DARK}"/></g>`;

export const armsOnBelly = (cls) =>
  `<g class="${cls}"><path d="M-15-39Q-20-29-9-27M15-39Q20-29 9-27" fill="none" stroke="${ARM}" stroke-width="6.5" stroke-linecap="round"/>` +
  `<ellipse cx="-6.5" cy="-26.5" rx="3.8" ry="2.6" fill="${DARK}"/><ellipse cx="6.5" cy="-26.5" rx="3.8" ry="2.6" fill="${DARK}"/></g>`;

export const iris = (x) => `<circle cx="${x}" cy="-50.5" r="3.9" fill="#b9c690" stroke="#7d8b58" stroke-width=".4"/>`;

export const pupil = (x) =>
  `<circle cx="${n(x * 1.04)}" cy="-50.5" r="2" fill="#111"/>` +
  `<circle cx="${n(x * 1.04 + 0.8)}" cy="-51.4" r=".6" fill="#fff"/>`;

export const eye = (x) => iris(x) + pupil(x);

/** Squeezed-shut eyes, as in the belly laugh. */
export const closedEyes = `<path d="M-9-51Q-6-54-3-51M3-51Q6-54 9-51" ${line} stroke-width=".9"/>`;

export const laughMouth =
  `<path d="M-7-46Q0-48 7-46Q6-37 0-36.5Q-6-37-7-46Z" fill="#5a1c17"/>` +
  `<path d="M-6.3-45.7Q0-47.6 6.3-45.7L6-44.3Q0-46-6-44.3Z" fill="#fff"/>` +
  `<ellipse cx="0" cy="-38.6" rx="3.6" ry="1.6" fill="#d9605a"/>`;
