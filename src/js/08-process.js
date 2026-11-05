/* 08 — Process: draws the stepper's connecting line as the section scrolls into view. */
(function () {
  'use strict';
  var PG = window.PG || {};

  function init() {
    var stepper = PG.$ && PG.$('.process-stepper');
    if (!stepper) return;
    var steps = PG.$$('.process-step', stepper);
    var n = steps.length;

    function set(p) {
      stepper.style.setProperty('--process-p', p.toFixed(3));
      steps.forEach(function (s, i) {
        // Step i sits at i/(n-1) along the line
        s.classList.toggle('is-reached', p >= (n > 1 ? i / (n - 1) : 0) - 0.001);
      });
    }

    if (PG.reducedMotion || !('requestAnimationFrame' in window)) { set(1); return; }

    var ticking = false;
    function update() {
      ticking = false;
      var r = stepper.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      // 0 when the stepper top reaches 85% of the viewport, 1 when its bottom reaches 55%
      var start = vh * 0.85, end = vh * 0.55;
      var p = (start - r.top) / (start - end + r.height);
      set(Math.max(0, Math.min(1, p)));
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
