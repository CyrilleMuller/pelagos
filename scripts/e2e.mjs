// End-to-end smoke tests against the built site (file:// dist/). Run after `node build.mjs`.
//   node scripts/e2e.mjs
// Missing feature selectors are soft-skipped (WARN); page/console errors and broken behaviour FAIL.
// Failure screenshots land in dist/e2e-artifacts/.
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..');
const DIST = join(ROOT, 'dist');
const ART = join(DIST, 'e2e-artifacts');

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }

if (!existsSync(join(DIST, 'index.html'))) execFileSync(process.execPath, [join(ROOT, 'build.mjs')], { stdio: 'inherit' });
mkdirSync(ART, { recursive: true });

const results = []; // { ctx, name, status: PASS|WARN|FAIL, info }
const rec = (ctx, name, status, info = '') => { results.push({ ctx, name, status, info }); };
class Skip extends Error {}
const skip = (msg) => { throw new Skip(msg); };
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const url = (rel) => pathToFileURL(join(DIST, rel)).href;

const browser = await chromium.launch();

async function newPage(width, scheme) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return { context, page, errors };
}

async function step(ctx, page, name, fn) {
  try { await fn(); rec(ctx, name, 'PASS'); }
  catch (e) {
    if (e instanceof Skip) return rec(ctx, name, 'WARN', e.message);
    const file = `${ctx}-${name}`.replace(/[^a-z0-9]+/gi, '_') + '.png';
    try { await page.screenshot({ path: join(ART, file) }); } catch {}
    rec(ctx, name, 'FAIL', String(e.message || e).split('\n')[0].slice(0, 200));
  }
}
async function first(page, sel) { const l = page.locator(sel).first(); return (await l.count()) ? l : null; }
async function click(loc) {
  await loc.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
  try { await loc.click({ timeout: 1500 }); } catch { await loc.evaluate((el) => el.click()); }
}

