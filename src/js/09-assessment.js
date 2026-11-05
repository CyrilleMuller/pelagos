/* 09-assessment: Global Duty-of-Care & Medical Assistance Readiness Check.
   Lead-generation self-assessment. State persists in localStorage so a reload resumes.
   Emits document CustomEvent 'pg:assessment-result' { score, level, summary } on "Discuss my results". */
(function () {
  'use strict';
  var PG = window.PG || {};
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var root = $('[data-assess]');
  if (!root) return;

  var STORE_KEY = 'pg-assessment-v1';
  var reduced = !!PG.reducedMotion;
  var stage = $('[data-assess-stage]', root);
  var top = $('[data-assess-top]', root);
  var bar = $('[data-assess-bar]', root);
  var barFill = $('[data-assess-bar-fill]', root);
  var progLabel = $('[data-assess-progress-label]', root);
  var orgLabel = $('[data-assess-org-label]', root);

  var ICON = {
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6"/>',
    hands: '<path d="M12 21s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    plane: '<path d="M10.5 13.5L3 11l1.5-1.5 8 1 4-4a2.1 2.1 0 0 1 3 3l-4 4 1 8L15 23l-2.5-7.5"/><path d="M5 19l2-2"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'
  };
  function icon(name) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + ICON[name] + '</svg>'; }

  var ORGS = [
    { id: 'employer', label: 'Employer', desc: 'Business travellers, assignees and expatriates', icon: 'briefcase', people: 'your travelling employees and expatriates', person: 'travelling employee' },
    { id: 'university', label: 'University / study abroad', desc: 'Students, faculty and research teams abroad', icon: 'cap', people: 'your students and faculty abroad', person: 'student abroad' },
    { id: 'ngo', label: 'NGO / humanitarian', desc: 'Field staff, volunteers and deployed teams', icon: 'hands', people: 'your field staff and deployed teams', person: 'field staff member' },
    { id: 'insurer', label: 'Insurer, TPA or assistance company', desc: 'Members, insureds and client programs', icon: 'shield', people: 'your members and insureds', person: 'member' },
    { id: 'airamb', label: 'Air ambulance / medical transport', desc: 'Fixed-wing, rotor, escort and repatriation services', icon: 'plane', people: 'the patients you transport', person: 'patient in your care' }
  ];

  // Each question: 4 options scored 0..3. Optional per-org overrides via `by`.
  var QUESTIONS = [
    {
      id: 'intel', domain: 'Health-risk intelligence',
      q: function (o) { return 'How do you assess health risks before ' + o.people + ' travel or deploy?'; },
      opts: ['We don’t assess this systematically', 'Generic advice only (vaccination lists, government advisories)', 'Country-level health-risk profiles, reviewed periodically', 'Destination- and person-specific briefings, continuously updated and acted on'],
      by: { airamb: { q: 'How do you assess medical capability and health risks at the destinations you operate into?' }, insurer: { q: 'How do you track health risks and medical capability in the countries where your members are located?' } },
      service: 'Country health surveillance & assignment briefings',
      rec: 'Build country health-risk profiles and pre-assignment briefings so decisions are made on current intelligence, not generic advisories.'
    },
    {
      id: 'network', domain: 'Vetted provider networks',
      q: function (o) { return 'How well do you know the hospitals and clinics ' + o.people + ' would rely on abroad?'; },
      opts: ['We would find a facility when the need arises', 'We use a third-party list without reviewing it', 'Key locations have vetted providers with known capabilities', 'Capability-mapped network, re-assessed on a regular cycle, with escalation contacts'],
      by: { airamb: { q: 'How do you vet receiving hospitals and ground-ambulance partners at origin and destination?' } },
      service: 'Medical & transport provider quality assessment',
      rec: 'Map and assess the medical capability of the facilities you depend on in priority locations, and set a re-assessment cycle.'
    },
    {
      id: 'evac', domain: 'Evacuation & repatriation',
      q: function () { return 'Do you have a documented medical evacuation and repatriation plan?'; },
      opts: ['No plan: we would improvise', 'Covered by a policy, but triggers and roles are unclear', 'Documented plan with decision criteria and named roles', 'Tested plan with pre-agreed triggers, funding authority and regular exercises'],
      by: { airamb: { q: 'How formalised are your mission-acceptance and patient-transfer decision protocols?', opts: ['Decided case by case, mostly verbally', 'Some written guidance, applied inconsistently', 'Documented protocols with clinical and operational criteria', 'Documented, audited protocols with clear go / no-go authority and review'] } },
      service: 'Aeromedical & evacuation planning',
      rec: 'Define evacuation and repatriation triggers, decision rights and funding authority in advance, then rehearse them.'
    },
    {
      id: 'vendor', domain: 'Air-ambulance vetting',
      q: function () { return 'How do you select and monitor air ambulance and medical escort providers?'; },
      opts: ['Whoever is available, or the lowest quote', 'Our assistance partner chooses; we don’t review it', 'Providers screened for accreditation (e.g. EURAMI, CAMTS) and insurance', 'Structured due diligence, accreditation checks, performance KPIs and periodic audits'],
      by: { airamb: { q: 'How ready is your organisation for accreditation (e.g. EURAMI, CAMTS) and client due-diligence audits?', opts: ['Not started', 'Policies exist but are not aligned to a standard', 'Aligned to a standard, with known gaps being closed', 'Accredited or audit-ready, with continuous internal review'] } },
      service: 'Air ambulance vendor due diligence & accreditation readiness',
      recBy: { airamb: 'Run a gap analysis against recognised accreditation standards and prepare for client due-diligence audits.' },
      rec: 'Introduce structured due diligence for air ambulance and escort providers, anchored on recognised accreditation standards.'
    },
    {
      id: 'merp', domain: 'Emergency response plans',
      q: function () { return 'For large events, projects or remote sites, do you have a Medical Emergency Response Plan?'; },
      opts: ['No: we rely on local emergency services', 'Only for some sites, mostly informal', 'Documented plans covering local care, transport and contacts', 'Site-specific plans, drilled, with medical resources and evacuation routes pre-arranged'],
      by: { airamb: { q: 'Do you support clients’ Medical Emergency Response Plans for events and remote sites?', opts: ['Not something we offer', 'Ad hoc, on request', 'Defined standby and response offering for key clients', 'Integrated planning with clients, including drills and pre-positioning'] } },
      service: 'Medical Emergency Response Plans for events & remote sites',
      rec: 'Develop site- and event-specific Medical Emergency Response Plans covering local capability, transport routes and escalation.'
    },
    {
      id: 'crisis', domain: 'Crisis & outbreak readiness',
      q: function (o) { return 'How prepared are you if an outbreak, natural disaster or unrest affects ' + o.people + '?'; },
      opts: ['No specific playbook', 'A general crisis plan that is not health-specific', 'Health-specific playbooks for key scenarios', 'Rehearsed scenario playbooks with logistics partners pre-identified'],
      service: 'Crisis & outbreak response logistics',
      rec: 'Write health-specific playbooks for your most likely scenarios and pre-identify the logistics partners you would activate.'
    },
    {
      id: 'assist', domain: '24/7 assistance & escalation',
      q: function (o) { return 'If a ' + o.person + ' has a medical emergency at 3 a.m. local time, what happens?'; },
      opts: ['Unclear: they would call whoever they can', 'A hotline exists, but awareness and escalation are weak', '24/7 assistance with defined escalation to decision-makers', 'Medically-led 24/7 assistance, clear escalation, case tracking and family communication'],
      by: { insurer: { q: 'How robust is your 24/7 case management and escalation model?' }, airamb: { q: 'How robust is your 24/7 mission coordination and escalation model?' } },
      service: 'Assistance model & escalation design',
      rec: 'Clarify who answers, who decides and who informs families at any hour, and make sure people know how to reach help.'
    },
    {
      id: 'ethics', domain: 'Data, ethics & consent',
      q: function () { return 'How do you handle medical data, consent and ethical questions in cross-border cases?'; },
      opts: ['Ad hoc, case by case', 'We follow general privacy policies', 'Documented consent and data-transfer procedures for medical cases', 'A governed framework for consent, data transfer and ethical escalation'],
      service: 'Ethics & compliance in cross-border patient transport',
      rec: 'Put a clear framework around consent, cross-border medical data and ethically complex transport requests.'
    },
    {
      id: 'review', domain: 'Review & training',
      q: function () { return 'After a medical incident abroad, what happens next?'; },
      opts: ['The case is closed and we move on', 'An informal debrief when something goes badly', 'A structured post-incident review with documented actions', 'Systematic reviews feeding training, provider scorecards and plan updates'],
      service: 'Training & post-incident review',
      rec: 'Make post-incident reviews routine, and feed the lessons into training, provider scorecards and plan updates.'
    }
  ];
  var N = QUESTIONS.length;
  var LEVELS = [
    { min: 0, name: 'Reactive', text: 'Responses are improvised when something happens. A few foundational steps would significantly reduce risk for people and the organisation.' },
    { min: 40, name: 'Developing', text: 'Important building blocks are in place, but gaps in planning, vetting or escalation could slow the response when it matters most.' },
    { min: 65, name: 'Established', text: 'A solid, documented program. The next gains come from testing, independent vetting and closing a few specific gaps.' },
    { min: 85, name: 'Leading', text: 'A mature, well-governed program. Continuous review and benchmarking will keep it ahead as risks and providers change.' }
  ];

  // ---- State ----
  var state = load() || { org: null, step: 0, answers: {} };
  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && typeof s === 'object' && s.answers) return s; } catch (e) {}
    return null;
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }
  function org() { for (var i = 0; i < ORGS.length; i++) if (ORGS[i].id === state.org) return ORGS[i]; return null; }
  function qText(q, o) { var b = q.by && q.by[o.id]; return (b && b.q) || q.q(o); }
  function qOpts(q, o) { var b = q.by && q.by[o.id]; return (b && b.opts) || q.opts; }

  // ---- Rendering ----
  function render(focus) {
    var o = org();
    if (!o) state.step = 0;
    var html;
    if (state.step === 0) html = renderOrg();
    else if (state.step <= N) html = renderQuestion(state.step - 1, o);
    else html = renderResults(o);
    swap(html, focus);
    updateProgress(o);
  }

  function swap(html, focus) {
    var apply = function () {
      stage.innerHTML = html;
      bind();
      if (focus) { var h = $('[data-assess-focus]', stage); if (h) h.focus({ preventScroll: true }); }
      if (state.step > N) animateResults();
      if (!reduced) {
        stage.classList.add('assess-stage--enter');
        requestAnimationFrame(function () { requestAnimationFrame(function () { stage.classList.remove('assess-stage--enter'); }); });
      }
    };
    if (reduced || !stage.firstElementChild) return apply();
    stage.classList.add('assess-stage--leave');
    setTimeout(function () { stage.classList.remove('assess-stage--leave'); apply(); }, 180);
  }

  function updateProgress(o) {
    var s = state.step;
    top.hidden = s === 0;
    var pct = s === 0 ? 0 : s > N ? 100 : Math.round(((s - 1) / N) * 100);
    barFill.style.width = pct + '%';
    bar.setAttribute('aria-valuenow', String(pct));
    progLabel.textContent = s > N ? 'Your results' : 'Question ' + s + ' of ' + N;
    orgLabel.textContent = o ? o.label : '';
  }

  function renderOrg() {
    var items = ORGS.map(function (o) {
      var checked = state.org === o.id ? ' checked' : '';
      return '<label class="assess-org">' +
        '<input type="radio" name="assess-org" value="' + o.id + '"' + checked + '>' +
        '<span class="assess-org-card">' +
        '<span class="assess-org-icon">' + icon(o.icon) + '</span>' +
        '<span class="assess-org-text"><strong>' + o.label + '</strong><small>' + o.desc + '</small></span>' +
        '</span></label>';
    }).join('');
    return '<form class="assess-step" data-assess-form novalidate>' +
      '<fieldset class="assess-fieldset">' +
      '<legend class="assess-legend" tabindex="-1" data-assess-focus><span class="assess-kicker">Step 1 · About you</span>Which best describes your organisation?</legend>' +
      '<p class="assess-hint">Questions adapt slightly to your context.</p>' +
      '<div class="assess-org-grid">' + items + '</div>' +
      '</fieldset>' +
      '<div class="assess-nav"><span></span>' +
      '<button type="submit" class="btn btn--primary" data-assess-next' + (state.org ? '' : ' disabled') + '>Start the check ' + icon('arrowR') + '</button>' +
      '</div></form>';
  }

  function renderQuestion(i, o) {
    var q = QUESTIONS[i];
    var sel = state.answers[q.id];
    var opts = qOpts(q, o).map(function (t, v) {
      var checked = sel === v ? ' checked' : '';
      return '<label class="assess-opt">' +
        '<input type="radio" name="assess-q-' + q.id + '" value="' + v + '"' + checked + '>' +
        '<span class="assess-opt-card"><span class="assess-opt-dot" aria-hidden="true"></span><span>' + t + '</span></span>' +
        '</label>';
    }).join('');
    var last = i === N - 1;
    return '<form class="assess-step" data-assess-form novalidate>' +
      '<fieldset class="assess-fieldset">' +
      '<legend class="assess-legend" tabindex="-1" data-assess-focus><span class="assess-kicker">' + (i + 1) + ' / ' + N + ' · ' + q.domain + '</span>' + qText(q, o) + '</legend>' +
      '<div class="assess-opts">' + opts + '</div>' +
      '</fieldset>' +
      '<div class="assess-nav">' +
      '<button type="button" class="btn btn--ghost" data-assess-back>' + icon('arrowL') + ' Back</button>' +
      '<button type="submit" class="btn btn--primary" data-assess-next' + (sel === undefined ? ' disabled' : '') + '>' + (last ? 'See my results' : 'Next') + ' ' + icon('arrowR') + '</button>' +
      '</div></form>';
  }

  function compute(o) {
    var total = 0;
    var domains = QUESTIONS.map(function (q, idx) {
      var v = state.answers[q.id] || 0;
      total += v;
      return { q: q, v: v, idx: idx, pct: Math.round((v / 3) * 100) };
    });
    var score = Math.round((total / (N * 3)) * 100);
    var level = LEVELS[0];
    LEVELS.forEach(function (l) { if (score >= l.min) level = l; });
    var weakest = domains.slice().sort(function (a, b) { return a.v - b.v || a.idx - b.idx; });
    var recs = weakest.filter(function (d) { return d.v < 3; }).slice(0, 5);
    if (recs.length < 3) recs = weakest.slice(0, 3);
    return { score: score, level: level, domains: domains, recs: recs, org: o };
  }

  function summaryText(r) {
    var lines = [
      'Global Duty-of-Care & Medical Assistance Readiness Check (Pelagos Global)',
      'Organisation type: ' + r.org.label,
      'Indicative score: ' + r.score + '/100 (' + r.level.name + ')',
      '',
      'Domain breakdown:'
    ];
    r.domains.forEach(function (d) { lines.push('- ' + d.q.domain + ': ' + d.pct + '%'); });
    lines.push('', 'Priority areas:');
    r.recs.forEach(function (d, i) { lines.push((i + 1) + '. ' + d.q.domain + ' (' + d.q.service + ')'); });
    return lines.join('\n');
  }

  var lastResult = null;
  function renderResults(o) {
    var r = compute(o);
    lastResult = r;
    var C = 2 * Math.PI * 52;
    var bars = r.domains.map(function (d) {
      var tone = d.v <= 1 ? 'low' : d.v === 2 ? 'mid' : 'high';
      return '<li class="assess-dom assess-dom--' + tone + '">' +
        '<span class="assess-dom-name">' + d.q.domain + '</span>' +
        '<span class="assess-dom-val">' + d.pct + '%</span>' +
        '<span class="assess-dom-track" aria-hidden="true"><span class="assess-dom-fill" data-pct="' + d.pct + '"></span></span>' +
        '</li>';
    }).join('');
    var recs = r.recs.map(function (d, i) {
      var txt = (d.q.recBy && d.q.recBy[o.id]) || d.q.rec;
      return '<li class="assess-rec">' +
        '<span class="assess-rec-num" aria-hidden="true">' + (i + 1) + '</span>' +
        '<div><h4 class="assess-rec-title">' + d.q.domain + '</h4>' +
        '<p>' + txt + '</p>' +
        '<a class="assess-rec-service" href="#services">Pelagos service: ' + d.q.service + '</a></div>' +
        '</li>';
    }).join('');
    return '<div class="assess-results" data-assess-results>' +
      '<div class="assess-print-head"><strong>Pelagos Global</strong> · Global Duty-of-Care &amp; Medical Assistance Readiness Check</div>' +
      '<div class="assess-summary">' +
      '<div class="assess-gauge" role="img" aria-label="Indicative score ' + r.score + ' out of 100, level ' + r.level.name + '">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="assess-gauge-track" cx="60" cy="60" r="52"/>' +
      '<circle class="assess-gauge-arc" cx="60" cy="60" r="52" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '" data-score="' + r.score + '" data-c="' + C.toFixed(2) + '"/>' +
      '</svg>' +
      '<div class="assess-gauge-num"><span data-assess-count>0</span><small>/100</small></div>' +
      '</div>' +
      '<div class="assess-level">' +
      '<span class="assess-kicker">' + r.org.label + ' · indicative maturity</span>' +
      '<h3 tabindex="-1" data-assess-focus>Level: <span class="assess-level-name assess-level--' + r.level.name.toLowerCase() + '">' + r.level.name + '</span></h3>' +
      '<p>' + r.level.text + '</p>' +
      '<ol class="assess-scale" aria-label="Maturity scale">' + LEVELS.map(function (l) {
        return '<li' + (l === r.level ? ' class="is-current" aria-current="true"' : '') + '>' + l.name + '</li>';
      }).join('') + '</ol>' +
      '</div></div>' +
      '<div class="assess-detail">' +
      '<div class="assess-panel"><h4 class="assess-panel-title">Domain breakdown</h4><ul class="assess-doms">' + bars + '</ul></div>' +
      '<div class="assess-panel"><h4 class="assess-panel-title">Your priorities</h4><ol class="assess-recs">' + recs + '</ol></div>' +
      '</div>' +
      '<p class="assess-results-note">Indicative self-assessment based on your answers. It is not medical, legal or insurance advice.</p>' +
      '<div class="assess-actions">' +
      '<button type="button" class="btn btn--accent" data-assess-discuss>' + icon('chat') + ' Discuss my results</button>' +
      '<button type="button" class="btn btn--ghost" data-assess-print>' + icon('print') + ' Print / save as PDF</button>' +
      '<button type="button" class="btn btn--ghost" data-assess-copy>' + icon('copy') + ' Copy summary</button>' +
      '<button type="button" class="btn btn--ghost" data-assess-restart>' + icon('restart') + ' Restart</button>' +
      '</div></div>';
  }

  function animateResults() {
    var arc = $('.assess-gauge-arc', stage);
    var num = $('[data-assess-count]', stage);
    var score = +arc.getAttribute('data-score');
    var C = +arc.getAttribute('data-c');
    var fills = Array.prototype.slice.call(stage.querySelectorAll('.assess-dom-fill'));
    var finish = function () {
      arc.style.strokeDashoffset = String(C * (1 - score / 100));
      fills.forEach(function (f) { f.style.width = f.getAttribute('data-pct') + '%'; });
    };
    if (reduced) { finish(); num.textContent = score; return; }
    requestAnimationFrame(function () { requestAnimationFrame(finish); });
    var t0 = null, dur = 1200;
    var tick = function (t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      num.textContent = Math.round(score * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---- Events ----
  function go(step) {
    state.step = step;
    save();
    render(true);
    var rect = root.getBoundingClientRect();
    if (rect.top < 0 || rect.top > window.innerHeight * 0.4) {
      root.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function bind() {
    var form = $('[data-assess-form]', stage);
    if (form) {
      var next = $('[data-assess-next]', form);
      form.addEventListener('change', function (e) {
        var t = e.target;
        if (t.type !== 'radio') return;
        if (state.step === 0) {
          if (state.org !== t.value) state.answers = {};
          state.org = t.value;
        } else {
          state.answers[QUESTIONS[state.step - 1].id] = +t.value;
        }
        next.disabled = false;
        save();
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (next.disabled) return;
        go(state.step + 1);
      });
      var back = $('[data-assess-back]', form);
      if (back) back.addEventListener('click', function () { go(state.step - 1); });
      return;
    }
    var on = function (sel, fn) { var el = $(sel, stage); if (el) el.addEventListener('click', fn); };
    on('[data-assess-discuss]', function () {
      var r = lastResult;
      document.dispatchEvent(new CustomEvent('pg:assessment-result', {
        detail: { score: r.score, level: r.level.name, summary: summaryText(r) }
      }));
      var c = document.getElementById('contact');
      if (c) c.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      else location.hash = '#contact';
    });
    on('[data-assess-print]', function () {
      var html = document.documentElement;
      html.classList.add('assess-print');
      var done = function () { html.classList.remove('assess-print'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      window.print();
      setTimeout(done, 1000);
    });
    on('[data-assess-copy]', function () {
      var text = summaryText(lastResult);
      var ok = function () { if (PG.toast) PG.toast('Summary copied to clipboard'); };
      var fallback = function () {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); ok(); } catch (e) { if (PG.toast) PG.toast('Copy not available in this browser'); }
        ta.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
      else fallback();
    });
    on('[data-assess-restart]', function () {
      state = { org: null, step: 0, answers: {} };
      clear();
      render(true);
      root.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  }

  // Validate restored state (e.g. if questions changed between versions)
  if (state.step > N + 1 || state.step < 0) state.step = 0;
  if (state.step > N) {
    for (var i = 0; i < N; i++) if (state.answers[QUESTIONS[i].id] === undefined) { state.step = i + 1; break; }
  }
  render(false);
})();
