/* Hero: rotating specialty phrases (fade/slide), paused when off-screen or tab hidden. */
(function () {
  'use strict';
  var PG = window.PG || {};

  var PHRASES = [
    'Provider network intelligence',
    'Air ambulance & medical escort',
    'Duty of care programs',
    'Evacuation & repatriation planning',
    'Aeromedical accreditation readiness',
    'Ethics in cross-border patient transport'
  ];

  function init() {
    var el = PG.$ && PG.$('.hero-rotator-text');
    if (!el || PG.reducedMotion) return;
    var i = 0, timer = null, inView = true;

    function next() {
      el.classList.add('is-out');
      setTimeout(function () {
        i = (i + 1) % PHRASES.length;
        el.textContent = PHRASES[i];
        el.classList.remove('is-out');
        el.classList.add('is-in');
        // force reflow so the "in" start state applies before transitioning back
        void el.offsetWidth;
        el.classList.remove('is-in');
      }, 450);
    }
    function start() { if (!timer && inView && !document.hidden) timer = setInterval(next, 2800); }
    function stop() { clearInterval(timer); timer = null; }

    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        inView ? start() : stop();
      }).observe(el);
    }
    start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
