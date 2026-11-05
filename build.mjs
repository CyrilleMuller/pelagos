// Zero-dependency build: assembles src/ into dist/.
//   node build.mjs          -> build once
//   node build.mjs --serve  -> build + serve on http://localhost:8080 (rebuilds on each request)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createServer } from 'node:http';

const ROOT = new URL('.', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const list = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : []);

export function build() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(join(ROOT, 'public'), DIST, { recursive: true });
  cpSync(join(SRC, 'css'), join(DIST, 'css'), { recursive: true });
  cpSync(join(SRC, 'js'), join(DIST, 'js'), { recursive: true });

  // content/site.json (optional): section order/toggles + config/features exposed as window.PG_SITE.
  const sitePath = join(ROOT, 'content', 'site.json');
  const site = existsSync(sitePath) ? JSON.parse(readFileSync(sitePath, 'utf8')) : null;
  let sectionFiles = list(join(SRC, 'sections'), '.html');
  if (site && Array.isArray(site.sections)) {
    const listed = site.sections.map((s) => s.file);
    sectionFiles = site.sections
      .filter((s) => s.enabled !== false && sectionFiles.includes(s.file)).map((s) => s.file)
      .concat(sectionFiles.filter((f) => !listed.includes(f))); // unlisted files: appended, enabled
    writeFileSync(join(DIST, 'site.json'), JSON.stringify(site, null, 2) + '\n');
  }
  const siteScript = site
    ? `<script>window.PG_SITE=${JSON.stringify({ config: site.config || {}, features: site.features || {} }).replace(/</g, '\\u003c')}</script>\n    `
    : '';

  const sections = sectionFiles
    .map((f) => `<!-- ${f} -->\n` + readFileSync(join(SRC, 'sections', f), 'utf8').trim())
    .join('\n\n');
  const styles = list(join(SRC, 'css'), '.css').map((f) => `<link rel="stylesheet" href="css/${f}">`).join('\n    ');
  const scripts = list(join(SRC, 'js'), '.js').map((f) => `<script src="js/${f}" defer></script>`).join('\n    ');

  const html = readFileSync(join(SRC, 'template.html'), 'utf8')
    .replace('<!-- @styles -->', styles)
    .replace('<!-- @scripts -->', () => siteScript + scripts)
    .replace('<!-- @sections -->', sections)
    .replaceAll('{{year}}', String(new Date().getFullYear()));
  writeFileSync(join(DIST, 'index.html'), html);
  return html;
}

build();
console.log('Built dist/index.html');

if (process.argv.includes('--serve')) {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.xml': 'application/xml',
    '.txt': 'text/plain', '.vcf': 'text/vcard', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
  createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    if (p === '/index.html') build();
    const file = join(DIST, p);
    if (!file.startsWith(DIST) || !existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  }).listen(8080, () => console.log('Serving http://localhost:8080'));
}
