/* Shared helpers + site config. Loaded first (scripts are deferred, in filename order). */
(function () {
  'use strict';
  var PG = (window.PG = window.PG || {});

  // ---- Site config: defaults below; content/site.json overrides them (build injects window.PG_SITE) ----
  // TODO(Pascaline): replace placeholder contact details before launch (edit content/site.json).
  var SITE = window.PG_SITE || {};
  PG.config = Object.assign({
    name: 'Pascaline Wolfermann',
    brand: 'Pelagos Global',
    title: 'Global Healthcare Intelligence & Aeromedical Consultant',
    email: 'hello@pelagos.global',
    linkedin: 'https://www.linkedin.com/in/pascalinewolfermann/',
    location: 'United States · working worldwide',
    timezone: 'America/New_York',
    bookingUrl: '#contact',
    formEndpoint: '' // e.g. https://formspree.io/f/xxxx — empty = mailto fallback
  }, SITE.config);

  // ---- Feature toggles: content/site.json "features"; preview override ?features=-exitIntent,+newsletter ----
  PG.features = Object.assign({
    darkMode: true, langSwitcher: true, stickyCta: true, exitIntent: true, newsletter: true,
    keyboardShortcuts: true, scrollProgress: true, suggestEdits: true, commandPalette: true
  }, SITE.features);
  try {
    var fq = new URLSearchParams(location.search).get('features');
    if (fq) fq.split(',').forEach(function (t) {
      t = t.trim(); if (!t) return;
      var on = t.charAt(0) !== '-';
      PG.features[t.replace(/^[+-]/, '')] = on;
    });
  } catch (e) { /* URLSearchParams unavailable */ }
  /** PG.feature('exitIntent') -> boolean (unknown names default to true). */
  PG.feature = function (name) { return PG.features[name] !== false; };
  Object.keys(PG.features).forEach(function (k) {
    if (!PG.feature(k)) document.documentElement.classList.add('no-feature-' + k);
  });
  if (!PG.feature('darkMode')) document.documentElement.setAttribute('data-theme', 'light');

  PG.$ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  PG.$$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  PG.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Run fn when an element scrolls into view (once). */
  PG.onVisible = function (el, fn, opts) {
    if (!('IntersectionObserver' in window)) return fn(el);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } });
    }, opts || { threshold: 0.15 });
    io.observe(el);
  };

  /** Tiny toast notification: PG.toast('Copied!') */
  PG.toast = function (msg) {
    var t = document.createElement('div');
    t.className = 'pg-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2000;background:var(--c-text);color:var(--c-bg);padding:12px 18px;border-radius:999px;font:500 .95rem var(--font-sans);box-shadow:var(--shadow-lg);';
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 2200);
    setTimeout(function () { t.remove(); }, 2700);
  };

  // Scroll-reveal for any .reveal element
  document.addEventListener('DOMContentLoaded', function () {
    PG.$$('.reveal').forEach(function (el) {
      if (PG.reducedMotion) return el.classList.add('is-visible');
      PG.onVisible(el, function (n) { n.classList.add('is-visible'); });
    });
  });
})();
