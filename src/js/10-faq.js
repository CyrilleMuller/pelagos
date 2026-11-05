/* FAQ: accessible accordion (one open at a time) + live search filter. */
(function () {
  'use strict';
  var PG = window.PG || {};

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function normalize(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function init() {
    var root = document.getElementById('faq');
    if (!root) return;
    root.classList.add('faq--js');

    var items = PG.$$('.faq-item', root).map(function (el) {
      var btn = PG.$('.faq-btn', el);
      var label = PG.$('.faq-btn > span:first-child', el);
      var answer = PG.$('.faq-a', el);
      return {
        el: el, btn: btn, label: label, question: label.textContent,
        haystack: normalize(label.textContent + ' ' + answer.textContent)
      };
    });
    var input = PG.$('#faq-search-input', root);
    var clear = PG.$('.faq-search-clear', root);
    var status = PG.$('#faq-search-status', root);
    var empty = PG.$('.faq-empty', root);

    function setOpen(item, open) {
      item.btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      item.el.classList.toggle('is-open', open);
    }

    items.forEach(function (item, i) {
      item.btn.addEventListener('click', function () {
        var open = item.btn.getAttribute('aria-expanded') !== 'true';
        items.forEach(function (other) { if (other !== item) setOpen(other, false); });
        setOpen(item, open);
      });
      item.btn.addEventListener('keydown', function (e) {
        var visible = items.filter(function (it) { return !it.el.hidden; });
        var idx = visible.indexOf(item);
        var next = null;
        if (e.key === 'ArrowDown') next = visible[(idx + 1) % visible.length];
        else if (e.key === 'ArrowUp') next = visible[(idx - 1 + visible.length) % visible.length];
        else if (e.key === 'Home') next = visible[0];
        else if (e.key === 'End') next = visible[visible.length - 1];
        if (!next) return;
        e.preventDefault();
        next.btn.focus();
      });
    });

    // Open an item if the URL targets it (e.g. #faq-panel-6)
    if (location.hash) {
      var target = items.filter(function (it) { return '#' + it.btn.getAttribute('aria-controls') === location.hash; })[0];
      if (target) setOpen(target, true);
    }

    var timer;
    function filter() {
      var raw = input.value.trim();
      var q = normalize(raw);
      var terms = q.split(/\s+/).filter(Boolean);
      var shown = 0;
      items.forEach(function (item) {
        var match = terms.every(function (t) { return item.haystack.indexOf(t) !== -1; });
        item.el.hidden = !match;
        if (match) shown++;
        // Highlight matching words in the question label
        if (!terms.length) {
          item.label.textContent = item.question;
        } else {
          var html = escapeHtml(item.question);
          var pattern = terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
          // Highlight on the accent-folded text by matching per character position
          var folded = normalize(item.question);
          var re = new RegExp(pattern, 'g');
          var marks = [];
          var m;
          while ((m = re.exec(folded)) !== null) { marks.push([m.index, m.index + m[0].length]); if (!m[0].length) re.lastIndex++; }
          if (marks.length && folded.length === item.question.length) {
            var out = ''; var pos = 0;
            marks.forEach(function (r) {
              if (r[0] < pos) return;
              out += escapeHtml(item.question.slice(pos, r[0])) + '<mark>' + escapeHtml(item.question.slice(r[0], r[1])) + '</mark>';
              pos = r[1];
            });
            html = out + escapeHtml(item.question.slice(pos));
          }
          item.label.innerHTML = html;
        }
      });
      empty.hidden = shown !== 0;
      clear.hidden = !raw;
      clearTimeout(timer);
      timer = setTimeout(function () {
        status.textContent = !raw ? '' : shown === 0
          ? 'No questions match “' + raw + '”.'
          : shown + (shown === 1 ? ' question matches' : ' questions match') + ' “' + raw + '”.';
      }, 250);
    }

    input.addEventListener('input', filter);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; filter(); }
    });
    clear.addEventListener('click', function () { input.value = ''; filter(); input.focus(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
