/* 05 — Experience: expandable entries, category filter, scroll-filled timeline line. */
(function () {
  'use strict';
  var PG = window.PG || {};
  var $ = PG.$ || function (s, c) { return (c || document).querySelector(s); };
  var $$ = PG.$$ || function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function init() {
    var root = document.getElementById('experience');
    if (!root) return;
    var track = $('.experience-track', root);
    var fill = $('.experience-line-fill', root);
    var items = $$('.experience-item', root);
    var status = $('#experience-status', root);

    // ---- Expand / collapse ----
    $$('.experience-toggle', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        var open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        $('.experience-toggle-label', btn).textContent = open ? 'Show less' : 'Read more';
        panel.hidden = !open;
        btn.closest('.experience-item').classList.toggle('is-open', open);
        if (open && !PG.reducedMotion) {
          panel.classList.remove('is-entering');
          void panel.offsetWidth;
          panel.classList.add('is-entering');
        }
        update();
      });
    });

    // ---- Filters ----
    var filters = $$('.experience-filter', root);
    filters.forEach(function (f) {
      f.addEventListener('click', function () {
        var key = f.getAttribute('data-filter');
        filters.forEach(function (o) { o.setAttribute('aria-pressed', String(o === f)); });
        var shown = 0;
        items.forEach(function (it) {
          var cats = (it.getAttribute('data-cat') || '').split(' ');
          var show = key === 'all' || cats.indexOf(key) !== -1;
          it.hidden = !show;
          if (show) { shown++; it.classList.add('is-visible'); }
        });
        if (status) status.textContent = 'Showing ' + shown + ' of ' + items.length + ' timeline entries.';
        update();
      });
    });

    // ---- Scroll progress on the line + active dots ----
    var ticking = false;
    function update() {
      ticking = false;
      if (!track) return;
      var r = track.getBoundingClientRect();
      var anchor = window.innerHeight * 0.6;
      var p = r.height ? (anchor - r.top) / r.height : 0;
      p = Math.max(0, Math.min(1, p));
      if (fill) fill.style.setProperty('--exp-progress', p.toFixed(4));
      items.forEach(function (it) {
        if (it.hidden) return;
        var dot = $('.experience-dot', it);
        var top = dot ? dot.getBoundingClientRect().top : it.getBoundingClientRect().top;
        it.classList.toggle('is-active', top < anchor);
      });
    }
    function onScroll() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
