/* Progressive enhancements: keyboard shortcuts dialog, copy-heading-anchor links,
   console greeting, print footer note. Respects prefers-reduced-motion. */
(function () {
  'use strict';
  var PG = (window.PG = window.PG || {});
  var doc = document;
  var root = doc.documentElement;
  var reduced = !!PG.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ICON_LINK = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>';
  var ICON_X = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function toast(msg) { if (typeof PG.toast === 'function') PG.toast(msg); }

  function scrollToId(id) {
    var el = doc.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    return true;
  }

  // ---- Theme toggle (shared contract: html[data-theme] + localStorage 'pg-theme') ----
  PG.toggleTheme = PG.toggleTheme || function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('pg-theme', next); } catch (e) {}
    doc.dispatchEvent(new CustomEvent('pg:themechange', { detail: { theme: next } }));
    return next;
  };

  // ---- Shortcuts dialog ----
  var dialog;
  var lastFocus;
  function buildDialog() {
    dialog = doc.createElement('dialog');
    dialog.className = 'pg-kbd';
    dialog.setAttribute('aria-labelledby', 'pg-kbd-title');
    dialog.innerHTML =
      '<div class="pg-kbd-head"><h2 id="pg-kbd-title">Keyboard shortcuts</h2>' +
      '<button type="button" class="pg-kbd-close" aria-label="Close shortcuts">' + ICON_X + '</button></div>' +
      '<ul class="pg-kbd-list">' +
      '<li><span>Show this help</span><span class="pg-kbd-keys"><kbd>?</kbd></span></li>' +
      '<li><span>Go to services</span><span class="pg-kbd-keys"><kbd>g</kbd> then <kbd>s</kbd></span></li>' +
      '<li><span>Go to contact</span><span class="pg-kbd-keys"><kbd>g</kbd> then <kbd>c</kbd></span></li>' +
      '<li><span>Back to top</span><span class="pg-kbd-keys"><kbd>g</kbd> then <kbd>t</kbd></span></li>' +
      '<li><span>Toggle light / dark theme</span><span class="pg-kbd-keys"><kbd>t</kbd></span></li>' +
      '<li><span>Close dialog</span><span class="pg-kbd-keys"><kbd>Esc</kbd></span></li>' +
      '</ul><p class="pg-kbd-foot">Shortcuts are ignored while typing in a form field.</p>';
    doc.body.appendChild(dialog);
    dialog.querySelector('.pg-kbd-close').addEventListener('click', closeDialog);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDialog(); }); // backdrop
    dialog.addEventListener('close', function () { if (lastFocus && lastFocus.focus) lastFocus.focus(); });
  }
  function openDialog() {
    if (!dialog) buildDialog();
    if (dialog.open) return;
    lastFocus = doc.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.querySelector('.pg-kbd-close').focus();
  }
  function closeDialog() {
    if (!dialog || !dialog.open) return;
    if (typeof dialog.close === 'function') dialog.close();
    else { dialog.removeAttribute('open'); if (lastFocus) lastFocus.focus(); }
  }
  PG.shortcuts = { open: openDialog, close: closeDialog };

  function isTyping(t) {
    if (!t || !t.tagName) return false;
    return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  }

  var pendingG = false;
  var gTimer;
  doc.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    var k = e.key;
    if (dialog && dialog.open) { if (k === '?') { e.preventDefault(); closeDialog(); } return; }
    // Another modal (e.g. a service detail) is open: stay out of its way
    if (doc.querySelector('dialog[open]:not(.pg-kbd), [aria-modal="true"]:not([hidden])')) return;

    if (pendingG) {
      pendingG = false; clearTimeout(gTimer);
      var target = { s: 'services', c: 'contact', t: 'top' }[k.toLowerCase()];
      if (target) { e.preventDefault(); if (!scrollToId(target) && target === 'top') window.scrollTo(0, 0); }
      return;
    }
    if (k === '?') { e.preventDefault(); openDialog(); }
    else if (k === 'g' || k === 'G') { pendingG = true; gTimer = setTimeout(function () { pendingG = false; }, 1200); }
    else if (k === 't' || k === 'T') { e.preventDefault(); var th = PG.toggleTheme(); toast((th === 'dark' ? 'Dark' : 'Light') + ' theme'); }
  });

  // ---- Copy-heading-anchor links on section h2s ----
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy') ? resolve() : reject(new Error('copy failed')); } catch (err) { reject(err); }
      ta.remove();
    });
  }
  function addAnchors() {
    PG.$$('main section[id] h2').forEach(function (h2) {
      var section = h2.closest('section[id]');
      if (!section || section.id === 'top' || h2.querySelector('.pg-anchor')) return;
      var id = section.id;
      var label = (h2.textContent || id).trim();
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'pg-anchor';
      btn.setAttribute('aria-label', 'Copy link to section: ' + label);
      btn.title = 'Copy link to this section';
      btn.innerHTML = ICON_LINK;
      btn.addEventListener('click', function () {
        var url = location.href.split('#')[0] + '#' + id;
        copyText(url).then(function () { toast('Link copied'); }, function () { toast(url); });
        if (history.replaceState) history.replaceState(null, '', '#' + id);
      });
      h2.classList.add('pg-anchor-host');
      h2.appendChild(btn);
    });
  }

  // ---- Print footer note (only visible in print) ----
  function addPrintNote() {
    if (PG.$('.pg-print-note')) return;
    var c = PG.config || {};
    var p = doc.createElement('p');
    p.className = 'pg-print-note';
    p.setAttribute('aria-hidden', 'true');
    p.textContent = [c.name, c.brand, c.email, location.href.split('#')[0]].filter(Boolean).join('  ·  ');
    doc.body.appendChild(p);
  }

  // ---- Console greeting ----
  function greet() {
    try {
      var c = PG.config || {};
      var big = 'font:600 18px Georgia,serif;color:#0e8a8f';
      var small = 'font:13px system-ui,sans-serif;color:#52657a';
      console.log('%c~ Pelagos Global ~%c\nHello, curious mind. ' + (c.name || 'Pascaline') +
        ' helps organisations move patients safely across borders.\nPress "?" on the page for keyboard shortcuts. ' +
        (c.email ? 'Say hello: ' + c.email : ''), big, small);
    } catch (e) {}
  }

  function init() { addAnchors(); addPrintNote(); greet(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
