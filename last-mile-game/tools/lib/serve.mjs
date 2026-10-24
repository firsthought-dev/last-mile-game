// Tiny static file server for tests. Serves `dir` under URL path `prefix`.
//   const s = await serve('/tmp/stage', { prefix: '/portal/sub/' });  s.url, await s.close()
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.glb': 'model/gltf-binary', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.gif': 'image/gif', '.png': 'image/png', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

export function serve(dir, { prefix = '/', port = 0 } = {}) {
  const root = path.resolve(dir);
  const pre = prefix.endsWith('/') ? prefix : prefix + '/';
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!u.startsWith(pre)) { res.writeHead(404); res.end('not found'); return; }
    let rel = u.slice(pre.length) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: p } = server.address();
      resolve({
        url: `http://127.0.0.1:${p}${pre}`,
        origin: `http://127.0.0.1:${p}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
