// Post-build sanity check for dist/. Run after `node build.mjs`.
//   - dist/index.html must exist                          (fail)
//   - every local src=/href= file must exist in dist/     (fail)
//   - every href="#id" must match an element id           (warn only: sections land in parallel PRs)
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..');
const DIST = join(ROOT, 'dist');
const INDEX = join(DIST, 'index.html');
const errors = [];
const warnings = [];

if (!existsSync(INDEX)) {
  console.error('FAIL dist/index.html not found. Run `node build.mjs` first.');
  process.exit(1);
}

function checkPage(file) {
  const html = readFileSync(file, 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => m.replace(/>[\s\S]*<\/script>$/i, '></script>')) // ignore inline JS bodies
    .replace(/<!--[\s\S]*?-->/g, '');
  const rel = file.slice(DIST.length + 1);
  const ids = new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]));

  for (const [, attr, raw] of html.matchAll(/\s(src|href)=["']([^"']*)["']/g)) {
    const url = raw.trim();
    if (!url || /^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(url)) continue;
    if (url.startsWith('#')) {
      const id = decodeURIComponent(url.slice(1));
      if (id && !ids.has(id)) warnings.push(`${rel}: ${attr}="${url}" has no matching id`);
      continue;
    }
    const path = decodeURIComponent(url.split(/[?#]/)[0]);
    // Root-absolute paths are served under the GitHub Pages project base (/pelagos/)
    const local = path.startsWith('/') ? path.replace(/^\/(pelagos\/)?/, '') : join(dirname(rel), path);
    const target = join(DIST, local || 'index.html');
    if (!existsSync(target) || (target.endsWith('/') && !existsSync(join(target, 'index.html')))) {
      errors.push(`${rel}: ${attr}="${url}" -> missing file dist/${local}`);
    }
  }
}

for (const page of ['index.html', '404.html']) {
  const f = join(DIST, page);
  if (existsSync(f)) checkPage(f);
}

// JSON-LD must parse
const index = readFileSync(INDEX, 'utf8');
for (const [, json] of index.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  try { JSON.parse(json); } catch (e) { errors.push(`index.html: invalid JSON-LD (${e.message})`); }
}

warnings.forEach((w) => console.warn('WARN ' + w));
errors.forEach((e) => console.error('FAIL ' + e));
console.log(`check: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
