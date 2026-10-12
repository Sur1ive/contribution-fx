// levels[0] is the empty-day color; levels[1..4] are the intensity steps.

export const PALETTES = {
  github: {
    light: { levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'], text: '#57606a', accent: '#2da44e' },
    dark: { levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'], text: '#8b949e', accent: '#39d353' },
  },
  ocean: {
    light: { levels: ['#ebedf0', '#b6e3ff', '#54aeff', '#0969da', '#0a3069'], text: '#57606a', accent: '#0969da' },
    dark: { levels: ['#161b22', '#0c2d6b', '#1158c7', '#388bfd', '#79c0ff'], text: '#8b949e', accent: '#58a6ff' },
  },
  sunset: {
    light: { levels: ['#ebedf0', '#ffd8b5', '#ffa657', '#f0663f', '#c4225b'], text: '#57606a', accent: '#f0663f' },
    dark: { levels: ['#161b22', '#5a1e2d', '#a8323e', '#f0663f', '#ffb86b'], text: '#8b949e', accent: '#ffa657' },
  },
  purple: {
    light: { levels: ['#ebedf0', '#e2d1ff', '#c297ff', '#8250df', '#512a97'], text: '#57606a', accent: '#8250df' },
    dark: { levels: ['#161b22', '#3c1e70', '#6e40c9', '#a371f7', '#d2a8ff'], text: '#8b949e', accent: '#bc8cff' },
  },
  halloween: {
    light: { levels: ['#ebedf0', '#ffee4a', '#ffc501', '#fe9600', '#03001c'], text: '#57606a', accent: '#fe9600' },
    dark: { levels: ['#161b22', '#631c03', '#bd561d', '#fa7a18', '#fddf68'], text: '#8b949e', accent: '#fa7a18' },
  },
};

export function resolvePalette(name = 'github', mode = 'light') {
  const palette = PALETTES[name];
  if (!palette) {
    throw new Error(`Unknown palette "${name}". Available: ${Object.keys(PALETTES).join(', ')}`);
  }
  const colors = palette[mode];
  if (!colors) throw new Error(`Unknown mode "${mode}". Use "light" or "dark".`);
  return { ...colors, empty: colors.levels[0] };
}
