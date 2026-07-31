import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const requested = decodeURIComponent((req.url || '/').split('?')[0]);
  let safePath = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  if (safePath === '/' || safePath === '.') safePath = '/index.html';
  let filePath = join(root, safePath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(root, 'index.html');
  res.writeHead(200, {
    'content-type': mime[extname(filePath)] || 'application/octet-stream',
    'cache-control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=300',
    'cross-origin-opener-policy': 'same-origin',
    'x-content-type-options': 'nosniff'
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`Anarchadia Living Amendment Hall running at http://localhost:${port}`);
});
