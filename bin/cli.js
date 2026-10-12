#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { demoCalendar } from '../src/core/calendar.js';
import { fetchCalendar } from '../src/core/fetch.js';
import { PALETTES } from '../src/core/palette.js';
import { render } from '../src/render.js';
import { THEMES } from '../src/themes/index.js';

const HELP = `contribution-fx — animated SVG art from your GitHub contribution graph

Usage:
  contribution-fx --user <login> [options]

Options:
  -u, --user <login>     GitHub username
  -t, --theme <name>     ${Object.keys(THEMES).join(' | ')}  (default: gravity)
  -p, --palette <name>   ${Object.keys(PALETTES).join(' | ')}  (default: github)
  -m, --mode <mode>      light | dark  (default: light)
  -s, --speed <number>   animation speed multiplier  (default: 1)
  -b, --background <c>   background color, e.g. "#0d1117"  (default: transparent)
  -l, --label            add "@user · N contributions" caption
  -o, --out <file>       output file  (default: stdout)
      --demo             use generated demo data instead of fetching
  -h, --help             show this help

GITHUB_TOKEN is used if set; otherwise a public, token-free API is used.`;

const { values } = parseArgs({
  options: {
    user: { type: 'string', short: 'u' },
    theme: { type: 'string', short: 't', default: 'gravity' },
    palette: { type: 'string', short: 'p', default: 'github' },
    mode: { type: 'string', short: 'm', default: 'light' },
    speed: { type: 'string', short: 's', default: '1' },
    background: { type: 'string', short: 'b', default: '' },
    label: { type: 'boolean', short: 'l', default: false },
    out: { type: 'string', short: 'o' },
    demo: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help || (!values.user && !values.demo)) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

try {
  const cal = values.demo
    ? demoCalendar(values.user || 'octocat')
    : await fetchCalendar(values.user, process.env.GITHUB_TOKEN);
  const svg = render(cal, values);
  if (values.out) {
    await mkdir(dirname(values.out), { recursive: true });
    await writeFile(values.out, svg);
    console.error(`✓ ${values.out} (${(svg.length / 1024).toFixed(1)} KB)`);
  } else {
    process.stdout.write(svg);
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
