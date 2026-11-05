/* Navigation: sticky state, scroll progress, scroll-spy, mobile menu, theme toggle, back-to-top, footer config. */
(function () {
  'use strict';
  var PG = window.PG || {};
  var $ = PG.$, $$ = PG.$$;

  function init() {
    var nav = $('#site-nav');
    if (!nav) return;
    var bar = $('.nav-progress-bar');
    var toggle = $('.nav-toggle', nav);
    var menu = $('#nav-menu');
    var themeBtn = $('.nav-theme', nav);
    var topBtn = $('.footer-top');
    var links = $$('.nav-link', nav);
    var mq = window.matchMedia('(max-width: 1080px)');

    // ---- Scroll: progress, shadow, back-to-top ----
    var ticking = false;
    function onScroll() {
      var y = window.scrollY || document.documentElement.scrollTop;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
      nav.classList.toggle('is-scrolled', y > 8);
      if (topBtn) topBtn.classList.toggle('is-visible', y > window.innerHeight * 0.9);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
    }, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    if (topBtn) {
      topBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: PG.reducedMotion ? 'auto' : 'smooth' });
        var brand = $('.nav-brand', nav);
        if (brand) brand.focus({ preventScroll: true });
      });
    }

    // ---- Scroll-spy ----
    var byId = {};
    links.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var sec = document.getElementById(id);
      if (sec) byId[id] = { link: a, el: sec };
    });
    function setActive(id) {
      links.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    }
    if ('IntersectionObserver' in window) {
      var visible = {};
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
        // Pick the last section (in document order) that is within the active band
        var current = null;
        Object.keys(byId).forEach(function (id) { if (visible[id]) current = id; });
        var heroVisible = visible.top;
        if (current) setActive(current);
        else if (heroVisible) setActive('');
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
      Object.keys(byId).forEach(function (id) { spy.observe(byId[id].el); });
      var hero = document.getElementById('top');
      if (hero) spy.observe(hero);
    }

    // ---- Mobile menu ----
    function isOpen() { return nav.classList.contains('is-open'); }
    function openMenu() {
      nav.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      var first = $('.nav-link', menu);
      if (first) setTimeout(function () { first.focus(); }, 30);
    }
    function closeMenu(returnFocus) {
      if (!isOpen()) return;
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      if (returnFocus) toggle.focus();
    }
    if (toggle && menu) {
      toggle.addEventListener('click', function () { isOpen() ? closeMenu(false) : openMenu(); });
      menu.addEventListener('click', function (e) {
        if (e.target.closest('a')) closeMenu(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen()) { e.preventDefault(); closeMenu(true); }
      });
      document.addEventListener('click', function (e) {
        if (isOpen() && !nav.contains(e.target)) closeMenu(false);
      });
      // Close when focus leaves the nav (e.g. tabbing past the last item)
      nav.addEventListener('focusout', function (e) {
        if (isOpen() && e.relatedTarget && !nav.contains(e.relatedTarget)) closeMenu(false);
      });
      var onMq = function () { if (!mq.matches) closeMenu(false); };
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    }

    // ---- Theme toggle ----
    var root = document.documentElement;
    function syncThemeBtn() {
      var dark = root.getAttribute('data-theme') === 'dark';
      if (!themeBtn) return;
      themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    }
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('pg-theme', next); } catch (e) { /* storage unavailable */ }
        syncThemeBtn();
      });
      syncThemeBtn();
    }

    // ---- Footer contact details from site config ----
    var cfg = PG.config || {};
    var email = $('.footer-email');
    if (email && cfg.email) {
      email.href = 'mailto:' + cfg.email;
      var t = $('.footer-email-text', email);
      if (t) t.textContent = cfg.email;
    }
    var li = $('.footer-linkedin');
    if (li && cfg.linkedin) li.href = cfg.linkedin;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
