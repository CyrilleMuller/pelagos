/* Change-request portal: prefilled GitHub issue, direct API post (admin token), mailto fallback, request list. */
(function () {
  'use strict';
  var REPO = 'CyrilleMuller/pelagos';
  var TEMPLATE = 'change-request.yml';
  var LABEL = 'change-request';
  var TOKEN_KEY = 'pg-admin-token';
  var DRAFT_KEY = 'pg-request-draft';
  // TODO(maintainer): set a maintainer email to enable the "Send by email instead" option.
  var MAINTAINER_EMAIL = '';
  var FIELDS = ['type', 'area', 'current', 'change', 'priority', 'attachment'];

  function $(s) { return document.querySelector(s); }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  var form = $('#rq-form');
  var token = store(TOKEN_KEY) || '';

  function data() {
    var d = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; } else d[el.name] = el.value.trim();
    });
    return d;
  }
  function titleOf(d) {
    if (d.title) return d.title;
    var snip = (d.change || '').replace(/\s+/g, ' ').slice(0, 60);
    return '[' + d.area + '] ' + d.type + (snip ? ': ' + snip : '');
  }
  function extra(d) {
    var who = [d.name, d.email].filter(Boolean).join(' · ');
    return who ? '\n\nRequested by: ' + who : '';
  }
  function issueUrl(d) {
    var q = ['template=' + encodeURIComponent(TEMPLATE), 'title=' + encodeURIComponent(titleOf(d)), 'labels=' + LABEL];
    FIELDS.forEach(function (f) {
      var v = d[f] || '';
      if (f === 'change') v += extra(d);
      if (v) q.push(f + '=' + encodeURIComponent(v));
    });
    return 'https://github.com/' + REPO + '/issues/new?' + q.join('&');
  }
  function body(d) {
    return '### What kind of change?\n\n' + d.type +
      '\n\n### Where on the site?\n\n' + d.area +
      '\n\n### Current text (optional)\n\n' + (d.current || '_No response_') +
      '\n\n### New text or description of the change\n\n' + d.change +
      '\n\n### Priority\n\n' + (d.priority || 'Whenever') +
      '\n\n### Screenshot or file link (optional)\n\n' + (d.attachment || '_No response_') + extra(d) +
      '\n\n_Sent from the request portal._';
  }

  // ---- Draft ----
  var draftMsg = $('#rq-draft'), saveT;
  try {
    var saved = JSON.parse(store(DRAFT_KEY) || 'null');
    if (saved) Object.keys(saved).forEach(function (k) {
      var els = form.elements[k];
      if (!els) return;
      if (els.length && els[0] && els[0].type === 'radio') Array.prototype.forEach.call(els, function (r) { r.checked = r.value === saved[k]; });
      else els.value = saved[k];
    });
  } catch (e) {}
  form.addEventListener('input', function () {
    clearTimeout(saveT);
    saveT = setTimeout(function () { store(DRAFT_KEY, JSON.stringify(data())); draftMsg.textContent = 'Draft saved'; }, 400);
  });

  // ---- Submit ----
  var err = $('#rq-error'), ok = $('#rq-success'), btn = $('#rq-submit');
  if (token) {
    btn.textContent = 'Send request';
    $('#rq-hint').textContent = 'Signed in via the admin panel — the request is created directly.';
  }
  function validate(d) {
    if (!d.change) { err.textContent = 'Please describe the change you would like.'; err.hidden = false; form.elements.change.focus(); return false; }
    err.hidden = true; return true;
  }
  function done(html) {
    ok.innerHTML = html; ok.hidden = false;
    store(DRAFT_KEY, null); draftMsg.textContent = '';
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = data();
    if (!validate(d)) return;
    if (!token) {
      window.open(issueUrl(d), '_blank', 'noopener');
      done('GitHub opened in a new tab — press <strong>Create</strong> there to send it. Thank you!');
      return;
    }
    btn.disabled = true; btn.textContent = 'Sending…';
    fetch('https://api.github.com/repos/' + REPO + '/issues', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleOf(d), body: body(d), labels: [LABEL] })
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (iss) {
        var a = document.createElement('a'); a.href = iss.html_url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '#' + iss.number;
        done('Thank you! Request created: '); ok.appendChild(a);
        form.reset(); loadList();
      })
      .catch(function (x) {
        err.textContent = 'Could not send directly (' + x.message + '). Opening GitHub instead…'; err.hidden = false;
        window.open(issueUrl(d), '_blank', 'noopener');
      })
      .then(function () { btn.disabled = false; btn.textContent = 'Send request'; });
  });

  var mailBtn = $('#rq-email');
  if (MAINTAINER_EMAIL) {
    mailBtn.hidden = false;
    mailBtn.addEventListener('click', function () {
      var d = data();
      if (!validate(d)) return;
      location.href = 'mailto:' + MAINTAINER_EMAIL + '?subject=' + encodeURIComponent(titleOf(d)) + '&body=' + encodeURIComponent(body(d));
    });
  }

  // ---- Request list ----
  var list = $('#rq-items');
  function status(i) {
    if (i.state === 'closed') return ['Done', 'done'];
    var ip = (i.labels || []).some(function (l) { return (l.name || l) === 'in-progress'; });
    return ip ? ['In progress', 'progress'] : ['Open', 'open'];
  }
  function msg(t) { list.innerHTML = ''; var p = document.createElement('p'); p.className = 'rq-muted'; p.textContent = t; list.appendChild(p); }
  function loadList() {
    msg('Loading…');
    var h = { Accept: 'application/vnd.github+json' };
    if (token) h.Authorization = 'Bearer ' + token;
    fetch('https://api.github.com/repos/' + REPO + '/issues?labels=' + LABEL + '&state=all&per_page=50', { headers: h })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (items) {
        items = items.filter(function (i) { return !i.pull_request; });
        if (!items.length) return msg('No requests yet — your first one will show up here.');
        var ul = document.createElement('ul'); ul.className = 'rq-items';
        items.forEach(function (i) {
          var s = status(i), li = document.createElement('li'), a = document.createElement('a');
          a.href = i.html_url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = i.title;
          var b = document.createElement('span'); b.className = 'rq-badge rq-badge--' + s[1]; b.textContent = s[0];
          var dt = document.createElement('time'); dt.dateTime = i.created_at;
          dt.textContent = new Date(i.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
          li.appendChild(b); li.appendChild(a); li.appendChild(dt); ul.appendChild(li);
        });
        list.innerHTML = ''; list.appendChild(ul);
      })
      .catch(function () {
        msg('We could not load the list right now (the project may be private or offline). Your requests are still received.');
      });
  }
  $('#rq-refresh').addEventListener('click', loadList);
  loadList();
})();
