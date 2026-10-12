// Tiny static file server for local development: node scripts/serve.js [dir] [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const port = Number(process.argv[3] ?? 8787);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  try {
    let path = join(root, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!path.startsWith(root)) throw new Error('outside root');
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}/`));
