# How the site is built

Zero-dependency static site. `node build.mjs` assembles `src/` into `dist/` (deployed to GitHub Pages
by `.github/workflows/static.yml`). Preview: `node build.mjs --serve` → http://localhost:8080.

- `src/template.html` — page shell (head, `<main>`). Placeholders: `<!-- @seo -->`, `<!-- @styles -->`,
  `<!-- @header -->`, `<!-- @sections -->`, `<!-- @footer -->`, `<!-- @scripts -->`, `{{year}}`.
- `src/sections/NN-name.html` — one file per page section, concatenated in filename order into `<main>`
  (except `*-nav.html`, rendered before `<main>` via `<!-- @header -->`, and `*-footer.html`, rendered after it via
  `<!-- @footer -->`).
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

## Content & toggles

`content/site.json` holds site-wide settings. You can edit it by hand or through the admin CMS (`public/admin/`). It is optional: if it is missing, the build includes every section in filename order and uses the defaults in `src/js/00-core.js`.

```json
{
  "config":   { "name": "…", "email": "…", "bookingUrl": "#contact", "formEndpoint": "" },
  "features": { "darkMode": true, "langSwitcher": true, "stickyCta": true, "exitIntent": true,
                "newsletter": true, "keyboardShortcuts": true, "scrollProgress": true,
                "suggestEdits": true, "commandPalette": true },
  "sections": [ { "file": "01-nav.html", "enabled": true } ]
}
```

- **`config`**: contact details and brand strings. These values override the defaults in `PG.config`.
- **`features`**: on/off switches, read in JS with `PG.feature('name')`. Each disabled feature adds the class `no-feature-<name>` to `<html>`, so CSS can hide related elements. With `darkMode: false`, the theme toggle is hidden and the site stays in light theme. `suggestEdits` and `commandPalette` are reserved for features that use the same check.
- **`sections`**: the order of sections on the page. The build skips entries with `enabled: false`. Any `src/sections/*.html` file that is not in the list is added at the end, enabled. The newsletter has no JS switch: turn it off by disabling `10d-newsletter.html`. The CSS and JS of a disabled section still load, which does no harm.
- **Preview override**: add `?features=-exitIntent,+newsletter` to the URL to turn features off (`-`) or on (`+`) for that page load only. Nothing is saved.

The build puts `config` and `features` inline as `window.PG_SITE`, and writes a copy of the whole file to `dist/site.json`.
