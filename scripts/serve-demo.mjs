import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
// Explicit static allowlist, loopback only; never serves the workspace or dotfiles.
const files = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']], ['/core.js', ['core.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']], ['/LICENSE.txt', ['LICENSE.txt', 'text/plain']],
]);
const server = createServer(async (req, res) => {
  const file = files.get((req.url ?? '/').split('?')[0]);
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404).end('Not found'); return; }
  try {
    const bytes = await readFile(new URL(`../site/${file[0]}`, import.meta.url));
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(500).end('Run npm run demo:build first'); }
});
server.listen(4178, '127.0.0.1', () => console.log('Demo: http://127.0.0.1:4178'));
