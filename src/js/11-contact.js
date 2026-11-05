/* 11 — Contact: form validation + submission, service/assessment prefill, local-time widget. */
(function () {
  'use strict';
  var PG = window.PG || {};
  var cfg = PG.config || {};
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var DRAFT_KEY = 'pg-contact-draft';
  var MAX = 2000;
  var MIN_MSG = 20;

  function init() {
    var section = document.getElementById('contact');
    if (!section) return;
    var form = $('#contact-form', section);
    var successPanel = $('[data-contact-success]', section);
    var msg = $('#contact-message', form);
    var serviceSel = $('#contact-service', form);
    var counter = $('[data-contact-count]', form);
    var summary = $('[data-contact-summary]', form);
    var live = $('[data-contact-live]', form);
    var submitBtn = $('[data-contact-submit]', form);
    var submitText = $('[data-contact-submit-text]', form);
    var attachedWrap = $('[data-contact-attached]', form);
    var attachedText = $('[data-contact-attached-text]', form);
    var assessment = null;

    /* ---------- Config-driven details ---------- */
    var email = cfg.email || 'hello@pelagos.global';
    var emailLink = $('[data-contact-email]', section);
    emailLink.href = 'mailto:' + email;
    emailLink.textContent = email;
    if (cfg.linkedin) $('[data-contact-linkedin]', section).href = cfg.linkedin;
    if (cfg.location) $('[data-contact-location]', section).textContent = cfg.location;

    var book = $('[data-contact-book]', section);
    var bookingUrl = cfg.bookingUrl || '#contact';
    var bookingInternal = bookingUrl.charAt(0) === '#';
    if (!bookingInternal) {
      book.href = bookingUrl;
      book.target = '_blank';
      book.rel = 'noopener';
      book.insertAdjacentHTML('beforeend', '<span class="visually-hidden"> (opens in a new tab)</span>');
    } else {
      book.addEventListener('click', function (e) {
        e.preventDefault();
        if (!form.hidden) focusForm('#contact-name');
      });
    }

    /* ---------- Copy email ---------- */
    $('[data-contact-copy]', section).addEventListener('click', function () {
      var done = function () { toast('Email address copied'); };
      var fallback = function () {
        try {
          var ta = document.createElement('textarea');
          ta.value = email; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          var ok = document.execCommand('copy'); ta.remove();
          ok ? done() : toast('Copy failed: ' + email);
        } catch (err) { toast('Copy failed: ' + email); }
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(email).then(done, fallback);
      else fallback();
    });

    function toast(t) { if (typeof PG.toast === 'function') PG.toast(t); }

    /* ---------- Character counter ---------- */
    function updateCount() {
      var n = msg.value.length;
      counter.textContent = n + ' / ' + MAX;
      counter.classList.toggle('is-near', n >= MAX * 0.9 && n <= MAX);
      counter.classList.toggle('is-over', n > MAX);
    }

    /* ---------- Validation ---------- */
    var rules = {
      'contact-name': function (el) { return el.value.trim().length >= 2 ? '' : 'Please enter your name.'; },
      'contact-email': function (el) {
        var v = el.value.trim();
        if (!v) return 'Please enter your email address.';
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Please enter a valid email, e.g. name@company.com.';
      },
      'contact-org': function (el) { return el.value.trim() ? '' : 'Please tell me which organization you represent.'; },
      'contact-orgtype': function (el) { return el.value ? '' : 'Please choose an organization type.'; },
      'contact-service': function (el) { return el.value ? '' : 'Please choose the service you are interested in.'; },
      'contact-message': function (el) {
        var v = el.value.trim();
        if (!v) return 'Please add a short message.';
        if (v.length < MIN_MSG) return 'Please add a little more detail (at least ' + MIN_MSG + ' characters).';
        return v.length > MAX ? 'Please keep your message under ' + MAX + ' characters.' : '';
      },
      'contact-consent': function (el) { return el.checked ? '' : 'Please confirm you agree so I can reply.'; }
    };

    function setError(el, text) {
      var err = document.getElementById(el.id + '-err');
      if (text) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      if (err) err.textContent = text;
    }
    function validateField(el) {
      var rule = rules[el.id];
      if (!rule) return true;
      var text = rule(el);
      setError(el, text);
      return !text;
    }
    function validateAll() {
      var invalid = [];
      Object.keys(rules).forEach(function (id) {
        var el = document.getElementById(id);
        if (el && !validateField(el)) invalid.push(el);
      });
      return invalid;
    }

    form.addEventListener('blur', function (e) {
      var t = e.target;
      if (rules[t.id] && (t.value || t.hasAttribute('aria-invalid'))) validateField(t);
    }, true);
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t === msg) updateCount();
      if (t.hasAttribute('aria-invalid')) validateField(t);
      saveDraft();
    });
    form.addEventListener('change', function (e) {
      if (e.target.hasAttribute('aria-invalid')) validateField(e.target);
      saveDraft();
    });

    /* ---------- Draft persistence ---------- */
    var draftFields = ['name', 'email', 'organization', 'role', 'orgType', 'service', 'timeline', 'budget', 'message'];
    var saveTimer;
    function saveDraft() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        try {
          var d = {};
          draftFields.forEach(function (n) { d[n] = form.elements[n].value; });
          if (assessment) d.assessment = assessment;
          localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
        } catch (e) { /* storage unavailable */ }
      }, 250);
    }
    function loadDraft() {
      try {
        var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (!d) return;
        draftFields.forEach(function (n) { if (d[n] && form.elements[n]) form.elements[n].value = d[n]; });
        if (d.assessment) showAssessment(d.assessment);
      } catch (e) { /* ignore */ }
    }
    function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }

    /* ---------- Service preselect ---------- */
    // Events/links use different vocabularies (services cards, assessment, future sections), so we match
    // by: 1) alias slug map, 2) exact slug/label, 3) weighted word overlap in both directions.
    var SLUG_ALIASES = {
      'healthcare-intelligence': 'global-healthcare-intelligence',
      'country-health-surveillance': 'global-healthcare-intelligence',
      'health-intelligence': 'global-healthcare-intelligence',
      'quality-assessment': 'provider-transport-quality-assessment',
      'provider-quality-assessment': 'provider-transport-quality-assessment',
      'aeromedical-strategy': 'aeromedical-medical-escort-strategy',
      'aeromedical': 'aeromedical-medical-escort-strategy',
      'medical-logistics': 'medical-logistics-repatriation',
      'repatriation': 'medical-logistics-repatriation',
      'emergency-response': 'medical-emergency-response-plans',
      'emergency-response-plans': 'medical-emergency-response-plans',
      'merp': 'medical-emergency-response-plans',
      'duty-of-care': 'duty-of-care-travel-risk',
      'travel-risk': 'duty-of-care-travel-risk',
      'ethics': 'ethics-compliance',
      'crisis-response': 'crisis-outbreak-response',
      'outbreak-response': 'crisis-outbreak-response',
      'provider-networks': 'provider-network-development',
      'provider-network': 'provider-network-development',
      'fractional-leadership': 'speaking-advisory-board',
      'advisory-board': 'speaking-advisory-board',
      'speaking': 'speaking-advisory-board'
    };
    // Engagement tiers are not services: they prefill a note (and budget for retainers) instead.
    var ENGAGEMENTS = {
      'expert-call': { label: 'Advisory hour / Expert call' },
      'project': { label: 'Project engagement' },
      'retainer': { label: 'Retainer / Fractional Director', budget: 'Retainer / ongoing' }
    };
    var STOP = { and: 1, the: 1, of: 1, for: 1, in: 1, a: 1, an: 1, to: 1, with: 1, program: 1, programs: 1, service: 1, services: 1 };
    var WEAK = { medical: 1, health: 1, plan: 1, planning: 1, development: 1 };
    function norm(s) { return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim(); }
    function slugify(s) { return norm(s).replace(/ /g, '-'); }
    function words(s) {
      return norm(s).split(' ').filter(function (w) { return w && !STOP[w]; })
        .map(function (w) { return w.length > 4 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w; });
    }
    function findOption(query, exactOnly) {
      var opts = Array.prototype.slice.call(serviceSel.options, 1);
      var slug = slugify(query);
      if (SLUG_ALIASES[slug]) slug = SLUG_ALIASES[slug];
      var q = norm(query);
      var exact = opts.filter(function (o) {
        return o.getAttribute('data-slug') === slug || norm(o.textContent) === q;
      })[0];
      if (exact || exactOnly) return exact || null;
      var qw = words(query);
      if (!qw.length) return null;
      var best = null, bestScore = 0;
      opts.forEach(function (o) {
        if (o.getAttribute('data-slug') === 'other') return;
        var ow = words(o.textContent + ' ' + (o.getAttribute('data-slug') || '').replace(/-/g, ' '));
        var seen = {}, score = 0, strong = 0;
        qw.forEach(function (w) {
          if (seen[w] || ow.indexOf(w) === -1) return;
          seen[w] = 1;
          score += WEAK[w] ? 0.5 : 1;
          if (!WEAK[w]) strong++;
        });
        if (!strong) return;
        // Coverage in both directions breaks ties (query in option, option in query)
        var uniq = ow.filter(function (w, i) { return ow.indexOf(w) === i; }).length;
        score += 0.25 * (Object.keys(seen).length / qw.length) + 0.25 * (Object.keys(seen).length / uniq);
        if (score > bestScore) { bestScore = score; best = o; }
      });
      return best;
    }
    function applyEngagement(key) {
      var eng = ENGAGEMENTS[slugify(key)];
      if (!eng) return false;
      var line = 'Engagement model of interest: ' + eng.label + '\n';
      msg.value = (line + msg.value.replace(/^Engagement model of interest: .*\n/m, '')).slice(0, MAX);
      updateCount();
      var budget = form.elements.budget;
      if (eng.budget && budget && !budget.value) budget.value = eng.budget;
      saveDraft();
      return true;
    }
    function setService(o) {
      serviceSel.value = o.value;
      setError(serviceSel, '');
      saveDraft();
      return true;
    }
    function selectService(query) {
      if (!query) return false;
      if (applyEngagement(query)) return true;
      var match = findOption(query);
      return match ? setService(match) : false;
    }
    var lastEvent = null;
    document.addEventListener('pg:select-service', function (e) {
      var d = e.detail || {};
      var label = d.service || d.label;
      var ok = false;
      if (d.slug && applyEngagement(d.slug)) ok = true;
      else {
        // Known slug first, then the human label (fuzzy), then the slug words (fuzzy)
        var match = (d.slug && findOption(d.slug, true)) || (label && findOption(label)) || (d.slug && findOption(d.slug));
        if (match) ok = setService(match);
      }
      lastEvent = d.slug ? slugify(d.slug) : null;
      if (ok) showForm();
    });
    PG.contactSelectService = selectService;
    function readHash() {
      var h = location.hash || '';
      var m = /^#contact\?(.*)$/.exec(h);
      if (!m) return;
      var params = new URLSearchParams(m[1]);
      var svc = params.get('service');
      // Skip if a pg:select-service event already handled this exact slug (avoids double prefill)
      if (svc && slugify(svc) === lastEvent) { lastEvent = null; return; }
      if (svc && selectService(svc)) {
        showForm();
        section.scrollIntoView({ behavior: PG.reducedMotion ? 'auto' : 'smooth' });
      }
    }
    window.addEventListener('hashchange', readHash);

    /* ---------- Assessment prefill ---------- */
    function showAssessment(a) {
      assessment = a;
      var label = 'Readiness check attached: ' + (a.level || 'Result') +
        (typeof a.score === 'number' || a.score ? ' (' + a.score + '/100)' : '');
      attachedText.textContent = label;
      attachedWrap.hidden = false;
    }
    document.addEventListener('pg:assessment-result', function (e) {
      var d = e.detail || {};
      showAssessment({ score: d.score, level: d.level, summary: d.summary || '' });
      if (d.summary) {
        var prefix = 'My duty-of-care readiness check (' + (d.level || '') + ', ' + d.score + '/100):\n' + d.summary + '\n\n';
        var existing = msg.value.replace(/^My duty-of-care readiness check[\s\S]*?\n\n/, '');
        msg.value = (prefix + existing).slice(0, MAX);
        updateCount();
        if (msg.hasAttribute('aria-invalid')) validateField(msg);
      }
      if (!serviceSel.value) selectService('Duty of Care');
      showForm();
      saveDraft();
    });
    $('[data-contact-attached-remove]', form).addEventListener('click', function () {
      assessment = null;
      attachedWrap.hidden = true;
      msg.value = msg.value.replace(/^My duty-of-care readiness check[\s\S]*?\n\n/, '');
      updateCount();
      saveDraft();
      msg.focus();
    });

    /* ---------- Submit ---------- */
    function setLoading(on) {
      submitBtn.disabled = on;
      submitBtn.classList.toggle('is-loading', on);
      submitBtn.setAttribute('aria-busy', on ? 'true' : 'false');
      submitText.textContent = on ? 'Sending…' : 'Send message';
    }
    function collect() {
      var data = {};
      draftFields.forEach(function (n) { data[n] = form.elements[n].value.trim(); });
      data.consent = form.elements.consent.checked;
      if (assessment) data.assessment = assessment;
      data.page = location.href.split('#')[0];
      data.submittedAt = new Date().toISOString();
      return data;
    }
    function buildMailto(d) {
      var subject = 'Enquiry: ' + (d.service || 'Consulting') + ' (' + d.organization + ')';
      var lines = [
        d.message, '',
        '---',
        'Name: ' + d.name,
        'Email: ' + d.email,
        'Organization: ' + d.organization + (d.orgType ? ' (' + d.orgType + ')' : ''),
        d.role ? 'Role: ' + d.role : '',
        'Service: ' + d.service,
        d.timeline ? 'Timeline: ' + d.timeline : '',
        d.budget ? 'Budget: ' + d.budget : '',
        d.assessment ? 'Readiness check: ' + d.assessment.level + ' (' + d.assessment.score + '/100)' : ''
      ].filter(function (l, i) { return i < 3 || l; });
      return 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
    }
    function showSuccess(viaMail, firstName) {
      $('[data-contact-success-title]', successPanel).textContent = viaMail
        ? 'Almost there: your email is ready'
        : 'Thank you' + (firstName ? ', ' + firstName : '') + '. Message received';
      $('[data-contact-success-text]', successPanel).innerHTML = viaMail
        ? 'Your email app should have opened with your message pre-filled. Please press <strong>Send</strong> there. ' +
          'If nothing opened, write directly to <a href="mailto:' + email + '">' + email + '</a>.'
        : 'I personally read every enquiry and will reply within 2 business days.';
      form.hidden = true;
      successPanel.hidden = false;
      successPanel.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      live.textContent = ''; live.classList.remove('is-error');
      var invalid = validateAll();
      if (invalid.length) {
        summary.hidden = false;
        summary.textContent = invalid.length === 1
          ? 'Please fix 1 field before sending.'
          : 'Please fix ' + invalid.length + ' fields before sending.';
        invalid[0].focus();
        return;
      }
      summary.hidden = true;
      summary.textContent = '';

      // Honeypot: silently pretend success for bots
      if (form.elements.website.value) { showSuccess(false); return; }

      var data = collect();
      var firstName = data.name.split(/\s+/)[0];
      setLoading(true);

      if (cfg.formEndpoint) {
        fetch(cfg.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data)
        }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          setLoading(false);
          clearDraft();
          showSuccess(false, firstName);
        }).catch(function () {
          setLoading(false);
          live.classList.add('is-error');
          live.innerHTML = 'Sorry, the message could not be sent. Your draft is saved. Please try again or email ' +
            '<a href="' + buildMailto(data) + '">' + email + '</a>.';
        });
      } else {
        setTimeout(function () {
          window.location.href = buildMailto(data);
          setLoading(false);
          clearDraft();
          showSuccess(true, firstName);
        }, 350);
      }
    });

    $('[data-contact-reset]', successPanel).addEventListener('click', function () {
      form.reset();
      assessment = null;
      attachedWrap.hidden = true;
      updateCount();
      showForm();
      focusForm('#contact-name');
    });

    function showForm() {
      if (!form.hidden) return;
      successPanel.hidden = true;
      form.hidden = false;
    }
    function focusForm(sel) {
      var el = $(sel, form);
      form.scrollIntoView({ behavior: PG.reducedMotion ? 'auto' : 'smooth', block: 'start' });
      setTimeout(function () { el.focus({ preventScroll: true }); }, PG.reducedMotion ? 0 : 450);
    }

    loadDraft();
    readHash();
    updateCount();
    initClock(section);
  }

  /* ---------- Local time widget ---------- */
  function initClock(section) {
    var tz = cfg.timezone || 'America/New_York';
    var herTime = $('[data-contact-her-time]', section);
    var herZone = $('[data-contact-her-zone]', section);
    var status = $('[data-contact-status]', section);
    var statusText = $('[data-contact-status-text]', section);
    var yourTime = $('[data-contact-your-time]', section);
    var diffEl = $('[data-contact-diff]', section);
    var input = $('#contact-convert-input', section);
    var out = $('[data-contact-convert-out]', section);
    var fmt, fmtLocal, partsFmt;
    try {
      fmt = new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit', weekday: 'short' });
      partsFmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', weekday: 'short'
      });
      fmtLocal = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', weekday: 'short' });
    } catch (e) {
      $('[data-contact-clock]', section).hidden = true;
      return;
    }
    var zoneName = '';
    try {
      var zp = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
      zp.forEach(function (p) { if (p.type === 'timeZoneName') zoneName = p.value; });
    } catch (e) { /* ignore */ }
    herZone.textContent = zoneName || tz.split('/').pop().replace(/_/g, ' ');

    function parts(d) {
      var o = {};
      partsFmt.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
      return o;
    }
    // Minutes her zone is ahead of UTC at date d
    function herOffset(d) {
      var p = parts(d);
      var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
      return Math.round((asUTC - (d.getTime() - d.getSeconds() * 1000 - d.getMilliseconds())) / 60000);
    }
    function diffMinutes(d) { return herOffset(d) - -d.getTimezoneOffset(); }
    function fmtDiff(m) {
      if (m === 0) return 'Same time zone as you';
      var h = Math.abs(m) / 60;
      var hs = (h % 1 === 0 ? h : h.toFixed(1)) + ' h';
      return 'She is ' + hs + (m > 0 ? ' ahead of you' : ' behind you');
    }

    function tick() {
      var now = new Date();
      herTime.textContent = fmt.format(now);
      herTime.setAttribute('datetime', now.toISOString());
      yourTime.textContent = fmtLocal.format(now);
      var p = parts(now);
      var h = +p.hour % 24;
      var wk = p.weekday;
      var weekday = wk !== 'Sat' && wk !== 'Sun';
      var online = weekday && h >= 9 && h < 18;
      status.classList.toggle('is-online', online);
      status.classList.toggle('is-offline', !online);
      statusText.textContent = online ? 'Usually online' : 'Outside office hours: leave a message';
      diffEl.textContent = '· ' + fmtDiff(diffMinutes(now));
    }
    function convert() {
      var v = (input.value || '').split(':');
      if (v.length < 2) { out.textContent = '--:--'; return; }
      var d = new Date();
      d.setHours(+v[0], +v[1], 0, 0);
      var target = new Date(d.getTime() + diffMinutes(d) * 60000);
      var str = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(target);
      var ph = target.getHours();
      var note = (ph >= 9 && ph < 18) ? ' (within her office hours)' : ' (outside her office hours)';
      out.textContent = str + ' for Pascaline' + note;
    }
    input.addEventListener('input', convert);
    tick(); convert();
    setInterval(tick, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
