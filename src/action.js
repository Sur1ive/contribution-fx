// GitHub Action entry point. Zero dependencies: inputs come from INPUT_* env vars.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchCalendar } from './core/fetch.js';
import { parseOutputs } from './outputs.js';
import { render } from './render.js';

function input(name) {
  return (process.env[`INPUT_${name.toUpperCase()}`] ?? '').trim();
}

async function main() {
  const user = input('github_user_name') || process.env.GITHUB_REPOSITORY_OWNER;
  if (!user) throw new Error('Input "github_user_name" is required');
  const outputs = parseOutputs(input('outputs') || 'dist/contribution-fx.svg');

  console.log(`Fetching contributions for @${user}...`);
  const cal = await fetchCalendar(user, input('github_token'));
  console.log(`Found ${cal.total} contributions over ${cal.cols} weeks.`);

  for (const { file, options } of outputs) {
    const svg = render(cal, options);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, svg);
    console.log(`✓ ${file} (${(svg.length / 1024).toFixed(1)} KB)`);
  }
}

main().catch((err) => {
  console.log(`::error::${err.message}`);
  process.exit(1);
});
