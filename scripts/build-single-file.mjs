// Fold the Vite build (dist/) into ONE self-contained quickdraw.html — all JS and
// CSS inlined, no external requests — so it runs by double-clicking (file://), with
// no server, no npm, no dependencies. Dependency-free: uses only Node's fs.
//
// Usage: `npm run build:single` (runs `npm run build` first, then this script).

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const OUT = 'quickdraw.html';

let html = readFileSync(join(DIST, 'index.html'), 'utf8');

// Inline stylesheet(s): <link rel="stylesheet" href="/assets/x.css"> → <style>…</style>
html = html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g, (_m, href) => {
  const css = readFileSync(join(DIST, href.replace(/^\//, '')), 'utf8');
  return `<style>\n${css}\n</style>`;
});

// Drop modulepreload hints — they point at the script we're about to inline.
html = html.replace(/\s*<link\b[^>]*\brel="modulepreload"[^>]*>/g, '');

// Inline module script(s): <script type="module" src="/assets/x.js"></script> → inline.
html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (_m, src) => {
  const js = readFileSync(join(DIST, src.replace(/^\//, '')), 'utf8')
    .replace(/<\/script>/gi, '<\\/script>'); // never let bundled text close the tag early
  return `<script type="module">\n${js}\n</script>`;
});

if (/\bsrc="|\bhref="\/assets/.test(html)) {
  console.error('WARNING: quickdraw.html still references external assets — inlining missed something.');
  process.exit(1);
}

writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB) — double-click to run; no server, no npm.`);
