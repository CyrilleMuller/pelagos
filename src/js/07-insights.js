/* Insights: accessible filter tabs + copy-citation button. */
(function () {
  'use strict';
  var PG = window.PG || {};

  function init() {
    var root = document.getElementById('insights');
    if (!root) return;
    var tabs = PG.$$('[role="tab"]', root);
    var panel = PG.$('#insights-panel', root);
    var cards = PG.$$('.insights-card', panel);
    var live = PG.$('.insights-count', root);

    function select(tab, focus) {
      var filter = tab.getAttribute('data-filter');
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', tab.id);
      var shown = 0;
      cards.forEach(function (c) {
        var match = filter === 'all' || c.getAttribute('data-cat') === filter;
        var wasHidden = c.hidden;
        c.hidden = !match;
        if (match) {
          shown++;
          if (wasHidden && !PG.reducedMotion) {
            c.classList.remove('is-entering');
            void c.offsetWidth;
            c.classList.add('is-entering');
          }
        }
      });
      if (live) live.textContent = shown + (shown === 1 ? ' item' : ' items') + ' shown';
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault();
        select(tabs[n], true);
      });
    });
    cards.forEach(function (c) {
      c.addEventListener('animationend', function () { c.classList.remove('is-entering'); });
    });

    // Copy APA citation
    PG.$$('.insights-cite', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-citation') || '';
        var done = function () { if (PG.toast) PG.toast('Citation copied to clipboard'); };
        var fallback = function () {
          var ta = document.createElement('textarea');
          ta.value = text; ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
          document.body.appendChild(ta); ta.select();
          var ok = false;
          try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
          ta.remove();
          if (ok) done();
          else if (PG.toast) PG.toast('Copy failed. Please select the citation manually.');
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(done, fallback);
        } else {
          fallback();
        }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