async function homepage(width, scheme) {
  const ctx = `index@${width}/${scheme}`;
  const { context, page, errors } = await newPage(width, scheme);
  await page.goto(url('index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(300);

  await step(ctx, page, 'no horizontal overflow', async () => {
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    must(o.sw <= o.cw + 1, `scrollWidth ${o.sw} > clientWidth ${o.cw}`);
  });

  await step(ctx, page, 'nav href targets exist', async () => {
    const missing = await page.evaluate(() => [...document.querySelectorAll('nav a[href^="#"], header a[href^="#"]')]
      .map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(decodeURIComponent(h.slice(1)))));
    must(!missing.length, 'missing: ' + [...new Set(missing)].join(' '));
  });

  await step(ctx, page, 'theme toggle', async () => {
    const btn = await first(page, '.nav-theme, [data-theme-toggle]'); if (!btn) skip('no theme toggle');
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await click(btn);
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    must(after && after !== before, `data-theme ${before} -> ${after}`);
    await click(btn); // restore
  });

  await step(ctx, page, 'services filter', async () => {
    const chips = page.locator('.services-filter__chip[data-filter]');
    if ((await chips.count()) < 2) skip('no filter chips');
    const total = await page.locator('.services-card').count(); if (!total) skip('no .services-card');
    // Some audiences match every card, so try chips until one narrows the grid.
    let narrowed = false;
    for (let i = 1; i < (await chips.count()) && !narrowed; i++) {
      await click(chips.nth(i));
      await page.waitForTimeout(400);
      must((await chips.nth(i).getAttribute('aria-pressed')) === 'true', `chip ${i} not pressed`);
      const hidden = await page.locator('.services-card.is-hidden').count();
      must(hidden < total, `chip ${i} hid every card`);
      narrowed = hidden > 0;
    }
    must(narrowed, 'no filter chip hid any card');
    await click(chips.nth(0));
    await page.waitForTimeout(600);
    must((await page.locator('.services-card.is-hidden').count()) === 0, 'cards still hidden after "all"');
  });

  await step(ctx, page, 'services modal open/Esc', async () => {
    const more = await first(page, '.services-card:not(.is-hidden) .services-card__more'); if (!more) skip('no .services-card__more');
    await click(more);
    const dlg = page.locator('.services-dialog');
    await dlg.waitFor({ state: 'visible', timeout: 2000 });
    must(await dlg.evaluate((d) => d.open), 'dialog not open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    must(!(await dlg.evaluate((d) => d.open)), 'dialog still open after Escape');
  });

  await step(ctx, page, 'FAQ accordion', async () => {
    const btn = await first(page, '.faq-btn'); if (!btn) skip('no .faq-btn');
    const was = await btn.getAttribute('aria-expanded');
    await click(btn);
    await page.waitForTimeout(200);
    const now = await btn.getAttribute('aria-expanded');
    must(now !== was, `aria-expanded ${was} -> ${now}`);
  });

  await step(ctx, page, 'assessment + discuss', async () => {
    if (!(await first(page, '[data-assess]'))) skip('no [data-assess]');
    for (let i = 0; i < 40; i++) {
      if (await page.locator('[data-assess-results]').count()) break;
      const opt = page.locator('[data-assess] [data-assess-form] input[type=radio]').first();
      if (await opt.count()) await opt.evaluate((el) => el.click());
      const next = page.locator('[data-assess] [data-assess-next]').first();
      if (await next.count()) await click(next);
      await page.waitForTimeout(120);
    }
    must(await page.locator('[data-assess-results]').count(), 'results not visible after 40 steps');
    const discuss = await first(page, '[data-assess-discuss]'); if (!discuss) skip('no Discuss button');
    await click(discuss);
    await page.waitForTimeout(500);
    const msg = await page.locator('#contact-message').inputValue().catch(() => '');
    must(msg.trim().length > 0, '#contact-message empty after "Discuss my results"');
  });

  await step(ctx, page, 'planner updates', async () => {
    const out = await first(page, '[data-planner-output]'); if (!out) skip('no planner output');
    const before = await out.innerText();
    const range = await first(page, '#planner-headcount');
    if (range) await range.evaluate((el) => { el.value = String(el.value === el.max ? el.min : el.max); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
    const chip = await first(page, '.planner-chip input[type=checkbox]');
    if (chip) await chip.evaluate((el) => el.click());
    await page.waitForTimeout(400);
    must((await out.innerText()) !== before, 'planner output unchanged');
  });

  // Last: earlier steps fill the message field, so reload for a clean form.
  await step(ctx, page, 'contact validation', async () => {
    await page.reload({ waitUntil: 'load' });
    const form = await first(page, '#contact-form'); if (!form) skip('no #contact-form');
    await click(form.locator('[type=submit]').first());
    await page.waitForTimeout(300);
    const shown = await page.evaluate(() => [...document.querySelectorAll('#contact-form .contact-err, #contact-form [aria-invalid="true"]')]
      .filter((e) => e.getAttribute('aria-invalid') === 'true' || (e.textContent.trim() && e.offsetParent !== null)).length);
    must(shown > 0, 'no validation errors shown on empty submit');
  });

  await step(ctx, page, 'no page/console errors', async () => { must(!errors.length, errors.join(' | ')); });
  await context.close();
}

async function standalone(rel) {
  const { context, page, errors } = await newPage(1280, 'light');
  await step(rel, page, 'loads without errors', async () => {
    await page.goto(url(rel), { waitUntil: 'load' });
    await page.waitForTimeout(200);
    must((await page.locator('body').innerText()).trim().length > 0, 'empty body');
    must(!errors.length, errors.join(' | '));
  });
  await context.close();
}

for (const w of [1280, 390]) for (const s of ['light', 'dark']) await homepage(w, s);

const pages = ['cv.html', 'speaker.html', 'fr/index.html', 'es/index.html', 'de/index.html', '404.html'];
if (existsSync(join(DIST, 'resources'))) pages.push(...readdirSync(join(DIST, 'resources')).filter((f) => f.endsWith('.html')).map((f) => 'resources/' + f));
for (const d of ['admin', 'request']) if (existsSync(join(DIST, d, 'index.html'))) pages.push(d + '/index.html');
for (const p of pages) {
  if (existsSync(join(DIST, p))) await standalone(p);
  else rec(p, 'exists', 'FAIL', 'missing from dist');
}

await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log('\n' + pad('STATUS', 7) + pad('CONTEXT', 50) + pad('CHECK', 26) + 'INFO');
for (const r of results) console.log(pad(r.status, 7) + pad(r.ctx, 50) + pad(r.name, 26) + r.info);
const n = (s) => results.filter((r) => r.status === s).length;
console.log(`\n${n('PASS')} passed, ${n('WARN')} warnings, ${n('FAIL')} failed`);
if (n('FAIL')) { console.log(`Screenshots: ${ART}`); process.exit(1); }
