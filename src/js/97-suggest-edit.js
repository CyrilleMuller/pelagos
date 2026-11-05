/* Suggest-edit mode: ?suggest, Shift+E, or localStorage pg-suggest=1. Click any text to request a change. */
(function () {
  'use strict';
  var PG = window.PG || {};
  if (PG.feature && !PG.feature('suggestEdits')) return;

  var REPO = 'CyrilleMuller/pelagos';
  var LABEL = 'change-request';
  var SEL = 'h1,h2,h3,h4,p,li,a,button,span.chip';
  var AREAS = {
    top: 'Hero', about: 'About', why: 'About', services: 'Services', experience: 'Experience', expertise: 'Expertise',
    planner: 'Planner', intel: 'Health brief sample', insights: 'Insights', engagements: 'Example engagements',
    process: 'Process', assessment: 'Readiness check', faq: 'FAQ', resources: 'Resources', kits: 'Speaker kit',
    newsletter: 'Contact', contact: 'Contact'
  };
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  var active = false, bar, pop, hoverEl, lastFocus;

  function isOurs(el) { return el.closest('.se-bar,.se-pop'); }
  function targetOf(el) {
    var t = el && el.closest && el.closest(SEL);
    return t && !isOurs(t) && t.textContent.trim() ? t : null;
  }
  function areaOf(el) {
    var s = el.closest('section[id]');
    if (s) return AREAS[s.id] || 'Other';
    return el.closest('footer,nav,header') ? 'Whole site' : 'Other';
  }
  function issueUrl(d) {
    var title = '[' + d.area + '] Text change: ' + d.current.replace(/\s+/g, ' ').slice(0, 50);
    var change = d.change + (d.note ? '\n\nNote: ' + d.note : '') + '\n\nPage: ' + location.href.split('?')[0] + (d.sid ? '#' + d.sid : '');
    var q = { template: 'change-request.yml', title: title, labels: LABEL, type: 'Text change', area: d.area, current: d.current, change: change, priority: 'Whenever' };
    return { title: title, change: change, url: 'https://github.com/' + REPO + '/issues/new?' + Object.keys(q).map(function (k) {
      return k + '=' + (k === 'labels' ? q[k] : encodeURIComponent(q[k]));
    }).join('&') };
  }

  function onOver(e) {
    var t = targetOf(e.target);
    if (t === hoverEl) return;
    if (hoverEl) hoverEl.classList.remove('se-hover');
    hoverEl = t;
    if (t) t.classList.add('se-hover');
  }
  function onClick(e) {
    if (isOurs(e.target)) return;
    var t = targetOf(e.target);
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    openPop(t);
  }

  function closePop() {
    if (!pop) return;
    pop.remove(); pop = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openPop(t) {
    closePop();
    lastFocus = document.activeElement;
    var current = t.textContent.replace(/\s+/g, ' ').trim();
    var sec = t.closest('section[id]');
    var area = areaOf(t);
    pop = document.createElement('div');
    pop.className = 'se-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-modal', 'false');
    pop.setAttribute('aria-labelledby', 'se-pop-h');
    pop.innerHTML =
      '<h2 id="se-pop-h" class="se-pop-h">Suggest a change <span class="se-pop-area"></span></h2>' +
      '<p class="se-pop-label">Current text</p><blockquote class="se-pop-cur"></blockquote>' +
      '<label class="se-pop-field"><span>Proposed text</span><textarea rows="4" class="se-new"></textarea></label>' +
      '<label class="se-pop-field"><span>Note (optional)</span><input type="text" class="se-note" /></label>' +
      '<p class="se-pop-err" role="alert" hidden></p>' +
      '<div class="se-pop-actions"><button type="button" class="btn btn--primary se-send">Send request</button>' +
      '<button type="button" class="btn btn--ghost se-cancel">Cancel</button></div>';
    pop.querySelector('.se-pop-area').textContent = '· ' + area;
    pop.querySelector('.se-pop-cur').textContent = current;
    var ta = pop.querySelector('.se-new'); ta.value = current;
    document.body.appendChild(pop);

    var r = t.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var top = r.bottom + 8 + ph > window.innerHeight ? Math.max(8, r.top - ph - 8) : r.bottom + 8;
    pop.style.top = Math.max(8, Math.min(top, window.innerHeight - ph - 8)) + 'px';
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pw - 8)) + 'px';
    ta.focus(); ta.select();

    pop.querySelector('.se-cancel').addEventListener('click', closePop);
    pop.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } });
    pop.querySelector('.se-send').addEventListener('click', function () {
      var err = pop.querySelector('.se-pop-err');
      var d = { area: area, current: current, change: ta.value.trim(), note: pop.querySelector('.se-note').value.trim(), sid: sec && sec.id };
      if (!d.change || d.change === current) { err.textContent = 'Please type the new text first.'; err.hidden = false; ta.focus(); return; }
      var info = issueUrl(d), token = store('pg-admin-token');
      if (!token) { window.open(info.url, '_blank', 'noopener'); closePop(); toast('GitHub opened — press Create to send it.'); return; }
      var btn = this; btn.disabled = true; btn.textContent = 'Sending…';
      fetch('https://api.github.com/repos/' + REPO + '/issues', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: info.title, labels: [LABEL], body:
          '### What kind of change?\n\nText change\n\n### Where on the site?\n\n' + d.area +
          '\n\n### Current text (optional)\n\n' + d.current + '\n\n### New text or description of the change\n\n' + info.change +
          '\n\n### Priority\n\nWhenever\n\n_Sent from suggest-edit mode._' })
      }).then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(function (iss) { closePop(); toast('Request #' + iss.number + ' created — thank you!'); })
        .catch(function () { window.open(info.url, '_blank', 'noopener'); closePop(); toast('Opened GitHub instead.'); });
    });
  }
  function toast(m) { if (PG.toast) PG.toast(m); }

  function onKey(e) {
    if (e.key === 'Escape' && active && !pop) stop();
  }
  function start() {
    if (active) return;
    active = true;
    store('pg-suggest', '1');
    document.documentElement.classList.add('se-on');
    bar = document.createElement('div');
    bar.className = 'se-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Suggest-edit mode');
    bar.innerHTML = '<span class="se-bar-dot" aria-hidden="true"></span><span>Suggest-edit mode — click any text</span>' +
      '<a class="se-bar-link" href="request/">Other request</a><button type="button" class="se-bar-exit">Exit</button>';
    bar.querySelector('.se-bar-exit').addEventListener('click', stop);
    document.body.appendChild(bar);
    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
  }
  function stop() {
    active = false;
    store('pg-suggest', null);
    closePop();
    document.documentElement.classList.remove('se-on');
    if (hoverEl) hoverEl.classList.remove('se-hover');
    hoverEl = null;
    if (bar) bar.remove();
    document.removeEventListener('mouseover', onOver, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey);
  }

  document.addEventListener('keydown', function (e) {
    if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || (e.key !== 'E' && e.key !== 'e')) return;
    var tg = e.target, tag = tg && tg.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (tg && tg.isContentEditable)) return;
    // Shift+E only toggles for people who already opted in once (keeps normal visitors unaffected).
    if (!active && !/[?&]suggest\b/.test(location.search) && store('pg-suggest-known') !== '1') return;
    active ? stop() : start();
  });

  function init() {
    var param = /[?&]suggest\b/.test(location.search);
    if (param) store('pg-suggest-known', '1');
    if (param || store('pg-suggest') === '1') start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
