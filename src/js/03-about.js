/* 03 · About — count-up animation for the "At a glance" figures. */
(function () {
  'use strict';
  var PG = window.PG || {};

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animate(el) {
    var to = parseInt(el.getAttribute('data-count'), 10);
    var from = parseInt(el.getAttribute('data-from') || '0', 10);
    if (isNaN(to)) return;
    var duration = 1600;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      el.textContent = String(Math.round(from + (to - from) * easeOut(p)));
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  function init() {
    var section = document.getElementById('about');
    if (!section || PG.reducedMotion || !PG.onVisible || !window.requestAnimationFrame) return;
    var counters = Array.prototype.slice.call(section.querySelectorAll('.about-count'));
    counters.forEach(function (el) {
      // Final value stays in the HTML (no-JS / SEO); reset only when we can animate.
      el.textContent = el.getAttribute('data-from') || '0';
      PG.onVisible(el, animate, { threshold: 0.6 });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
