/* Command palette / site search: Ctrl+K / Cmd+K or "/" opens it.
   Accessible combobox + listbox inside a modal <dialog>. Index is built at runtime. */
(function () {
  'use strict';
  var PG = (window.PG = window.PG || {});
  var doc = document;
  var RECENT_KEY = 'pg-palette-recent';
  var GROUPS = ['Recent', 'Sections', 'Services', 'FAQ', 'Pages', 'Actions'];
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function enabled() { return !(typeof PG.feature === 'function' && !PG.feature('commandPalette')); }
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function isTyping(t) {
    return !!(t && t.tagName && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
  }

  function go(href) {
    if (href.charAt(0) === '#') {
      var el = doc.getElementById(href.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: PG.reducedMotion ? 'auto' : 'smooth', block: 'start' });
        try { history.pushState(null, '', href); } catch (e) { location.hash = href; }
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
        el.focus({ preventScroll: true });
        return;
      }
    }
    location.href = href;
  }

  function copyEmail() {
    var email = (PG.config && PG.config.email) || '';
    var done = function () { if (PG.toast) PG.toast('Email copied: ' + email); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(email).then(done, function () { location.href = 'mailto:' + email; });
    } else {
      var ta = doc.createElement('textarea');
      ta.value = email; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy'); done(); } catch (e) { location.href = 'mailto:' + email; }
      ta.remove();
    }
  }

  function toggleTheme() {
    if (typeof PG.toggleTheme === 'function') return PG.toggleTheme();
    var root = doc.documentElement;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('pg-theme', next); } catch (e) {}
  }

  // ---- Index ----
  function buildIndex() {
    var items = [];
    var seen = {};
    function add(group, label, href, extra) {
      label = clean(label);
      if (!label) return;
      var key = group + '|' + label.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      var it = { group: group, label: label, href: href || '', hint: (extra && extra.hint) || '', run: extra && extra.run };
      items.push(it);
    }
    PG.$$('main section[id]').forEach(function (sec) {
      var h2 = sec.querySelector('h2');
      if (h2) add('Sections', h2.textContent, '#' + sec.id);
      if (sec.id === 'services' || sec.id === 'faq') return;
      PG.$$('h3', sec).forEach(function (h3) {
        if (h3.closest('[hidden], dialog')) return;
        var target = h3.id || (h3.closest('[id]') && h3.closest('[id]').id) || sec.id;
        add('Sections', h3.textContent, '#' + target, { hint: h2 ? clean(h2.textContent) : '' });
      });
    });
    PG.$$('#services .services-card__title, #services h3').forEach(function (h) {
      add('Services', h.textContent, '#' + (h.id || 'services'));
    });
    PG.$$('#faq .faq-btn, #faq h3 button').forEach(function (b) {
      var span = b.querySelector('span');
      add('FAQ', (span || b).textContent, '#' + (b.id || 'faq'), { run: function () {
        go('#' + (b.id || 'faq'));
        if (b.getAttribute('aria-expanded') === 'false') b.click();
      } });
    });
    add('Pages', 'Readiness check', '#assessment', { hint: 'Duty-of-care assessment' });
    add('Pages', 'Emergency plan builder', '#planner', { hint: 'Medical emergency response plan' });
    add('Pages', 'Sample health brief', '#intel', { hint: 'Healthcare intelligence demo' });
    [
      ['Air Ambulance & Medical Escort Vendor Checklist', 'air-ambulance-vendor-checklist'],
      ['Country Health Briefing Template for Assignees', 'assignment-health-briefing-template'],
      ['Large Event Medical Emergency Readiness Checklist', 'event-medical-readiness-checklist'],
      ['Study Abroad Health & Safety Checklist', 'study-abroad-health-safety-checklist']
    ].forEach(function (r) { add('Pages', r[0], 'resources/' + r[1] + '.html', { hint: 'Resource' }); });
    add('Pages', 'CV', 'cv.html', { hint: 'Curriculum vitae' });
    add('Pages', 'Speaker kit', 'speaker.html', { hint: 'Bio, topics, photos' });
    add('Pages', 'Français', 'fr/', { hint: 'French version' });
    add('Pages', 'Español', 'es/', { hint: 'Spanish version' });
    add('Pages', 'Deutsch', 'de/', { hint: 'German version' });
    add('Pages', 'Request a change', 'request/', { hint: 'Site change request' });
    add('Actions', 'Toggle theme', '', { hint: 'Light / dark', run: toggleTheme });
    add('Actions', 'Copy email', '', { hint: (PG.config && PG.config.email) || '', run: copyEmail });
    add('Actions', 'Book a consultation', (PG.config && PG.config.bookingUrl) || '#contact', { hint: 'Contact' });
    return items;
  }

  // ---- Fuzzy match: returns {score, idx[]} or null ----
  function fuzzy(q, text) {
    var t = text.toLowerCase();
    var sub = t.indexOf(q);
    if (sub > -1) {
      var idx = [];
      for (var k = 0; k < q.length; k++) idx.push(sub + k);
      var wordStart = sub === 0 || /\W/.test(t.charAt(sub - 1));
      return { score: 100 + (wordStart ? 50 : 0) - sub * 0.5 - t.length * 0.05, idx: idx };
    }
    var ti = 0, score = 0, prev = -2, out = [];
    for (var i = 0; i < q.length; i++) {
      var c = q.charAt(i);
      if (c === ' ') continue;
      ti = t.indexOf(c, ti);
      if (ti === -1) return null;
      score += ti === prev + 1 ? 6 : (ti === 0 || /\W/.test(t.charAt(ti - 1)) ? 4 : 1);
      out.push(ti); prev = ti; ti++;
    }
    return { score: score - t.length * 0.05, idx: out };
  }

  function highlight(el, text, idx) {
    var set = {};
    (idx || []).forEach(function (i) { set[i] = 1; });
    var buf = '';
    var flush = function (mark) {
      if (!buf) return;
      if (mark) { var m = doc.createElement('mark'); m.textContent = buf; el.appendChild(m); }
      else el.appendChild(doc.createTextNode(buf));
      buf = '';
    };
    var inMark = false;
    for (var i = 0; i < text.length; i++) {
      var on = !!set[i];
      if (on !== inMark) { flush(inMark); inMark = on; }
      buf += text.charAt(i);
    }
    flush(inMark);
  }

  function loadRecent() {
    try { var r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(r) ? r : []; }
    catch (e) { return []; }
  }
  function saveRecent(label) {
    try {
      var r = loadRecent().filter(function (x) { return x !== label; });
      r.unshift(label);
      localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 5)));
    } catch (e) {}
  }

  // ---- UI ----
  var dialog, input, list, status, index, results = [], active = -1, lastFocus;
  var SEARCH_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';

  function build() {
    dialog = doc.createElement('dialog');
    dialog.className = 'palette';
    dialog.setAttribute('aria-labelledby', 'palette-title');
    dialog.innerHTML =
      '<div class="palette-panel">' +
        '<h2 id="palette-title" class="palette-sr">Search the site</h2>' +
        '<div class="palette-field">' + SEARCH_ICON +
          '<input id="palette-input" class="palette-input" type="text" role="combobox" autocomplete="off" spellcheck="false"' +
          ' aria-autocomplete="list" aria-expanded="true" aria-controls="palette-list" aria-labelledby="palette-title"' +
          ' placeholder="Search sections, services, FAQ, pages…">' +
          '<button type="button" class="palette-close" aria-label="Close search"><kbd>Esc</kbd></button>' +
        '</div>' +
        '<ul id="palette-list" class="palette-list" role="listbox" aria-label="Results"></ul>' +
        '<p class="palette-status palette-sr" role="status" aria-live="polite"></p>' +
        '<div class="palette-foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>' +
          '<span><kbd>↵</kbd> open</span><span><kbd>Esc</kbd> close</span></div>' +
      '</div>';
    doc.body.appendChild(dialog);
    input = dialog.querySelector('.palette-input');
    list = dialog.querySelector('.palette-list');
    status = dialog.querySelector('.palette-status');

    input.addEventListener('input', render);
    input.addEventListener('keydown', onKey);
    dialog.querySelector('.palette-close').addEventListener('click', close);
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) close(); });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('[role="option"]');
      if (li) choose(+li.getAttribute('data-i'));
    });
    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('[role="option"]');
      if (li && +li.getAttribute('data-i') !== active) setActive(+li.getAttribute('data-i'), false);
    });
  }

  function render() {
    var q = clean(input.value).toLowerCase();
    var matches = [];
    if (!q) {
      var recent = loadRecent();
      recent.forEach(function (label) {
        var it = index.filter(function (x) { return x.label === label; })[0];
        if (it) matches.push({ item: it, group: 'Recent', idx: [] });
      });
      index.forEach(function (it) {
        if (it.group === 'Pages' || it.group === 'Actions' || (it.group === 'Sections' && !it.hint)) {
          matches.push({ item: it, group: it.group, idx: [] });
        }
      });
    } else {
      index.forEach(function (it) {
        var m = fuzzy(q, it.label);
        var h = !m && it.hint ? fuzzy(q, it.hint) : null;
        if (m) matches.push({ item: it, group: it.group, idx: m.idx, score: m.score });
        else if (h && h.score > 100) matches.push({ item: it, group: it.group, idx: [], score: h.score - 60 });
      });
      var minScore = q.replace(/ /g, '').length * 2;
      matches = matches.filter(function (m) { return m.score >= minScore; });
      matches.sort(function (a, b) { return b.score - a.score; });
      matches = matches.slice(0, 40);
    }
    // Groups ordered by their best match when searching (matches are already sorted)
    var order = q ? [] : GROUPS;
    if (q) matches.forEach(function (m) { if (order.indexOf(m.group) < 0) order.push(m.group); });
    results = [];
    list.textContent = '';
    order.forEach(function (g) {
      var inGroup = matches.filter(function (m) { return m.group === g; });
      if (!inGroup.length) return;
      var gli = doc.createElement('li');
      gli.setAttribute('role', 'presentation');
      gli.className = 'palette-group';
      var gid = 'palette-g-' + g.toLowerCase();
      gli.innerHTML = '<div class="palette-group__label" id="' + gid + '" aria-hidden="true">' + g + '</div>';
      var ul = doc.createElement('ul');
      ul.setAttribute('role', 'group');
      ul.setAttribute('aria-labelledby', gid);
      inGroup.forEach(function (m) {
        var i = results.length;
        results.push(m.item);
        var li = doc.createElement('li');
        li.id = 'palette-opt-' + i;
        li.className = 'palette-option';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.setAttribute('data-i', i);
        var lab = doc.createElement('span');
        lab.className = 'palette-option__label';
        highlight(lab, m.item.label, m.idx);
        li.appendChild(lab);
        if (m.item.hint) {
          var hint = doc.createElement('span');
          hint.className = 'palette-option__hint';
          hint.textContent = m.item.hint;
          li.appendChild(hint);
        }
        ul.appendChild(li);
      });
      gli.appendChild(ul);
      list.appendChild(gli);
    });
    if (!results.length) {
      var empty = doc.createElement('li');
      empty.className = 'palette-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = 'No results for “' + clean(input.value) + '”';
      list.appendChild(empty);
    }
    status.textContent = q ? (results.length ? results.length + ' results' : 'No results') : '';
    setActive(results.length ? 0 : -1, true);
  }

  function setActive(i, scroll) {
    var prev = list.querySelector('[aria-selected="true"]');
    if (prev) prev.setAttribute('aria-selected', 'false');
    active = i;
    if (i < 0) { input.removeAttribute('aria-activedescendant'); return; }
    var el = doc.getElementById('palette-opt-' + i);
    el.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', el.id);
    if (scroll) el.scrollIntoView({ block: 'nearest' });
  }

  function onKey(e) {
    var n = results.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) setActive((active + 1) % n, true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) setActive((active - 1 + n) % n, true); }
    else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); if (n) setActive(0, true); }
    else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); if (n) setActive(n - 1, true); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active > -1) choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); if (input.value) { input.value = ''; render(); } else close(); }
  }

  function choose(i) {
    var it = results[i];
    if (!it) return;
    saveRecent(it.label);
    close(true);
    if (it.run) it.run();
    else if (it.href) go(it.href);
  }

  function open() {
    if (!dialog) build();
    if (dialog.open) return;
    index = buildIndex();
    lastFocus = doc.activeElement;
    input.value = '';
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    doc.documentElement.classList.add('palette-lock');
    render();
    input.focus();
  }

  function close(navigating) {
    if (!dialog || !dialog.open) return;
    if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
    doc.documentElement.classList.remove('palette-lock');
    if (navigating !== true && lastFocus && lastFocus.focus) lastFocus.focus();
  }

  PG.openPalette = open;

  function addTrigger() {
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'palette-trigger';
    btn.setAttribute('aria-label', 'Search the site');
    btn.setAttribute('aria-keyshortcuts', isMac ? 'Meta+K /' : 'Control+K /');
    btn.innerHTML = SEARCH_ICON + '<span class="palette-trigger__text">Search</span>' +
      '<kbd class="palette-trigger__kbd" aria-hidden="true">' + (isMac ? '⌘K' : 'Ctrl K') + '</kbd>';
    btn.addEventListener('click', open);
    var theme = doc.querySelector('.nav-actions [aria-label*="theme" i]') || doc.querySelector('[aria-label*="theme" i]');
    if (theme && theme.parentNode) theme.parentNode.insertBefore(btn, theme);
    else { btn.classList.add('palette-trigger--float'); doc.body.appendChild(btn); }
  }

  function otherModalOpen() {
    if (doc.querySelector('dialog[open]')) return true;
    return PG.$$('[aria-modal="true"]').some(function (m) { return !m.closest('[hidden]') && m.getClientRects().length > 0; });
  }

  function init() {
    if (!enabled()) return;
    addTrigger();
    doc.addEventListener('keydown', function (e) {
      if (dialog && dialog.open) return;
      var k = e.key;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (k === 'k' || k === 'K')) {
        e.preventDefault(); open(); return;
      }
      if (k === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target) && !e.defaultPrevented) {
        if (otherModalOpen()) return;
        e.preventDefault(); open();
      }
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
