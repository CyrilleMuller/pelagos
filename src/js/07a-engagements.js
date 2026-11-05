/* 07a-engagements: illustrative scenarios carousel (buttons, dots, swipe, arrow keys, gentle autoplay). */
(function () {
  'use strict';
  var PG = window.PG || {};
  var $ = PG.$ || function (s, c) { return (c || document).querySelector(s); };
  var $$ = PG.$$ || function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var INTERVAL = 9000;

  function init() {
    var root = $('[data-eng]');
    if (!root) return;
    var track = $('[data-eng-track]', root);
    var viewport = $('[data-eng-viewport]', root);
    var slides = $$('.eng-slide', track);
    var dotsWrap = $('[data-eng-dots]', root);
    var prevBtn = $('[data-eng-prev]', root);
    var nextBtn = $('[data-eng-next]', root);
    var toggle = $('[data-eng-toggle]', root);
    if (!track || !slides.length) return;

    var n = slides.length;
    var index = 0;
    var timer = null;
    var userPaused = !!PG.reducedMotion; // never autoplay with reduced motion
    var hoverPaused = false;
    var focusPaused = false;
    var inView = false;

    // ---- Dots ----
    var dots = slides.map(function (slide, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'eng-dot';
      var name = $('.eng-client', slide);
      b.setAttribute('aria-label', 'Scenario ' + (i + 1) + ': ' + (name ? name.textContent.trim() : ''));
      b.addEventListener('click', function () { go(i, true); });
      dotsWrap.appendChild(b);
      return b;
    });

    function setInert(el, on) {
      el.setAttribute('aria-hidden', on ? 'true' : 'false');
      if ('inert' in el) el.inert = on;
      else $$('a, button, input, select, textarea, [tabindex]', el).forEach(function (f) {
        if (on) f.setAttribute('tabindex', '-1'); else f.removeAttribute('tabindex');
      });
    }

    function render() {
      track.style.transform = 'translateX(' + (-index * 100) + '%)';
      slides.forEach(function (s, i) { setInert(s, i !== index); });
      dots.forEach(function (d, i) {
        if (i === index) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
    }

    function go(i, fromUser) {
      index = (i + n) % n;
      render();
      if (fromUser) restart();
    }

    // ---- Autoplay ----
    function running() { return !userPaused && !hoverPaused && !focusPaused && inView && !document.hidden; }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() {
      stop();
      track.setAttribute('aria-live', userPaused ? 'polite' : 'off');
      if (running()) timer = setInterval(function () { go(index + 1); }, INTERVAL);
    }
    function syncToggle() {
      toggle.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
      toggle.setAttribute('aria-label', userPaused ? 'Start automatic rotation' : 'Pause automatic rotation');
    }

    if (!PG.reducedMotion) {
      toggle.hidden = false;
      toggle.addEventListener('click', function () { userPaused = !userPaused; syncToggle(); restart(); });
      syncToggle();
    }

    prevBtn.addEventListener('click', function () { go(index - 1, true); });
    nextBtn.addEventListener('click', function () { go(index + 1, true); });

    root.addEventListener('mouseenter', function () { hoverPaused = true; restart(); });
    root.addEventListener('mouseleave', function () { hoverPaused = false; restart(); });
    root.addEventListener('focusin', function () { focusPaused = true; restart(); });
    root.addEventListener('focusout', function (e) {
      if (!root.contains(e.relatedTarget)) { focusPaused = false; restart(); }
    });
    document.addEventListener('visibilitychange', restart);

    // ---- Keyboard ----
    root.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      var handled = true;
      if (e.key === 'ArrowLeft') go(index - 1, true);
      else if (e.key === 'ArrowRight') go(index + 1, true);
      else if (e.key === 'Home') go(0, true);
      else if (e.key === 'End') go(n - 1, true);
      else handled = false;
      if (handled) {
        e.preventDefault();
        if (t && t.classList && t.classList.contains('eng-dot')) dots[index].focus();
      }
    });

    // ---- Swipe (pointer events, horizontal only) ----
    var startX = 0, startY = 0, dx = 0, dragging = false, decided = false, horizontal = false;
    viewport.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('button, a')) return;
      dragging = true; decided = false; horizontal = false; dx = 0;
      startX = e.clientX; startY = e.clientY;
    });
    viewport.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var mx = e.clientX - startX, my = e.clientY - startY;
      if (!decided && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
        decided = true; horizontal = Math.abs(mx) > Math.abs(my);
        if (horizontal) { track.classList.add('is-dragging'); try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* noop */ } }
        else dragging = false;
      }
      if (horizontal) {
        var w = viewport.clientWidth || 1;
        dx = Math.max(-w, Math.min(w, mx));
        track.style.transform = 'translateX(calc(' + (-index * 100) + '% + ' + dx + 'px))';
      }
    });
    function endDrag() {
      if (!dragging && !horizontal) return;
      dragging = false;
      track.classList.remove('is-dragging');
      if (horizontal) {
        var threshold = Math.min(80, viewport.clientWidth * 0.18);
        if (dx < -threshold) go(index + 1, true);
        else if (dx > threshold) go(index - 1, true);
        else render();
      }
      horizontal = false;
    }
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    // ---- CTA: preselect service in the contact form ----
    slides.forEach(function (slide) {
      var cta = $('[data-eng-cta]', slide);
      if (!cta) return;
      cta.addEventListener('click', function () {
        var service = slide.getAttribute('data-service') || '';
        document.dispatchEvent(new CustomEvent('pg:select-service', { detail: { service: service } }));
        var contact = document.getElementById('contact');
        if (contact) contact.scrollIntoView({ behavior: PG.reducedMotion ? 'auto' : 'smooth', block: 'start' });
        else location.hash = '#contact';
      });
    });

    // ---- Start ----
    root.classList.add('is-ready');
    viewport.scrollLeft = 0;
    render();
    var onView = function (visible) { inView = visible; restart(); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { onView(en.isIntersecting); });
      }, { threshold: 0.35 }).observe(root);
    } else onView(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
