// Assembles the GitHub Pages site into _site/: the playground from site/
// plus the renderer from src/, which runs unmodified in the browser.
import { cp, mkdir, rm } from 'node:fs/promises';

await rm('_site', { recursive: true, force: true });
await mkdir('_site', { recursive: true });
await cp('site', '_site', { recursive: true });
await cp('src', '_site/src', { recursive: true });
await cp('examples', '_site/examples', { recursive: true });
console.log('Built _site/');
