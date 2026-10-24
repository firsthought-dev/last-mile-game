// Fails when a staged build references anything outside its own folder.
//   node tools/check-no-cdn.mjs <dir> [--allow <host>]...
//   node tools/check-no-cdn.mjs --self-test
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const IGNORED_HOSTS = ['www.w3.org', 'w3.org'];
const URL_RE = /https?:\/\/[^\s'"`)<>\\]+/g;

// Text files to scan, with the kind of reference that makes a URL "loaded".
function loadedUrls(file, text) {
  const ext = path.extname(file);
  const hits = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const urls = line.match(URL_RE) || [];
    for (const url of urls) {
      let loaded = false;
      if (ext === '.html') {
        // src=, <link href=>, and URLs inside document.write strings; not <a href>.
        const idx = line.indexOf(url);
        const before = line.slice(0, idx);
        loaded = /\bsrc\s*=\s*["']?$/.test(before)
          || (/<link\b[^>]*\bhref\s*=\s*["']?$/.test(before))
          || /document\.write\s*\(/.test(line)
          || /import\s*\(?\s*["']?$/.test(before);
      } else if (ext === '.css') {
        loaded = /url\(\s*["']?$/.test(line.slice(0, line.indexOf(url))) || /@import\s+["']?$/.test(line.slice(0, line.indexOf(url)));
      } else if (ext === '.js') {
        const before = line.slice(0, line.indexOf(url));
        loaded = /(\.src|\.href)\s*=\s*["'`]$/.test(before)
          || /\b(fetch|importScripts|import|open|write)\s*\(\s*(["'`]|[^)]*,\s*["'`])$/.test(before)
          || /\bsrc\s*=\s*["']?$/.test(before);
      }
      if (loaded) hits.push({ line: i + 1, url });
    }
  });
  return hits;
}

export function scan(dir, allow = []) {
  const findings = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      if (!/\.(html|css|js)$/.test(name)) continue;
      const text = fs.readFileSync(p, 'utf8');
      for (const h of loadedUrls(p, text)) {
        let host = '';
        try { host = new URL(h.url).host; } catch { /* keep empty */ }
        if (IGNORED_HOSTS.includes(host) || allow.includes(host)) continue;
        findings.push({ file: path.relative(dir, p), ...h });
      }
    }
  };
  walk(dir);
  return findings;
}

function selfTest() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nocdn-'));
  const w = (n, t) => fs.writeFileSync(path.join(d, n), t);
  w('bad.html', '<script src="https://unpkg.com/x.js"></script>\n<link href="https://fonts.googleapis.com/css" rel="stylesheet">\n<script>document.write(\'<script src="https://cdn.jsdelivr.net/y.js"><\\/script>\')</script>\n');
  w('bad.css', '@import "https://x.example/a.css";\nbody{background:url(https://y.example/i.png)}\n');
  w('bad.js', 'const s=document.createElement("script");s.src="https://z.example/s.js";\nfetch("https://api.example/d");\n');
  w('ok.html', '<a href="https://example.com/docs">docs</a>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>\n<script src="vendor/three.js"></script>\n');
  w('ok.js', '// see https://example.com/readme\nconst label = "https://example.com";\n');
  w('sdk.html', '<script src="https://game-cdn.poki.com/sdk.js"></script>\n');
  const files = (f) => [...new Set(f.map((x) => x.file))].sort().join(',');
  const all = scan(d);
  const expect = 'bad.css,bad.html,bad.js,sdk.html';
  if (files(all) !== expect) throw new Error(`self-test: expected ${expect}, got ${files(all)}`);
  const htmlHits = all.filter((x) => x.file === 'bad.html').length;
  if (htmlHits !== 3) throw new Error(`self-test: expected 3 hits in bad.html, got ${htmlHits}`);
  const allowed = scan(d, ['game-cdn.poki.com']);
  if (files(allowed) !== 'bad.css,bad.html,bad.js') throw new Error(`self-test: --allow failed: ${files(allowed)}`);
  console.log('check-no-cdn self-test OK');
}

const args = process.argv.slice(2);
if (args[0] === '--self-test') {
  selfTest();
} else {
  const allow = [];
  let dir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--allow') allow.push(args[++i]);
    else dir = args[i];
  }
  if (!dir) { console.error('usage: check-no-cdn.mjs <dir> [--allow <host>]... | --self-test'); process.exit(2); }
  const f = scan(dir, allow);
  if (f.length) {
    for (const x of f) console.error(`${x.file}:${x.line} ${x.url}`);
    console.error(`check-no-cdn FAIL: ${f.length} external reference(s)`);
    process.exit(1);
  }
  console.log(`check-no-cdn OK: ${dir}`);
}
