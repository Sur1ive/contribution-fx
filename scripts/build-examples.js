// Renders every theme with demo data into examples/, plus examples/preview.html
// which shows them all side by side on light and dark backgrounds.
// `node scripts/build-examples.js <theme>` renders one theme into examples/preview-<theme>.html.
import { mkdir, writeFile } from 'node:fs/promises';
import { demoCalendar } from '../src/core/calendar.js';
import { render } from '../src/render.js';
import { THEMES } from '../src/themes/index.js';

const only = process.argv[2];
const cal = demoCalendar('octocat');
// Showcase a few palettes in the README gallery.
const PALETTE = { ripple: 'ocean', fireworks: 'sunset' };
await mkdir('examples', { recursive: true });

const rows = [];
for (const name of Object.keys(THEMES)) {
  if (only && name !== only) continue;
  for (const mode of ['light', 'dark']) {
    const file = `${name}-${mode}.svg`;
    const svg = render(cal, { theme: name, mode, palette: PALETTE[name] ?? 'github' });
    await writeFile(`examples/${file}`, svg);
    console.log(`examples/${file}  ${(svg.length / 1024).toFixed(1)} KB`);
    rows.push(`<div class="${mode}"><h3>${name} · ${mode}</h3><img src="${file}"></div>`);
  }
}

await writeFile(`examples/preview${only ? `-${only}` : ''}.html`, `<!doctype html><meta charset="utf-8"><title>preview</title>
<style>body{margin:0;font:14px system-ui}div{padding:12px 20px}.light{background:#fff;color:#1f2328}.dark{background:#0d1117;color:#e6edf3}h3{margin:0 0 6px}</style>
${rows.join('\n')}`);
