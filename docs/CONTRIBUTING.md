# How the site is built

Zero-dependency static site. `node build.mjs` assembles `src/` into `dist/` (deployed to GitHub Pages
by `.github/workflows/static.yml`). Preview: `node build.mjs --serve` → http://localhost:8080.

- `src/template.html` — page shell (head, `<main>`). Placeholders: `<!-- @seo -->`, `<!-- @styles -->`,
  `<!-- @sections -->`, `<!-- @scripts -->`, `{{year}}`.
- `src/sections/NN-name.html` — one file per page section, concatenated in filename order into `<main>`.
- `src/css/NN-name.css` — auto-linked in filename order. `00-tokens.css` = design tokens + shared components.
- `src/js/NN-name.js` — auto-included (deferred, filename order). `00-core.js` exposes `window.PG`
  (`PG.config`, `PG.$`, `PG.$$`, `PG.onVisible`, `PG.toast`, `PG.reducedMotion`).
- `public/` — copied verbatim to `dist/` root (images, favicon, robots.txt, 404.html…).

## Rules
1. Only touch files you own (see table). Shared files (`00-*`, `template.html`, `build.mjs`) are owned by
   the scaffold; the SEO/infra owner may edit `template.html` `<head>` only.
2. Use the CSS variables in `00-tokens.css` — never hardcode colors; both `[data-theme=light|dark]` must work.
3. Prefix CSS classes with your section name (e.g. `.services-card`) to avoid collisions.
4. Wrap JS in an IIFE, `'use strict'`, no globals except under `window.PG`. No external JS libraries.
5. Accessible: semantic HTML, labels, keyboard support, `aria-*` where needed, respects reduced motion.
6. Responsive from 320px up. No horizontal scroll.
7. Content: follow `docs/profile-facts.md`. No invented testimonials, clients, numbers or credentials.
8. Inline SVG icons (stroke style, `class="icon"`), no icon fonts.

## Section ownership
| Files (src/sections, css, js) | Owner / feature |
|---|---|
| `01-nav`, `02-hero`, `99-footer` | Navigation, hero, footer, theme toggle, scroll progress, back-to-top |
| `03-about` | About story, at-a-glance counters, values, languages |
| `04-services`, `08-process` | Services with detail modals, engagement models, how-we-work |
| `05-experience`, `06-expertise` | Career timeline, expertise matrix, global-reach map |
| `07-insights`, `10-faq` | Publications, affiliations, speaking, media; FAQ accordion |
| `09-assessment` | Interactive duty-of-care readiness assessment |
| `11-contact` | Contact form, booking CTA, vCard, local time widget |
| head/SEO, `public/*` meta files, print CSS (`src/css/90-print.css`) | SEO, PWA manifest, 404, print one-pager |

Section `id`s (used by the nav): `top` (hero), `about`, `services`, `experience`, `expertise`, `insights`,
`process`, `assessment`, `faq`, `contact`.
