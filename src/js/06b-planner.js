/* 06b-planner: Medical Emergency Response Plan outline builder */
(function () {
  'use strict';
  var PG = window.PG || {};

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('[data-planner]');
    if (!root) return;
    var form = root.querySelector('[data-planner-form]');
    var live = root.querySelector('[data-planner-live]');
    var titleEl = root.querySelector('[data-planner-title]');
    var hcOut = root.querySelector('[data-planner-headcount-out]');
    var range = form.elements.headcount;

    var HEADCOUNTS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
    var SCENARIOS = {
      event: { label: 'Large international event', base: 2 },
      worksite: { label: 'Remote work site', base: 2 },
      expedition: { label: 'Expedition or field mission', base: 3 },
      study: { label: 'Study-abroad program', base: 1 },
      executive: { label: 'Executive travel', base: 1 }
    };
    var DURATIONS = ['1 to 3 days', '4 to 14 days', '2 to 8 weeks', '2 to 6 months', '6 months or ongoing'];
    var REMOTE = ['Urban', 'Regional', 'Remote', 'Very remote / offshore'];
    var CARE = { unknown: { label: 'Unknown', w: 2 }, limited: { label: 'Limited', w: 2.5 }, moderate: { label: 'Moderate', w: 1 }, advanced: { label: 'Advanced', w: 0 } };
    var RISKS = {
      heat: { label: 'Heat', w: 1 }, altitude: { label: 'Altitude', w: 1.5 }, infectious: { label: 'Infectious disease', w: 1.5 },
      security: { label: 'Security', w: 1.5 }, maritime: { label: 'Maritime', w: 1.5 }, mass: { label: 'Mass gathering', w: 1 },
      chronic: { label: 'Chronic conditions', w: 1 }
    };
    var LEVELS = [
      { max: 4, name: 'Low', key: 'low', text: 'A concise plan built on reliable local services, clear contacts and a tested escalation path.' },
      { max: 9, name: 'Moderate', key: 'moderate', text: 'Several factors interact. Facility capability checks and a pre-agreed evacuation route become essential.' },
      { max: 13.5, name: 'High', key: 'high', text: 'Local care alone is unlikely to be enough. Plan for on-site clinical capacity and pre-arranged aeromedical transport.' },
      { max: Infinity, name: 'Critical', key: 'critical', text: 'Multiple compounding risks. The plan needs dedicated medical leadership, redundancy at every step and rehearsed drills.' }
    ];

    var ICONS = {
      risk: '<path d="M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7z"/><path d="M12 8v5M12 16h.01"/>',
      onsite: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M12 10v6M9 13h6"/>',
      facility: '<path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M12 7v6M9 10h6M10 21v-4h4v4"/>',
      evac: '<path d="M2 16l20-6-3-2-6 2-6-5-2 1 4 6-4 1-2-2-2 1z"/><path d="M3 21h18"/>',
      comms: '<path d="M4 4h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
      health: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M5 19l2.5-2.5M16.5 7.5L19 5"/>',
      docs: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
      drill: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
      tip: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'
    };
    function icon(k) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[k] + '</svg>'; }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function fmt(n) { return n >= 50000 ? '50,000+' : n.toLocaleString('en-US'); }

    function read() {
      var risks = Array.prototype.slice.call(form.querySelectorAll('input[name="risk"]:checked')).map(function (i) { return i.value; });
      var has = {}; risks.forEach(function (r) { has[r] = true; });
      var hIdx = parseInt(range.value, 10) || 0;
      return {
        scenario: (form.querySelector('input[name="scenario"]:checked') || {}).value || 'event',
        hIdx: hIdx, headcount: HEADCOUNTS[hIdx],
        duration: parseInt(form.elements.duration.value, 10) || 0,
        remote: parseInt((form.querySelector('input[name="remote"]:checked') || {}).value, 10) || 0,
        care: (form.querySelector('input[name="care"]:checked') || {}).value || 'moderate',
        risks: risks, has: has
      };
    }

    function assess(s) {
      var drivers = [];
      var sc = SCENARIOS[s.scenario].base;
      var hc = s.hIdx <= 2 ? 0 : s.hIdx <= 5 ? 1 : s.hIdx <= 8 ? 2 : 3;
      var du = s.duration <= 1 ? 0 : s.duration <= 2 ? 1 : 2;
      var re = s.remote * 1.5;
      var ca = CARE[s.care].w;
      var ri = s.risks.reduce(function (t, r) { return t + RISKS[r].w; }, 0);
      if (re >= 3) drivers.push({ w: re, t: REMOTE[s.remote].toLowerCase() + ' location' });
      if (ca >= 2) drivers.push({ w: ca, t: (s.care === 'unknown' ? 'unverified' : 'limited') + ' local healthcare' });
      if (hc >= 2) drivers.push({ w: hc, t: fmt(s.headcount) + ' people' });
      if (du >= 2) drivers.push({ w: du, t: 'long duration' });
      if (sc >= 3) drivers.push({ w: sc, t: 'field-mission profile' });
      s.risks.forEach(function (r) { drivers.push({ w: RISKS[r].w, t: RISKS[r].label.toLowerCase() + ' risk' }); });
      drivers.sort(function (a, b) { return b.w - a.w; });
      var score = sc + hc + du + re + ca + ri;
      var level = LEVELS.filter(function (l) { return score <= l.max; })[0];
      return { score: score, level: level, pct: Math.max(6, Math.min(100, Math.round(score / 18 * 100))), drivers: drivers.slice(0, 3).map(function (d) { return d.t; }) };
    }

    function build(s, a) {
      var h = s.has, sc = s.scenario, far = s.remote >= 2, weakCare = s.care === 'limited' || s.care === 'unknown';
      var big = s.headcount >= 1000;
      function add(list, cond, txt) { if (cond) list.push(txt); }
      var sections = [];

      var r1 = ['Profile the population: age range, fitness, pre-existing conditions and medication needs',
        'Map country and site health risks, seasonal hazards and local emergency numbers'];
      add(r1, h.heat, 'Heat-illness thresholds, hydration plan and work/rest or schedule adjustments');
      add(r1, h.altitude, 'Altitude profile, acclimatisation schedule and screening for at-risk individuals');
      add(r1, h.chronic, 'Confidential pre-departure health declarations and continuity of chronic medication');
      add(r1, h.security, 'Integrate security risk assessment: how unrest or crime affects access to care');
      add(r1, h.maritime, 'Maritime hazards: drowning, injury at sea, seasickness and weather windows');
      sections.push({ icon: 'risk', title: 'Medical risk profile', items: r1 });

      var r2 = [];
      if (a.level.key === 'low') r2.push('First-aid trained staff, stocked first-aid kits and an AED where people gather');
      else r2.push('Size on-site clinical cover (first aiders, nurse, paramedic or physician) to headcount and risk');
      add(r2, big || h.mass, 'Medical posts, roaming teams and a casualty treatment area sized to crowd density');
      add(r2, far, 'Extended-care capability: kit, oxygen and consumables to stabilise a patient for many hours');
      add(r2, s.duration >= 2, 'Resupply cycle and expiry tracking for medication and consumables');
      add(r2, far || weakCare, 'Telemedicine access to remote physician support, 24/7');
      add(r2, sc === 'executive', 'Discreet travelling medical kit and a pre-briefed point of contact for the principal');
      sections.push({ icon: 'onsite', title: 'On-site medical resources', items: r2 });

      var r3 = ['Identify the nearest facilities for trauma, cardiac, obstetric and paediatric emergencies',
        'Verify capability directly: 24/7 emergency department, ICU, imaging, blood supply, specialist cover'];
      add(r3, weakCare, 'Treat directory listings as unconfirmed until checked: capability on paper is not capability on the night');
      add(r3, true, 'Confirm payment guarantees and admission procedures for international patients');
      add(r3, s.remote >= 1, 'Record realistic transfer times by road, day and night, to each facility');
      add(r3, h.infectious, 'Identify facilities with isolation capacity and laboratory testing');
      sections.push({ icon: 'facility', title: 'Nearest verified facilities & capability check', items: r3 });

      var r4 = ['Define the evacuation decision chain: who authorises, on what clinical criteria, within what time'];
      add(r4, far || weakCare, 'Pre-arrange aeromedical transport with accredited providers and agree activation steps in advance');
      add(r4, h.maritime || s.remote === 3, 'Plan sea or helicopter extraction, including landing zones and weather limits');
      add(r4, h.altitude, 'Descent protocol and helicopter feasibility at altitude');
      add(r4, s.remote <= 1, 'Ground ambulance access routes, staging points and response times');
      add(r4, true, 'Repatriation pathway, medical escort options and insurance or assistance coverage');
      sections.push({ icon: 'evac', title: 'Evacuation & aeromedical pathways', items: r4 });

      var r5 = ['Escalation tree: on-site lead, medical lead, management, family liaison and assistance provider',
        'Primary and backup communications, with contact cards carried by every team member'];
      add(r5, far, 'Satellite communications where mobile coverage is unreliable');
      add(r5, big || h.mass, 'Unified command with event security, organisers and local emergency services');
      add(r5, sc === 'study', 'Coordination protocol with the home institution, parents or guardians and host partners');
      add(r5, h.security, 'Shared incident channel with the security provider and crisis management team');
      sections.push({ icon: 'comms', title: 'Communications & escalation tree', items: r5 });

      var r6 = ['Surveillance of local health alerts before and during deployment'];
      add(r6, h.infectious, 'Vaccination and prophylaxis requirements, vector-control measures and isolation protocol');
      add(r6, h.mass || big, 'Food, water and sanitation standards; outbreak detection for gastrointestinal and respiratory illness');
      add(r6, h.infectious || h.mass, 'Liaison with local public health authorities and notification obligations');
      add(r6, h.heat, 'Heat alert triggers that change the programme or work schedule');
      sections.push({ icon: 'health', title: 'Public health & outbreak protocols', items: r6 });

      var r7 = ['Consent, confidentiality and data protection for health information across borders',
        'Incident log, patient handover forms and clear records of medical decisions'];
      add(r7, sc === 'study', 'Consent arrangements for minors or students, and emergency contacts on file');
      add(r7, far || weakCare, 'Ethical criteria for evacuation decisions and fair access to transport when capacity is limited');
      add(r7, true, 'Verify insurance and assistance coverage, exclusions and pre-authorisation rules');
      sections.push({ icon: 'docs', title: 'Documentation, consent & ethics', items: r7 });

      var r8 = ['Table-top exercise of a serious incident before go-live'];
      add(r8, a.level.key === 'high' || a.level.key === 'critical', 'Live drill of a full evacuation, including a night or bad-weather scenario');
      add(r8, s.duration >= 2, 'Scheduled plan review as conditions, staff or facilities change');
      add(r8, true, 'After-action review within days of any incident, with lessons fed back into the plan');
      sections.push({ icon: 'drill', title: 'Drills & after-action review', items: r8 });

      var tips = [];
      if (weakCare) tips.push('Verify before you rely: contact the receiving hospitals directly to confirm what they can treat today, not what a directory says.');
      if (far) tips.push('Agree the aeromedical pathway first: provider, activation steps, payment guarantee and realistic times from your exact location.');
      if (h.infectious) tips.push('Set the outbreak triggers early: what symptoms, how many cases, and who decides to isolate, pause or evacuate.');
      if (h.mass || big) tips.push('Model the worst plausible hour: a crowd surge or multiple casualties at once, and how far local capacity really stretches.');
      if (h.security) tips.push('Bring security and medical into one plan: a safe route to care matters as much as the care itself.');
      if (sc === 'study') tips.push('Brief students and staff on how to get help and what will happen: clear expectations cut response times.');
      if (sc === 'executive') tips.push('Know the best hospital in each city on the itinerary before arrival, with a named contact and an admission route.');
      tips.push('Name one accountable medical lead and write the escalation tree on a single page that everyone carries.');
      tips.push('Test the plan with a table-top exercise before go-live, then fix what it reveals.');

      return { sections: sections, tips: tips.slice(0, 3) };
    }

    var last = null;
    function render() {
      var s = read();
      hcOut.textContent = fmt(s.headcount);
      range.setAttribute('aria-valuetext', fmt(s.headcount) + ' people');
      var a = assess(s), p = build(s, a);
      var totalItems = p.sections.reduce(function (t, x) { return t + x.items.length; }, 0);
      titleEl.textContent = 'MERP outline: ' + SCENARIOS[s.scenario].label;
      last = { s: s, a: a, p: p };

      var why = a.drivers.length ? 'Main drivers: ' + a.drivers.join(', ') + '. ' : '';
      var html = '' +
        '<div class="planner-summary">' +
          '<span class="chip">' + esc(fmt(s.headcount)) + ' people</span>' +
          '<span class="chip">' + esc(DURATIONS[s.duration]) + '</span>' +
          '<span class="chip">' + esc(REMOTE[s.remote]) + '</span>' +
          '<span class="chip">Care: ' + esc(CARE[s.care].label) + '</span>' +
          s.risks.map(function (r) { return '<span class="chip planner-chip-risk">' + esc(RISKS[r].label) + '</span>'; }).join('') +
        '</div>' +
        '<div class="planner-complexity planner-complexity--' + a.level.key + '">' +
          '<div class="planner-complexity-top"><span class="planner-complexity-label">Plan complexity</span>' +
          '<strong class="planner-complexity-level">' + a.level.name + '</strong></div>' +
          '<div class="planner-meter" role="meter" aria-label="Plan complexity" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + a.pct + '" aria-valuetext="' + a.level.name + '">' +
            '<span class="planner-meter-fill" style="width:' + a.pct + '%"></span>' +
            '<span class="planner-meter-ticks" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '</div>' +
          '<div class="planner-meter-scale" aria-hidden="true"><span>Low</span><span>Moderate</span><span>High</span><span>Critical</span></div>' +
          '<p class="planner-complexity-text">' + esc(why + a.level.text) + '</p>' +
        '</div>' +
        '<div class="planner-tips">' +
          '<h4 class="planner-tips-title">' + icon('tip') + 'What Pascaline would do first</h4>' +
          '<ol>' + p.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
        '</div>' +
        '<p class="planner-count">' + p.sections.length + ' plan sections · ' + totalItems + ' tailored checklist items</p>' +
        '<ol class="planner-sections">' + p.sections.map(function (sec, i) {
          return '<li class="planner-sec">' +
            '<div class="planner-sec-head"><span class="planner-sec-icon">' + icon(sec.icon) + '</span>' +
            '<h4 class="planner-sec-title"><span class="planner-sec-num">' + (i + 1) + '.</span> ' + esc(sec.title) + '</h4>' +
            '<span class="planner-sec-count">' + sec.items.length + '</span></div>' +
            '<ul class="planner-items">' + sec.items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ul>' +
          '</li>';
        }).join('') + '</ol>' +
        '<p class="planner-print-note">Indicative planning aid prepared with the Pelagos Global MERP builder. Not medical advice.</p>';
      live.innerHTML = html;
    }

    function asText() {
      if (!last) return '';
      var s = last.s, a = last.a, p = last.p, L = [];
      L.push('MEDICAL EMERGENCY RESPONSE PLAN - OUTLINE');
      L.push('Scenario: ' + SCENARIOS[s.scenario].label);
      L.push('Headcount: ' + fmt(s.headcount) + ' | Duration: ' + DURATIONS[s.duration] + ' | Remoteness: ' + REMOTE[s.remote] + ' | Local healthcare: ' + CARE[s.care].label);
      if (s.risks.length) L.push('Special risks: ' + s.risks.map(function (r) { return RISKS[r].label; }).join(', '));
      L.push('Complexity: ' + a.level.name + ' - ' + (a.drivers.length ? 'drivers: ' + a.drivers.join(', ') + '. ' : '') + a.level.text);
      L.push('');
      L.push('WHAT PASCALINE WOULD DO FIRST');
      p.tips.forEach(function (t, i) { L.push((i + 1) + '. ' + t); });
      p.sections.forEach(function (sec, i) {
        L.push(''); L.push((i + 1) + '. ' + sec.title.toUpperCase());
        sec.items.forEach(function (it) { L.push('   [ ] ' + it); });
      });
      L.push('');
      L.push('Indicative planning aid only, not medical advice. Full plan: ' + (PG.config ? PG.config.brand + ' - ' + PG.config.email : 'Pelagos Global'));
      return L.join('\n');
    }

    function toast(m) { if (PG.toast) PG.toast(m); }
    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      toast(ok ? 'Outline copied to clipboard' : 'Copy failed. Please select and copy manually.');
    }

    root.querySelector('[data-planner-copy]').addEventListener('click', function () {
      var text = asText();
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { toast('Outline copied to clipboard'); }, function () { fallbackCopy(text); });
      } else fallbackCopy(text);
    });

    var html = document.documentElement;
    function endPrint() { html.classList.remove('planner-printing'); }
    root.querySelector('[data-planner-print]').addEventListener('click', function () {
      html.classList.add('planner-printing');
      window.addEventListener('afterprint', endPrint, { once: true });
      window.print();
    });

    root.querySelector('[data-planner-cta]').addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('pg:select-service', { detail: { service: 'Medical Emergency Response Plans' } }));
      var c = document.getElementById('contact');
      if (c) c.scrollIntoView({ behavior: PG.reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });

    var t;
    form.addEventListener('input', function () { clearTimeout(t); t = setTimeout(render, 60); });
    form.addEventListener('change', render);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    render();
  });
})();
