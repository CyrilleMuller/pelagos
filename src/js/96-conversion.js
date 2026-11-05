/* 96 — Conversion helpers: newsletter signup, sticky CTAs, exit-intent dialog.
   No analytics: nothing is tracked or sent anywhere except an explicit form submit. */
(function () {
  'use strict';
  var PG = window.PG || {};
  var cfg = PG.config || {};
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var SS_KEY = 'pg-conv-exit-shown';

  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function svg(path) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>'; }

  /* ---------- Newsletter ---------- */
  function initNewsletter() {
    var form = $('#newsletter-form');
    if (!form) return;
    var input = $('#newsletter-email', form);
    var err = $('#newsletter-err', form);
    var success = $('#newsletter-success');
    var btn = $('.newsletter-submit', form);
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function setErr(msg) {
      err.textContent = msg;
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    input.addEventListener('input', function () { if (err.textContent && re.test(input.value.trim())) setErr(''); });

    function done() {
      form.hidden = true;
      success.hidden = false;
      success.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.trim();
      if (!re.test(email)) { setErr('Please enter a valid email address.'); input.focus(); return; }
      setErr('');
      var topics = Array.prototype.slice.call(form.querySelectorAll('input[name="topics"]:checked')).map(function (c) { return c.value; });
      var subject = 'Subscribe: Global Health Intelligence Notes';
      if (cfg.formEndpoint) {
        btn.disabled = true; btn.textContent = 'Subscribing…';
        fetch(cfg.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ _subject: subject, email: email, topics: topics.join(', '), source: 'newsletter' })
        }).then(function (r) {
          if (!r.ok) throw new Error('bad status');
          done();
        }).catch(function () {
          btn.disabled = false; btn.textContent = 'Subscribe';
          setErr('Sorry, that did not go through. Please try again or email ' + (cfg.email || 'us') + '.');
        });
      } else {
        var body = 'Please add me to Global Health Intelligence Notes.\n\nEmail: ' + email +
          (topics.length ? '\nTopics: ' + topics.join(', ') : '') + '\n';
        window.location.href = 'mailto:' + (cfg.email || '') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        done();
      }
    });
  }

  /* ---------- Sticky mobile bar + desktop pill ---------- */
  function initStickyCtas() {
    var bar = document.createElement('div');
    bar.className = 'conv-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Quick contact');
    bar.innerHTML =
      '<a class="btn btn--primary" href="#contact">' + svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>') + 'Book a consultation</a>' +
      '<a class="btn btn--ghost" href="mailto:' + (cfg.email || '') + '">' + svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>') + 'Email</a>';

    var pill = document.createElement('a');
    pill.className = 'btn btn--accent conv-pill';
    pill.href = '#contact';
    pill.innerHTML = svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>') + 'Book a call';

    document.body.appendChild(bar);
    document.body.appendChild(pill);

    // Keep the desktop pill above any back-to-top button.
    var backTop = $('.footer-top') || $('[class*="backtop"]') || $('[class*="back-to-top"]');
    var hero = document.getElementById('top') || $('.hero');
    var contact = document.getElementById('contact');
    var hasIO = 'IntersectionObserver' in window;
    var pastHero = false, contactVisible = false, ticking = false;

    function setVisible(el, on) {
      el.classList.toggle('is-visible', on);
      if (on) { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
      else { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
    }

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var y = window.pageYOffset || doc.scrollTop;
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      if (!hasIO || !hero) pastHero = y > window.innerHeight * 0.8;
      var showBar = pastHero && !contactVisible;
      var showPill = y / max > 0.4 && !contactVisible;
      setVisible(bar, showBar);
      setVisible(pill, showPill);
      document.body.classList.toggle('conv-bar-on', showBar && window.innerWidth < 768);
      if (backTop) {
        var r = backTop.getBoundingClientRect();
        var gap = window.innerHeight - r.top;
        pill.style.bottom = (r.height && gap > 0 ? Math.max(88, gap + 12) : 88) + 'px';
      }
    }
    function schedule() { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }

    if (hasIO) {
      if (hero) new IntersectionObserver(function (es) { pastHero = !es[0].isIntersecting; schedule(); }, { threshold: 0 }).observe(hero);
      if (contact) new IntersectionObserver(function (es) { contactVisible = es[0].isIntersecting; schedule(); }, { threshold: 0.05 }).observe(contact);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  }

  /* ---------- Exit-intent dialog (desktop only, once per session) ---------- */
  function initExitIntent() {
    var desktop = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
    if (!desktop.matches || ssGet(SS_KEY)) return;

    var formTouched = false;
    var contactForm = document.getElementById('contact-form');
    if (contactForm) {
      ['input', 'change', 'focusin', 'submit'].forEach(function (ev) {
        contactForm.addEventListener(ev, function () { formTouched = true; });
      });
    }

    var modal = document.createElement('div');
    modal.className = 'conv-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="conv-modal-backdrop" data-conv-close></div>' +
      '<div class="conv-modal-panel" role="dialog" aria-modal="true" aria-labelledby="conv-modal-title" aria-describedby="conv-modal-desc">' +
        '<button type="button" class="conv-modal-close" data-conv-close aria-label="Close">' + svg('<path d="M18 6 6 18M6 6l12 12"/>') + '</button>' +
        '<span class="eyebrow">Before you go</span>' +
        '<h2 id="conv-modal-title">Take something useful with you</h2>' +
        '<p id="conv-modal-desc">Try the free duty-of-care readiness check: a few quick questions that show where your program stands. Or browse the resources and publications.</p>' +
        '<div class="conv-modal-actions">' +
          '<a class="btn btn--primary" href="#assessment" data-conv-close>Start the free readiness check</a>' +
          '<a class="btn btn--ghost" href="#resources" data-conv-close>Browse resources</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // Graceful fallbacks if target sections are missing.
    if (!document.getElementById('resources') && document.getElementById('insights')) {
      modal.querySelector('a[href="#resources"]').setAttribute('href', '#insights');
    }
    if (!document.getElementById('assessment')) modal.querySelector('a[href="#assessment"]').setAttribute('href', '#contact');

    var panel = modal.querySelector('.conv-modal-panel');
    var lastFocus = null;

    function focusables() { return Array.prototype.slice.call(panel.querySelectorAll('a[href], button:not([disabled])')); }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        var f = focusables(); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    function open() {
      if (!modal.hidden || formTouched || ssGet(SS_KEY)) return;
      ssSet(SS_KEY, '1');
      document.documentElement.removeEventListener('mouseleave', onLeave);
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('conv-modal-open');
      document.addEventListener('keydown', onKey);
      var f = focusables(); (f[1] || f[0]).focus();
    }
    function close() {
      if (modal.hidden) return;
      modal.hidden = true;
      document.body.classList.remove('conv-modal-open');
      document.removeEventListener('keydown', onKey);
      if (lastFocus && lastFocus.focus && lastFocus !== document.body) lastFocus.focus({ preventScroll: true });
    }
    modal.addEventListener('click', function (e) {
      var t = e.target.closest('[data-conv-close]');
      if (!t) return;
      if (t.tagName === 'A') lastFocus = null; // let the link move focus/scroll
      close();
    });

    var armed = false;
    setTimeout(function () { armed = true; }, 8000); // never interrupt right on arrival
    function onLeave(e) {
      if (!armed || e.clientY > 10) return;
      open();
    }
    document.documentElement.addEventListener('mouseleave', onLeave);
    PG.convExitIntent = { open: open, close: close, arm: function () { armed = true; } };
  }

  function init() {
    initNewsletter();
    var on = function (f) { return !PG.feature || PG.feature(f); };
    if (on('stickyCta')) initStickyCtas();
    if (on('exitIntent')) initExitIntent();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
