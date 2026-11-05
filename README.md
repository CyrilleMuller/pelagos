# Pelagos Global — Pascaline Wolfermann

Portfolio & services site for Pascaline Wolfermann, independent consultant in global healthcare
intelligence, aeromedical transport and duty-of-care programs (formerly Director, Global Solutions
Healthcare Intelligence at UnitedHealthcare Global).

Live (GitHub Pages): https://cyrillemuller.github.io/pelagos/

```bash
node build.mjs --serve   # build + preview on http://localhost:8080
node build.mjs           # build once into dist/
node scripts/check.mjs   # sanity-check dist/ (missing files fail, missing #anchors warn)
```

No dependencies, no framework: plain HTML, CSS and JavaScript assembled by a ~50-line Node script.

## Features

- **Single-page site** with hero, about, services (with detail modals), experience timeline, expertise,
  insights & publications, process, duty-of-care readiness assessment, FAQ and contact form.
- **Light / dark theme** that follows the system preference and remembers the visitor's choice.
- **Accessible**: semantic HTML, skip link, keyboard support, visible focus, `prefers-reduced-motion` respected.
- **Keyboard shortcuts**: press <kbd>?</kbd> for help, <kbd>g</kbd> <kbd>s</kbd> services,
  <kbd>g</kbd> <kbd>c</kbd> contact, <kbd>t</kbd> toggle theme.
- **Shareable deep links**: hover a section heading to copy a link to it.
- **SEO**: canonical URL, Open Graph / Twitter cards with a 1200×630 social image, JSON-LD
  (`Person` + `ProfessionalService`), `sitemap.xml`, `robots.txt`.
- **PWA basics**: web manifest, SVG favicon, Apple touch icon, light/dark `theme-color`.
- **Print-ready**: printing the page (or "Save as PDF") produces a clean CV-style document.
- **Custom 404 page** in the site palette.
- **CI**: every pull request builds the site and runs `scripts/check.mjs`; pushes to `main` deploy to Pages.

## Structure

```
build.mjs                 build script (src/ + public/ -> dist/), optional --serve
src/template.html         page shell: <head> (SEO meta, JSON-LD), placeholders for sections/styles/scripts
src/sections/NN-*.html    one file per page section, concatenated in filename order
src/css/NN-*.css          auto-linked in filename order (00-tokens.css = design tokens, 90-print.css = print)
src/js/NN-*.js            auto-included, deferred, in filename order (00-core.js exposes window.PG)
public/                   copied verbatim to dist/ (images, favicon, manifest, robots, sitemap, 404)
scripts/check.mjs         post-build checks used by CI
docs/CONTRIBUTING.md      conventions and file ownership
docs/profile-facts.md     content source of truth — do not invent facts
.github/workflows/        static.yml (deploy on main), check.yml (PR checks)
```

## Editing content

- **Text of a section**: edit the matching `src/sections/NN-name.html` file. Keep copy consistent with
  `docs/profile-facts.md`; never add invented clients, testimonials, numbers or credentials.
- **Contact details** (email, LinkedIn, location, time zone, booking link, form endpoint): edit `PG.config`
  at the top of `src/js/00-core.js`. It is the single source of truth used by every section.
- **Page title, description, social preview text, structured data**: edit the `<head>` of `src/template.html`.
- **Colors & typography**: edit the tokens in `src/css/00-tokens.css` (both light and dark blocks).
- **Photos**: replace `public/images/pascaline.jpg` (square, ~800×800).
  If the portrait changes, regenerate `public/images/og-image.png` (1200×630) too.
- Preview with `node build.mjs --serve`, then open a pull request; CI must pass before merging.

## Launch checklist

- [ ] Replace the placeholder email `hello@pelagos.global` in `src/js/00-core.js` (and anywhere it appears
      in `src/sections/`) with a real, monitored address.
- [ ] Set `formEndpoint` in `PG.config` (e.g. a Formspree URL); while empty, the contact form falls back to `mailto:`.
- [ ] Set `bookingUrl` if using a scheduling tool (Calendly, Cal.com…).
- [ ] Verify the languages listed (English / French / Spanish are inferred) and every role's years.
- [ ] Proof-read all section copy against LinkedIn; remove or confirm anything marked as illustrative.
- [ ] Custom domain: add a `public/CNAME` file with the domain, configure DNS (CNAME to
      `cyrillemuller.github.io`), enable HTTPS in repository Settings → Pages, then replace
      `https://cyrillemuller.github.io/pelagos/` in `src/template.html`, `public/robots.txt`,
      `public/sitemap.xml` and the `/pelagos/` paths in `public/404.html`.
- [ ] Test the social preview (LinkedIn Post Inspector, opengraph.xyz) and structured data
      (Google Rich Results Test) once live.
- [ ] Submit `sitemap.xml` in Google Search Console.
- [ ] Print the page / save as PDF and check the one-page CV layout.
