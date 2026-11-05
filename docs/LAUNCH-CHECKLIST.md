# Launch checklist — things Pascaline must confirm or replace

Live preview: https://cyrillemuller.github.io/pelagos/

## Must replace
- [ ] **Email** `hello@pelagos.global` is a placeholder → `src/js/00-core.js` (`PG.config.email`),
      `public/pascaline-wolfermann.vcf`, `public/cv.html`, `public/speaker.html`, `public/fr|es|de/index.html`,
      `public/resources/*.html`. (`grep -rn "hello@pelagos.global" src public`)
- [ ] **Form endpoint** — `PG.config.formEndpoint` is empty, so contact + newsletter forms fall back to `mailto:`.
      Create a Formspree (or similar) form and paste its URL.
- [ ] **Booking link** — `PG.config.bookingUrl` is `#contact`; set a Calendly/Cal.com URL to enable direct booking.
- [ ] **Timezone / office hours** — `PG.config.timezone` (`America/New_York`) and weekday 9:00–18:00 in
      `src/js/11-contact.js` are assumptions.
- [ ] **Custom domain** — add `public/CNAME` and update canonical/OG URLs in `src/template.html`,
      `public/sitemap.xml`, `public/robots.txt`, translated pages.

## Must verify (inferred, not confirmed)
- [ ] Working **languages** (EN / FR / ES) — about, FAQ, CV, speaker kit, translated pages.
- [ ] Full **author list** for the 2025 *Air Medical Journal* paper — citation in `src/sections/07-insights.html`.
- [ ] **Depth ratings** (1–5 dots) in `src/sections/06-expertise.html` are editorial judgement.
- [ ] Derived figures: "30+ years" (since 1993), "22 years at FrontierMEDEX/UnitedHealth", "13 years Director",
      "6 years EURAMI board".
- [ ] Speaker kit booking terms (lead time, AV, fees note) in `public/speaker.html`.
- [ ] Translated pages (FR/ES/DE) — native-speaker review recommended.

## Already accurate (from LinkedIn)
Career titles/dates in `docs/profile-facts.md` → used across timeline, CV, JSON-LD, translations.
