/* Pelagos browser admin. No server, no dependencies: talks to the GitHub REST API with a
   fine-grained personal access token kept in this browser's localStorage. */
(function () {
  'use strict';

  var LS_KEY = 'pg-admin';
  var SITE_JSON = 'content/site.json';
  var SECTIONS_DIR = 'src/sections';
  var CONFIG_FIELDS = [
    ['name', 'Full name'], ['brand', 'Brand / company'], ['title', 'Professional title'], ['email', 'Email', 'email'],
    ['linkedin', 'LinkedIn URL', 'url'], ['location', 'Location line'], ['timezone', 'Time zone (IANA, e.g. America/New_York)'],
    ['bookingUrl', 'Booking link (Calendly etc. or #contact)'], ['formEndpoint', 'Contact form endpoint (empty = email fallback)']
  ];
  var FEATURES = [
    ['darkMode', 'Dark mode toggle'], ['langSwitcher', 'Language switcher'], ['stickyCta', 'Sticky call-to-action'],
    ['exitIntent', 'Exit-intent prompt'], ['newsletter', 'Newsletter sign-up'], ['keyboardShortcuts', 'Keyboard shortcuts'],
    ['scrollProgress', 'Scroll progress bar'], ['suggestEdits', '“Suggest an edit” link'], ['commandPalette', 'Command palette (Ctrl+K)']
  ];

  // ---------- state ----------
  var S = {
    cfg: load(),
    tree: [],            // [{path, sha, type}] of the branch, from the Git trees API
    files: {},           // path -> {content, sha} as last read from GitHub
    pending: {},         // path -> {content: string|null (null = delete), note}
    site: null,          // parsed site.json (working copy)
    siteExists: false,
    editor: { path: null, original: '', mode: 'visual', visualDirty: false, isFragment: true },
    pollTimer: null
  };

  function load() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S.cfg)); } catch (e) { /* private mode */ } }

  // ---------- helpers ----------
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) n.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (k) { if (k) n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
    return n;
  }
  function toast(msg, type, html) {
    var t = el('div', { class: 'toast ' + (type || ''), role: type === 'err' ? 'alert' : 'status' });
    if (html) t.innerHTML = html; else t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, type === 'err' ? 7000 : 3500);
    setTimeout(function () { t.remove(); }, type === 'err' ? 7500 : 4000);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // UTF-8 safe base64
  function b64encode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decode(b64) {
    var bin = atob(String(b64).replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function prettyName(file) {
    return file.replace(/\.html$/, '').replace(/^\d+[a-z]?-/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function slug(s) { return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'; }
  function siteBase() {
    if (/^https?:/.test(location.protocol) && /\/admin\/?/.test(location.pathname)) return new URL('../', location.href).href;
    return 'https://' + S.cfg.owner + '.github.io/' + S.cfg.repo + '/';
  }

  // ---------- GitHub API ----------
  function ApiError(status, msg) { this.status = status; this.message = msg; }
  function gh(path, opts) {
    opts = opts || {};
    var url = path.indexOf('http') === 0 ? path : 'https://api.github.com' + path;
    return fetch(url, {
      method: opts.method || 'GET',
      headers: { Authorization: 'Bearer ' + S.cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store'
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok) return j;
        var m = (j && j.message) || r.statusText;
        if (r.status === 401) m = 'GitHub rejected the token (401). It may be expired or mistyped — log out and connect again.';
        else if (r.status === 403) m = 'Permission denied (403): ' + m + '. Check the token has Contents/Pull requests read & write on this repo.';
        else if (r.status === 409) m = 'Conflict (409): the repository changed meanwhile. Reload the page and redo the change.';
        else if (r.status === 422) m = 'GitHub refused the change (422): ' + m;
        throw new ApiError(r.status, m);
      });
    }, function () { throw new ApiError(0, 'Network error — are you online?'); });
  }
  function repoPath(p) { return '/repos/' + encodeURIComponent(S.cfg.owner) + '/' + encodeURIComponent(S.cfg.repo) + (p || ''); }
  function encPath(p) { return p.split('/').map(encodeURIComponent).join('/'); }
  function fail(e) { console.warn(e); toast(e && e.message ? e.message : String(e), 'err'); }

  function getFile(path) {
    if (S.files[path]) return Promise.resolve(S.files[path]);
    return gh(repoPath('/contents/' + encPath(path) + '?ref=' + encodeURIComponent(S.cfg.branch))).then(function (j) {
      if (j.content || j.size === 0) return { content: j.content ? b64decode(j.content) : '', sha: j.sha };
      return gh(repoPath('/git/blobs/' + j.sha)).then(function (b) { return { content: b64decode(b.content), sha: j.sha }; });
    }).then(function (f) { S.files[path] = f; return f; }, function (e) { if (e.status === 404) return null; throw e; });
  }
  // Current working content: pending edit if any, else GitHub version
  function current(path) {
    if (S.pending[path] && S.pending[path].content != null) return Promise.resolve(S.pending[path].content);
    return getFile(path).then(function (f) { return f ? f.content : ''; });
  }
  function loadTree() {
    return gh(repoPath('/git/trees/' + encodeURIComponent(S.cfg.branch) + '?recursive=1')).then(function (j) {
      S.tree = (j.tree || []).filter(function (t) { return t.type === 'blob'; });
    });
  }
  function treeHas(p) { return S.tree.some(function (t) { return t.path === p; }); }

  // ---------- pending changes ----------
  function stage(path, content, note) {
    var orig = S.files[path];
    if (content != null && orig && orig.content === content) delete S.pending[path];
    else S.pending[path] = { content: content, note: note || '' };
    renderPending();
  }
  function stageSite(note) {
    stage(SITE_JSON, JSON.stringify(S.site, null, 2) + '\n', note || 'Site structure / settings');
    S.siteExists = true;
  }
  function pendingKeys() { return Object.keys(S.pending); }
  function kindOf(p) {
    if (S.pending[p].content == null) return ['del', 'Delete'];
    return treeHas(p) ? ['mod', 'Edit'] : ['new', 'New'];
  }
  function renderPending() {
    var keys = pendingKeys();
    $('#pending-count').textContent = keys.length;
    $('#publish-btn').disabled = !keys.length;
    var list = $('#pending-list');
    list.innerHTML = '';
    if (!keys.length) list.appendChild(el('li', { text: 'Nothing pending.' }));
    keys.forEach(function (p) {
      var k = kindOf(p);
      list.appendChild(el('li', {}, [
        el('span', {}, [el('span', { class: 'kind kind-' + k[0], text: k[1] }), el('code', { text: p })]),
        el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Discard', 'aria-label': 'Discard change to ' + p,
          onclick: function () { discard(p); } })
      ]));
    });
  }
  function discard(p) {
    delete S.pending[p];
    if (p === SITE_JSON || p.indexOf(SECTIONS_DIR) === 0) reloadSite();
    if (S.editor.path === p) openEditor(p);
    renderPending();
    toast('Discarded change to ' + p);
  }

  // ---------- publish (Git Data API: one commit for all files) ----------
  function publish(mode, message) {
    var keys = pendingKeys();
    var head, baseTree, branch = S.cfg.branch, newBranch;
    var go = $('#publish-go');
    go.disabled = true; go.textContent = 'Publishing…';
    return gh(repoPath('/git/ref/heads/' + encPath(branch))).then(function (ref) {
      head = ref.object.sha;
      return gh(repoPath('/git/commits/' + head));
    }).then(function (c) {
      baseTree = c.tree.sha;
      // Conflict check: did any file we edited change on GitHub after we opened it?
      return gh(repoPath('/git/trees/' + baseTree + '?recursive=1'));
    }).then(function (t) {
      var now = {};
      (t.tree || []).forEach(function (x) { now[x.path] = x.sha; });
      var stale = keys.filter(function (p) { var f = S.files[p]; return f && now[p] && now[p] !== f.sha; });
      if (stale.length) throw new ApiError(409, 'Conflict: ' + stale.join(', ') + ' changed on GitHub since you opened it. Discard your change, reload, and redo it.');
      return Promise.all(keys.map(function (p) {
        var c = S.pending[p].content;
        if (c == null) return now[p] ? { path: p, mode: '100644', type: 'blob', sha: null } : null;
        return gh(repoPath('/git/blobs'), { method: 'POST', body: { content: b64encode(c), encoding: 'base64' } })
          .then(function (b) { return { path: p, mode: '100644', type: 'blob', sha: b.sha }; });
      }));
    }).then(function (entries) {
      entries = entries.filter(Boolean);
      return gh(repoPath('/git/trees'), { method: 'POST', body: { base_tree: baseTree, tree: entries } });
    }).then(function (tree) {
      return gh(repoPath('/git/commits'), { method: 'POST', body: { message: message, tree: tree.sha, parents: [head] } });
    }).then(function (commit) {
      if (mode === 'direct') {
        return gh(repoPath('/git/refs/heads/' + encPath(branch)), { method: 'PATCH', body: { sha: commit.sha, force: false } })
          .then(function () { return { commit: commit }; });
      }
      newBranch = 'admin/' + new Date().toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z');
      return gh(repoPath('/git/refs'), { method: 'POST', body: { ref: 'refs/heads/' + newBranch, sha: commit.sha } })
        .then(function () {
          return gh(repoPath('/pulls'), { method: 'POST', body: { title: message, head: newBranch, base: branch,
            body: 'Proposed from the site admin (`/admin/`).\n\nFiles:\n' + keys.map(function (k) { return '- `' + k + '`'; }).join('\n') } });
        }).then(function (pr) { return { commit: commit, pr: pr }; });
    }).then(function (res) {
      $('#publish-dialog').close();
      if (res.pr) {
        toast('', 'ok', 'Pull request opened: <a href="' + esc(res.pr.html_url) + '" target="_blank" rel="noopener">#' + res.pr.number + ' ↗</a>');
        showDeploy('Proposed changes are waiting for review in <a href="' + esc(res.pr.html_url) + '" target="_blank" rel="noopener">pull request #' + res.pr.number + '</a>. The live site changes once it is merged.', '');
      } else {
        // Our commit is now the branch head: refresh caches to the new shas.
        keys.forEach(function (p) { S.files[p] = S.pending[p].content == null ? null : { content: S.pending[p].content, sha: null }; });
        toast('Published! The site is rebuilding.', 'ok');
        pollDeploy(res.commit.sha);
      }
      S.pending = {}; S.files = {};
      return loadTree().then(reloadSite);
    }).catch(fail).then(function () {
      go.disabled = false; go.textContent = 'Publish'; renderPending();
    });
  }
  function showDeploy(html, cls) { var d = $('#deploy-status'); d.hidden = false; d.className = 'deploy ' + (cls || ''); d.innerHTML = html; }
  function pollDeploy(sha) {
    var actions = 'https://github.com/' + S.cfg.owner + '/' + S.cfg.repo + '/actions';
    var tries = 0;
    clearInterval(S.pollTimer);
    showDeploy('Committed <code>' + sha.slice(0, 7) + '</code>. Waiting for the deploy to start… <a href="' + actions + '" target="_blank" rel="noopener">GitHub Actions ↗</a>');
    function tick() {
      tries++;
      gh(repoPath('/actions/runs?head_sha=' + sha + '&per_page=5')).then(function (j) {
        var runs = (j.workflow_runs || []).filter(function (r) { return /pages|deploy/i.test(r.name || ''); });
        var run = runs[0] || (j.workflow_runs || [])[0];
        if (!run) { if (tries > 30) clearInterval(S.pollTimer); return; }
        var link = ' <a href="' + esc(run.html_url) + '" target="_blank" rel="noopener">details ↗</a>';
        if (run.status !== 'completed') return showDeploy('Deploy <strong>' + esc(run.status.replace('_', ' ')) + '</strong>…' + link);
        clearInterval(S.pollTimer);
        if (run.conclusion === 'success') showDeploy('Deploy finished. <a href="' + siteBase() + '" target="_blank" rel="noopener">View the live site ↗</a>' + link, 'ok');
        else showDeploy('Deploy ended: <strong>' + esc(run.conclusion) + '</strong>.' + link, 'fail');
      }, function (e) {
        clearInterval(S.pollTimer);
        showDeploy('Committed. Deploy status unavailable (' + esc(e.message) + '). <a href="' + actions + '" target="_blank" rel="noopener">Check GitHub Actions ↗</a>');
      });
      if (tries > 60) clearInterval(S.pollTimer);
    }
    S.pollTimer = setInterval(tick, 8000);
    setTimeout(tick, 3000);
  }

  // ---------- login ----------
  function showLogin(err) {
    $('#app').hidden = true; $('#login').hidden = false;
    $('#f-owner').value = S.cfg.owner || 'cyrillemuller';
    $('#f-repo').value = S.cfg.repo || 'pelagos';
    $('#f-branch').value = S.cfg.branch || 'main';
    $('#f-token').value = S.cfg.token || '';
    var e = $('#login-error'); e.hidden = !err; e.textContent = err || '';
  }
  function connect() {
    var btn = $('#login-btn');
    btn.disabled = true; btn.textContent = 'Checking…';
    return gh(repoPath('')).then(function (repo) {
      if (repo.permissions && !repo.permissions.push) toast('This token can read but not write the repository — publishing will fail.', 'err');
      save();
      $('#login').hidden = true; $('#app').hidden = false;
      $('#repo-pill').textContent = S.cfg.owner + '/' + S.cfg.repo + ' @ ' + S.cfg.branch;
      $('#live-link').href = siteBase();
      $$('.js-branch').forEach(function (n) { n.textContent = S.cfg.branch; });
      return loadTree().then(function () { return Promise.all([reloadSite(), renderPages()]); });
    }).catch(function (e) {
      showLogin(e.status === 404 ? 'Repository or branch not found, or the token has no access to it.' : e.message);
    }).then(function () { btn.disabled = false; btn.textContent = 'Connect'; });
  }

  // ---------- sections ----------
  function reloadSite() {
    return current(SITE_JSON).then(function (txt) {
      var notice = $('#sections-notice');
      notice.hidden = true;
      var files = S.tree.filter(function (t) { return t.path.indexOf(SECTIONS_DIR + '/') === 0 && /\.html$/.test(t.path); })
        .map(function (t) { return t.path.slice(SECTIONS_DIR.length + 1); }).sort();
      // also files added in pending
      pendingKeys().forEach(function (p) {
        if (p.indexOf(SECTIONS_DIR + '/') === 0 && S.pending[p].content != null) { var f = p.slice(SECTIONS_DIR.length + 1); if (files.indexOf(f) < 0) files.push(f); }
      });
      var site = null;
      if (txt) { try { site = JSON.parse(txt); } catch (e) { toast('content/site.json is not valid JSON — fix it in the Code editor.', 'err'); } }
      S.siteExists = !!txt;
      if (!site) {
        site = { config: {}, features: {}, sections: files.map(function (f) { return { file: f, enabled: true }; }) };
        notice.hidden = false;
        notice.textContent = 'content/site.json was not found, so sections are listed from src/sections in file order. Reordering, hiding or changing settings will create content/site.json.';
      }
      site.config = site.config || {}; site.features = site.features || {}; site.sections = site.sections || [];
      // sections that exist as files but are not listed in site.json: show at end (disabled)
      files.forEach(function (f) {
        if (!site.sections.some(function (s) { return s.file === f; }) && !(S.pending[SECTIONS_DIR + '/' + f] && S.pending[SECTIONS_DIR + '/' + f].content == null)) {
          site.sections.push({ file: f, enabled: false, _unlisted: true });
        }
      });
      S.site = site;
      renderSections(); renderSettings();
    }).catch(fail);
  }
  function cleanSite() {
    S.site.sections = S.site.sections.map(function (s) { var o = { file: s.file, enabled: s.enabled !== false };
      Object.keys(s).forEach(function (k) { if (k[0] !== '_' && !(k in o)) o[k] = s[k]; }); return o; });
  }
  function commitSections(note) { cleanSite(); stageSite(note); renderSections(); }

  function renderSections() {
    var list = $('#sec-list');
    list.innerHTML = '';
    var secs = S.site.sections;
    secs.forEach(function (s, i) {
      var path = SECTIONS_DIR + '/' + s.file;
      var on = s.enabled !== false;
      var isNew = S.pending[path] && !treeHas(path);
      var toggleId = 'tg-' + i;
      var li = el('li', { class: 'sec-item' + (on ? '' : ' is-off'), draggable: 'true', 'data-i': i, tabindex: '-1' }, [
        el('span', { class: 'grip', 'aria-hidden': 'true', title: 'Drag to reorder', text: '⋮⋮' }),
        el('div', {}, [
          el('div', { class: 'sec-name' }, [prettyName(s.file), isNew ? el('span', { class: 'sec-tag', text: 'NEW' }) : null,
            S.pending[path] && !isNew ? el('span', { class: 'sec-tag', text: 'EDITED' }) : null,
            s._unlisted ? el('span', { class: 'sec-tag', text: 'NOT IN site.json' }) : null]),
          el('div', { class: 'sec-file', text: s.file })
        ]),
        el('div', { class: 'sec-ctrls' }, [
          el('label', { class: 'switch', for: toggleId }, [
            el('input', { type: 'checkbox', id: toggleId, checked: on, onchange: function (e) { s.enabled = e.target.checked; delete s._unlisted; commitSections(); toast(prettyName(s.file) + (s.enabled ? ' shown' : ' hidden')); } }),
            el('span', { class: 'track', 'aria-hidden': 'true' }), el('span', { class: 'visually-hidden', text: 'Show ' + prettyName(s.file) + ' on the page' }),
            el('span', { 'aria-hidden': 'true', text: on ? 'Visible' : 'Hidden' })
          ]),
          el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move ' + prettyName(s.file) + ' up', disabled: i === 0, text: '↑', onclick: function () { move(i, i - 1); } }),
          el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move ' + prettyName(s.file) + ' down', disabled: i === secs.length - 1, text: '↓', onclick: function () { move(i, i + 1); } }),
          el('button', { class: 'btn btn-sm', type: 'button', text: 'Edit', onclick: function () { openEditor(path); } }),
          el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Duplicate', onclick: function () { duplicate(i); } }),
          el('button', { class: 'btn btn-sm btn-ghost btn-danger', type: 'button', text: 'Delete', onclick: function () { removeSection(i); } })
        ])
      ]);
      li.addEventListener('keydown', function (e) {
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); move(i, e.key === 'ArrowUp' ? i - 1 : i + 1, true); }
      });
      li.addEventListener('dragstart', function (e) { li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); });
      li.addEventListener('dragend', function () { li.classList.remove('dragging'); });
      li.addEventListener('dragover', function (e) {
        e.preventDefault();
        var after = e.offsetY > li.offsetHeight / 2;
        li.classList.toggle('drop-after', after); li.classList.toggle('drop-before', !after);
      });
      li.addEventListener('dragleave', function () { li.classList.remove('drop-after', 'drop-before'); });
      li.addEventListener('drop', function (e) {
        e.preventDefault();
        var from = +e.dataTransfer.getData('text/plain'), after = li.classList.contains('drop-after');
        li.classList.remove('drop-after', 'drop-before');
        var to = i + (after ? 1 : 0); if (from < to) to--;
        if (!isNaN(from) && from !== to) move(from, to);
      });
      list.appendChild(li);
    });
  }
  function move(from, to, keepFocus) {
    var secs = S.site.sections;
    if (to < 0 || to >= secs.length) return;
    secs.splice(to, 0, secs.splice(from, 1)[0]);
    commitSections('Section order');
    var row = $('#sec-list').children[to];
    if (row) (keepFocus ? row : (row.querySelector('.icon-btn:not(:disabled)') || row)).focus();
  }
  function uniqueFile(afterIdx, name) {
    var prev = S.site.sections[afterIdx];
    var base = prev ? (prev.file.match(/^(\d+)/) || [, '50'])[1] : '50';
    var taken = function (f) { return S.site.sections.some(function (s) { return s.file === f; }) || treeHas(SECTIONS_DIR + '/' + f); };
    var letters = 'bcdefghijklmnopqrstuvwxyz';
    for (var i = 0; i < letters.length; i++) { var f = base + letters[i] + '-' + name + '.html'; if (!taken(f)) return f; }
    return base + 'z-' + name + '-' + Date.now() + '.html';
  }
  function duplicate(i) {
    var s = S.site.sections[i];
    current(SECTIONS_DIR + '/' + s.file).then(function (html) {
      var nm = slug(prettyName(s.file)) + '-copy';
      var file = uniqueFile(i, nm);
      // Rename ids so anchors stay unique
      html = html.replace(/\b(id|aria-labelledby|aria-describedby|aria-controls|for)="([^"]+)"/g, function (m, a, v) {
        return a + '="' + v.split(' ').map(function (x) { return x + '-copy'; }).join(' ') + '"';
      });
      stage(SECTIONS_DIR + '/' + file, html, 'Duplicate of ' + s.file);
      S.site.sections.splice(i + 1, 0, { file: file, enabled: false });
      commitSections('Duplicate section');
      toast('Duplicated as ' + file + ' (hidden until you enable it).');
    }).catch(fail);
  }
  function removeSection(i) {
    var s = S.site.sections[i];
    if (!confirm('Delete the section “' + prettyName(s.file) + '”?\n\nThe file ' + s.file + ' will be removed when you publish. Tip: use the toggle instead to just hide it.')) return;
    var path = SECTIONS_DIR + '/' + s.file;
    S.site.sections.splice(i, 1);
    if (treeHas(path)) stage(path, null, 'Delete section'); else { delete S.pending[path]; renderPending(); }
    commitSections('Remove section');
    toast('Section removed (pending).');
  }

  // ---------- templates ----------
  var TEMPLATES = {
    textimage: { label: 'Text + image', html: function (id, t) {
      return '<section class="section ' + id + '" id="' + id + '" aria-labelledby="' + id + '-title">\n  <div class="container">\n    <div class="grid grid-2 ' + id + '-grid">\n      <div class="' + id + '-text reveal">\n        <span class="eyebrow">' + t + '</span>\n        <h2 id="' + id + '-title">A clear headline for this section</h2>\n        <p class="lead">One or two sentences that explain why this matters to the reader.</p>\n        <p>Supporting paragraph. Keep it factual and specific.</p>\n        <a class="btn btn--primary" href="#contact">Get in touch</a>\n      </div>\n      <figure class="' + id + '-media reveal" data-delay="1">\n        <img src="images/og-image.png" alt="Describe the image" loading="lazy" width="1200" height="630" style="width:100%;height:auto;border-radius:var(--radius)" />\n      </figure>\n    </div>\n  </div>\n</section>\n';
    } },
    cards: { label: 'Cards grid', html: function (id, t) {
      var card = function (n) { return '      <article class="card card--hover reveal" data-delay="' + (n - 1) + '">\n        <h3>Card title ' + n + '</h3>\n        <p>Short description of this item.</p>\n      </article>\n'; };
      return '<section class="section section--alt ' + id + '" id="' + id + '" aria-labelledby="' + id + '-title">\n  <div class="container">\n    <header class="section-head reveal">\n      <span class="eyebrow">' + t + '</span>\n      <h2 id="' + id + '-title">Section headline</h2>\n      <p class="lead">Introduce the cards below.</p>\n    </header>\n    <div class="grid grid-3">\n' + card(1) + card(2) + card(3) + '    </div>\n  </div>\n</section>\n';
    } },
    cta: { label: 'Call-to-action band', html: function (id) {
      return '<section class="section section--dark ' + id + '" id="' + id + '" aria-labelledby="' + id + '-title">\n  <div class="container">\n    <header class="section-head section-head--center reveal">\n      <h2 id="' + id + '-title">Ready to talk about your programme?</h2>\n      <p class="lead">A short, no-obligation call to see whether I can help.</p>\n      <p><a class="btn btn--accent" href="#contact">Book a call</a></p>\n    </header>\n  </div>\n</section>\n';
    } },
    testimonials: { label: 'Testimonials (empty — real, attributed quotes only)', disabled: true, html: function (id, t) {
      return '<section class="section ' + id + '" id="' + id + '" aria-labelledby="' + id + '-title">\n  <div class="container">\n    <header class="section-head section-head--center reveal">\n      <span class="eyebrow">' + t + '</span>\n      <h2 id="' + id + '-title">What clients say</h2>\n    </header>\n    <div class="grid grid-2">\n      <!-- Add ONLY real quotes, with the person\'s permission. Copy this block per quote:\n      <figure class="card reveal">\n        <blockquote><p>Quote text.</p></blockquote>\n        <figcaption><strong>Name</strong>, Role, Organisation</figcaption>\n      </figure>\n      -->\n    </div>\n  </div>\n</section>\n';
    } },
    faq: { label: 'FAQ list', html: function (id, t) {
      var q = function (n) { return '      <details class="card reveal">\n        <summary><strong>Question ' + n + '?</strong></summary>\n        <p>Answer ' + n + '.</p>\n      </details>\n'; };
      return '<section class="section ' + id + '" id="' + id + '" aria-labelledby="' + id + '-title">\n  <div class="container">\n    <header class="section-head reveal">\n      <span class="eyebrow">' + t + '</span>\n      <h2 id="' + id + '-title">Frequently asked questions</h2>\n    </header>\n    <div style="display:grid;gap:12px;max-width:820px">\n' + q(1) + q(2) + q(3) + '    </div>\n  </div>\n</section>\n';
    } }
  };
  function openAdd() {
    var fs = $('#add-templates');
    $$('label', fs).forEach(function (n) { n.remove(); });
    Object.keys(TEMPLATES).forEach(function (k, i) {
      fs.appendChild(el('label', {}, [el('input', { type: 'radio', name: 'tpl', value: k, checked: i === 0 }), el('span', { text: TEMPLATES[k].label })]));
    });
    var sel = $('#add-after'); sel.innerHTML = '';
    S.site.sections.forEach(function (s, i) { sel.appendChild(el('option', { value: i, text: prettyName(s.file) + ' (' + s.file + ')' })); });
    var footer = S.site.sections.findIndex(function (s) { return /footer/.test(s.file); });
    sel.value = String(footer > 0 ? footer - 1 : S.site.sections.length - 1);
    $('#add-name').value = '';
    $('#add-dialog').showModal();
  }
  function doAdd() {
    var name = $('#add-name').value.trim();
    if (!name) { toast('Please give the section a name.', 'err'); return false; }
    var id = slug(name), tplKey = ($('input[name=tpl]:checked') || {}).value || 'textimage', tpl = TEMPLATES[tplKey];
    if (S.site.sections.some(function (s) { return s.file.replace(/^\d+[a-z]?-/, '').replace(/\.html$/, '') === id; })) id += '-2';
    var after = +$('#add-after').value;
    var file = uniqueFile(after, id);
    stage(SECTIONS_DIR + '/' + file, tpl.html(id, esc(name)), 'New section');
    S.site.sections.splice(after + 1, 0, { file: file, enabled: !tpl.disabled });
    commitSections('Add section');
    toast('Added ' + file + (tpl.disabled ? ' (hidden until you add real quotes)' : '') + '. Opening editor…');
    openEditor(SECTIONS_DIR + '/' + file);
    return true;
  }

  // ---------- editor ----------
  function cssLinks() {
    var base = siteBase();
    var css = S.tree.filter(function (t) { return /^src\/css\/[^/]+\.css$/.test(t.path); }).map(function (t) { return t.path.slice(8); }).sort();
    if (!css.length) css = ['00-tokens.css'];
    return '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
      css.map(function (f) { return '<link rel="stylesheet" href="' + base + 'css/' + f + '">'; }).join('');
  }
  function fragmentDoc(html, editing) {
    return '<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><base href="' + siteBase() + '">' + cssLinks() +
      '<style>.reveal{opacity:1!important;transform:none!important}' +
      (editing ? '[data-pg-edit]:hover{outline:1px dashed #0e8a8f;outline-offset:2px}[data-pg-edit]:focus{outline:2px solid #0e8a8f;outline-offset:2px}img{cursor:pointer}img:hover{outline:3px solid #d99a2b}' : '') +
      '</style></head><body><main id="pg-root">' + html + '</main></body></html>';
  }
  var EDITABLE = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,figcaption,summary,label,legend,th,td,caption,a,button,span,strong,em,small';
  function renderVisual(html) {
    var frame = $('#visual');
    frame.onload = function () {
      var doc = frame.contentDocument; if (!doc) return;
      var root = doc.getElementById('pg-root');
      $$(EDITABLE, root).forEach(function (n) {
        if (n.closest('svg,script,style,template')) return;
        var p = n.parentElement && n.parentElement.closest(EDITABLE);
        if (p && root.contains(p)) return; // ancestor already editable
        if (!n.textContent.trim()) return;
        n.setAttribute('contenteditable', 'true'); n.setAttribute('data-pg-edit', ''); n.setAttribute('spellcheck', 'true');
      });
      root.addEventListener('input', function () { S.editor.visualDirty = true; });
      root.addEventListener('click', function (e) {
        var a = e.target.closest('a,button'); if (a) e.preventDefault();
        if (e.target.tagName === 'IMG') { e.preventDefault(); editImage(e.target); }
      });
      root.addEventListener('submit', function (e) { e.preventDefault(); });
      root.addEventListener('keydown', function (e) {
        // Enter in buttons/links would create stray markup: treat as line break only in block text
        if (e.key === 'Enter' && e.target.closest && e.target.closest('a,button,h1,h2,h3,h4,h5,h6,summary,span,label')) e.preventDefault();
      });
    };
    frame.srcdoc = fragmentDoc(html, true);
  }
  function editImage(img) {
    var d = $('#img-dialog');
    $('#img-src').value = img.getAttribute('src') || '';
    $('#img-alt').value = img.getAttribute('alt') || '';
    d._img = img; d.showModal(); $('#img-src').focus();
  }
  function serializeVisual() {
    var doc = $('#visual').contentDocument, root = doc && doc.getElementById('pg-root');
    if (!root) return S.editor.visualBase;
    var clone = root.cloneNode(true);
    $$('[data-pg-edit]', clone).forEach(function (n) { n.removeAttribute('contenteditable'); n.removeAttribute('data-pg-edit'); n.removeAttribute('spellcheck'); });
    return clone.innerHTML.trim() + '\n';
  }
  function editorValue() {
    if (S.editor.mode === 'code') return $('#code').value;
    return S.editor.visualDirty ? serializeVisual() : S.editor.visualBase;
  }
  function editorDirty() { return S.editor.path && editorValue() !== S.editor.current; }
  function openEditor(path) {
    if (S.editor.path && S.editor.path !== path && editorDirty() && !confirm('You have unsaved edits in ' + S.editor.path + '. Discard them?')) return;
    selectTab('editor');
    $('#editor-title').textContent = 'Loading…';
    return current(path).then(function (txt) {
      var frag = path.indexOf(SECTIONS_DIR + '/') === 0;
      S.editor = { path: path, current: txt, visualBase: txt, mode: frag ? 'visual' : 'code', visualDirty: false, isFragment: frag };
      $('#editor-title').textContent = frag ? prettyName(path.split('/').pop()) : path.replace(/^public\//, '');
      $('#editor-path').textContent = path + (S.pending[path] ? ' — has pending changes' : '');
      $('#mode-visual').disabled = !frag;
      $('#preview-section-btn').textContent = frag ? 'Preview this section ↗' : 'Open live page ↗';
      $('#code').value = txt;
      setMode(S.editor.mode, true);
    }).catch(fail);
  }
  function setMode(mode, fresh) {
    if (!S.editor.path) return;
    if (!fresh && mode === S.editor.mode) return;
    if (!fresh && mode === 'code') $('#code').value = editorValue(); // still in visual: serialize
    S.editor.mode = mode;
    $('#mode-visual').setAttribute('aria-pressed', String(mode === 'visual'));
    $('#mode-code').setAttribute('aria-pressed', String(mode === 'code'));
    $('#code').hidden = mode !== 'code'; $('#visual').hidden = mode !== 'visual'; $('#visual-hint').hidden = mode !== 'visual';
    if (mode === 'visual') {
      S.editor.visualBase = $('#code').value; // what the visual view shows until edited
      S.editor.visualDirty = false;
      renderVisual(S.editor.visualBase);
    }
  }
  function stageEditor() {
    if (!S.editor.path) return;
    var v = editorValue();
    if (S.editor.path === SITE_JSON) { try { JSON.parse(v); } catch (e) { toast('Invalid JSON: ' + e.message, 'err'); return; } }
    stage(S.editor.path, v, 'Edited');
    S.editor.current = v; $('#code').value = v;
    if (S.editor.mode === 'visual') { S.editor.visualBase = v; S.editor.visualDirty = false; }
    $('#editor-path').textContent = S.editor.path + (S.pending[S.editor.path] ? ' — has pending changes' : '');
    if (S.editor.path === SITE_JSON) reloadSite(); else renderSections();
    toast(S.pending[S.editor.path] ? 'Saved to pending changes. Publish when ready.' : 'No changes compared to the published version.');
  }
  function previewSection() {
    if (!S.editor.path) return;
    if (!S.editor.isFragment) {
      var rel = S.editor.path.replace(/^public\//, '');
      return window.open(siteBase() + rel, '_blank', 'noopener');
    }
    var blob = new Blob([fragmentDoc(editorValue(), false)], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  }

  // ---------- settings ----------
  function renderSettings() {
    var cf = $('#config-fields'), ff = $('#feature-fields');
    cf.innerHTML = ''; ff.innerHTML = '';
    $('#settings-notice').hidden = S.siteExists;
    $('#settings-notice').textContent = 'content/site.json does not exist yet; saving here will create it.';
    CONFIG_FIELDS.forEach(function (f) {
      cf.appendChild(el('label', {}, [f[1], el('input', { name: f[0], type: f[2] || 'text', value: S.site.config[f[0]] || '', autocomplete: 'off' })]));
    });
    FEATURES.forEach(function (f) {
      var id = 'ft-' + f[0];
      ff.appendChild(el('label', { class: 'switch', for: id }, [
        el('input', { type: 'checkbox', id: id, name: f[0], checked: !!S.site.features[f[0]] }),
        el('span', { class: 'track', 'aria-hidden': 'true' }), el('span', { text: f[1] })
      ]));
    });
  }
  function stageSettings() {
    CONFIG_FIELDS.forEach(function (f) { S.site.config[f[0]] = $('#config-fields [name=' + f[0] + ']').value.trim(); });
    FEATURES.forEach(function (f) { S.site.features[f[0]] = $('#ft-' + f[0]).checked; });
    cleanSite(); stageSite('Settings');
    toast(S.pending[SITE_JSON] ? 'Settings saved to pending changes.' : 'Settings unchanged.');
  }

  // ---------- other pages ----------
  function renderPages() {
    var ul = $('#page-list'); ul.innerHTML = '';
    var pages = S.tree.filter(function (t) { return /^public\/.+\.html$/.test(t.path) && t.path.indexOf('public/admin/') !== 0; })
      .map(function (t) { return t.path; }).sort();
    pages.push(SITE_JSON);
    pages.forEach(function (p) {
      if (p === SITE_JSON && !treeHas(p)) return;
      ul.appendChild(el('li', {}, [el('code', { text: p.replace(/^public\//, '') }),
        el('button', { class: 'btn btn-sm', type: 'button', text: 'Edit', 'aria-label': 'Edit ' + p, onclick: function () { openEditor(p); } })]));
    });
    if (!pages.length) ul.appendChild(el('li', { text: 'No pages found.' }));
  }

  // ---------- tabs ----------
  function selectTab(name) {
    $$('.tabs [role=tab]').forEach(function (t) {
      var on = t.id === 'tab-' + name;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
  }

  // ---------- wiring ----------
  function init() {
    $$('.tabs [role=tab]').forEach(function (t, i, all) {
      t.addEventListener('click', function () { selectTab(t.id.slice(4)); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { var n = all[(i + d + all.length) % all.length]; n.focus(); n.click(); }
      });
    });
    selectTab('sections');
    $$('dialog [data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('dialog').close(); }); });

    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      S.cfg = { owner: $('#f-owner').value.trim(), repo: $('#f-repo').value.trim(), branch: $('#f-branch').value.trim() || 'main', token: $('#f-token').value.trim() };
      if (!S.cfg.token) return showLogin('Please paste your personal access token.');
      connect();
    });
    $('#forget-btn').addEventListener('click', function () { S.cfg.token = ''; save(); $('#f-token').value = ''; toast('Token removed from this browser.'); });
    $('#logout-btn').addEventListener('click', function () {
      if (pendingKeys().length && !confirm('You have unpublished changes. Log out and lose them?')) return;
      S.cfg.token = ''; save(); S.pending = {}; S.files = {}; renderPending(); showLogin();
    });
    $('#pending-btn').addEventListener('click', function () { renderPending(); $('#pending-dialog').showModal(); });
    $('#publish-btn').addEventListener('click', function () {
      if (editorDirty() && confirm('The editor has edits not yet saved to pending. Include them?')) stageEditor();
      var ul = $('#publish-summary'); ul.innerHTML = '';
      pendingKeys().forEach(function (p) { var k = kindOf(p); ul.appendChild(el('li', {}, [el('span', {}, [el('span', { class: 'kind kind-' + k[0], text: k[1] }), el('code', { text: p })])])); });
      $('#publish-dialog').showModal();
    });
    $('#publish-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var mode = $('input[name=mode]:checked').value, msg = $('#commit-msg').value.trim() || 'Content update via admin';
      publish(mode, msg);
    });
    $('#add-section-btn').addEventListener('click', openAdd);
    $('#add-form').addEventListener('submit', function (e) { e.preventDefault(); if (doAdd()) $('#add-dialog').close(); });
    $('#img-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var d = $('#img-dialog'), img = d._img;
      if (img) { img.setAttribute('src', $('#img-src').value.trim()); img.setAttribute('alt', $('#img-alt').value); img.removeAttribute('srcset'); var pic = img.closest('picture'); if (pic) $$('source', pic).forEach(function (s) { s.remove(); }); S.editor.visualDirty = true; }
      d.close();
    });
    $('#mode-visual').addEventListener('click', function () { setMode('visual'); });
    $('#mode-code').addEventListener('click', function () { setMode('code'); });
    $('#stage-btn').addEventListener('click', stageEditor);
    $('#revert-btn').addEventListener('click', function () {
      if (!S.editor.path) return;
      if (!confirm('Revert the editor to the last saved version?')) return;
      $('#code').value = S.editor.current; S.editor.visualDirty = false; setMode(S.editor.mode, true);
    });
    $('#preview-section-btn').addEventListener('click', previewSection);
    $('#settings-stage-btn').addEventListener('click', stageSettings);
    $('#code').addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) { // indent; Esc then Tab leaves the box
        if (this._esc) { this._esc = false; return; }
        e.preventDefault(); var s = this.selectionStart; this.setRangeText('  ', s, this.selectionEnd, 'end');
      } else if (e.key === 'Escape') this._esc = true;
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !$('#app').hidden) { e.preventDefault(); if (S.editor.path && !$('#panel-editor').hidden) stageEditor(); }
    });
    window.addEventListener('beforeunload', function (e) {
      if (pendingKeys().length || editorDirty()) { e.preventDefault(); e.returnValue = ''; }
    });
    renderPending();
    if (S.cfg.token) { showLogin(); connect(); } else showLogin();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
