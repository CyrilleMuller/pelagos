/* Sample health intelligence brief: fictional Republic of Meridia. All data is illustrative. */
(function () {
  'use strict';
  var PG = window.PG || {};
  var root = document.querySelector('[data-intel]');
  if (!root) return;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var CAPS = [
    { key: 'trauma', label: 'Trauma', icon: '<path d="M12 7v10M7 12h10"/><rect x="3" y="3" width="18" height="18" rx="4"/>' },
    { key: 'cardiac', label: 'Cardiac', icon: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M7 12h3l1-2 2 4 1-2h3"/>' },
    { key: 'peds', label: 'Pediatrics', icon: '<circle cx="12" cy="8" r="4"/><path d="M10.5 10a2 2 0 0 0 3 0M7 21v-2a5 5 0 0 1 10 0v2"/>' },
    { key: 'icu', label: 'ICU', icon: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M6 10h3l1.5-3 2 6 1.5-3H18M8 20h8M12 16v4"/>' },
    { key: 'hyper', label: 'Hyperbaric', icon: '<ellipse cx="12" cy="12" rx="9" ry="5"/><path d="M8 12h.01M12 12h.01M16 12h.01M12 3v4M12 17v4"/>' },
    { key: 'blood', label: 'Blood bank', icon: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5"/>' }
  ];
  var STATUS = { y: 'Available', l: 'Limited', n: 'Not available' };

  var CITIES = [
    {
      id: 'aurel', name: 'Aurel', kind: 'Capital, coastal',
      access: 72, accessLabel: 'Good',
      caps: { trauma: 'y', cardiac: 'y', peds: 'l', icu: 'y', hyper: 'n', blood: 'y' },
      capNote: 'Two private hospitals meet most international standards; the public system is stretched at night and weekends.',
      hub: 'Port Valen (fictional regional hub)', transfer: '2–4 h by air ambulance',
      transferNote: 'Stabilise locally; evacuate for complex neurosurgery and major burns.',
      risks: ['Road traffic injury', 'Dengue (seasonal)', 'Air quality', 'Food & waterborne illness'],
      season: [1, 1, 2, 2, 3, 5, 5, 4, 3, 2, 1, 1], seasonLabel: 'Dengue transmission index',
      advice: ['Check routine and travel vaccinations 6–8 weeks before departure.', 'Use insect repellent from dusk to dawn in the wet season.', 'Save your assistance provider’s 24/7 number before you fly.'],
      ops: ['Pre-identify the two private hospitals as preferred admission sites.', 'Confirm direct-billing and guarantee-of-payment arrangements in advance.', 'Night-time road transfers between districts can exceed 60 minutes.'],
      confidence: 'High', confNote: 'Based on recent on-site facility reviews and multiple corroborating sources (illustrative).'
    },
    {
      id: 'saltreach', name: 'Saltreach', kind: 'Port & resort town',
      access: 48, accessLabel: 'Moderate',
      caps: { trauma: 'l', cardiac: 'l', peds: 'l', icu: 'l', hyper: 'y', blood: 'l' },
      capNote: 'One general hospital with a small ICU; a dive-medicine clinic runs the only hyperbaric chamber on the coast.',
      hub: 'Aurel (fictional capital)', transfer: '3–5 h by road, ~1 h by helicopter',
      transferNote: 'Helicopter availability is weather-dependent; always plan a road fallback.',
      risks: ['Diving injuries', 'Marine envenomation', 'Heat illness', 'Dengue (seasonal)'],
      season: [2, 2, 3, 3, 4, 5, 5, 5, 4, 3, 2, 2], seasonLabel: 'Heat & water-sports injury index',
      advice: ['Dive only with certified operators and check chamber status first.', 'Hydrate and limit midday sun exposure in peak summer.', 'Carry regular medication in its original packaging, with a copy of the prescription.'],
      ops: ['Blood supply is limited: agree a plan for large groups in advance.', 'Pre-agree helicopter activation criteria with your assistance provider.', 'Dedicated event medical cover recommended for larger gatherings.'],
      confidence: 'Medium', confNote: 'Facility information partly self-reported; last in-person verification over a year ago (illustrative).'
    },
    {
      id: 'kessit', name: 'Kessit Highlands', kind: 'Remote mining region',
      access: 22, accessLabel: 'Limited',
      caps: { trauma: 'n', cardiac: 'n', peds: 'l', icu: 'n', hyper: 'n', blood: 'n' },
      capNote: 'Rural health posts and a mine-site clinic only; no surgical or critical-care capability in the region.',
      hub: 'Aurel (fictional capital)', transfer: '6–12 h, air evacuation required',
      transferNote: 'Night flying restricted; first-light departures are typical for non-critical cases.',
      risks: ['Altitude illness', 'Malaria (low valleys)', 'Occupational injury', 'Rabies exposure'],
      season: [3, 3, 4, 2, 1, 1, 1, 1, 2, 3, 4, 3], seasonLabel: 'Malaria transmission index (valleys)',
      advice: ['Discuss altitude and antimalarial options with a travel clinic.', 'Ascend gradually and learn the warning signs of altitude illness.', 'Travel with a satellite communication device and a written emergency plan.'],
      ops: ['A site Medical Emergency Response Plan is strongly recommended.', 'Position trained medics and stabilisation equipment on site.', 'Confirm landing zones and casualty-evacuation routes for each camp.'],
      confidence: 'Low', confNote: 'Sparse, dated sources and limited on-the-ground validation; treat as provisional (illustrative).'
    }
  ];

  var tabsEl = root.querySelector('[data-intel-tabs]');
  var panel = root.querySelector('[data-intel-panel]');
  var viewBtns = Array.prototype.slice.call(root.querySelectorAll('[data-intel-view]'));
  var state = { city: 0, view: 'traveller' };
  var reduce = !!PG.reducedMotion;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function svgIcon(path) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>'; }

  // ---- City tabs (WAI-ARIA tabs pattern, automatic activation) ----
  panel.id = 'intel-panel';
  CITIES.forEach(function (c, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'intel-tab';
    b.id = 'intel-tab-' + c.id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'intel-panel');
    b.innerHTML = '<span class="intel-tab-name">' + esc(c.name) + '</span><span class="intel-tab-kind">' + esc(c.kind) + '</span>';
    b.addEventListener('click', function () { select(i, false); });
    b.addEventListener('keydown', function (e) {
      var n = CITIES.length, t = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') t = (i + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') t = (i - 1 + n) % n;
      else if (e.key === 'Home') t = 0;
      else if (e.key === 'End') t = n - 1;
      if (t !== null) { e.preventDefault(); select(t, true); }
    });
    tabsEl.appendChild(b);
  });

  function select(i, focus) {
    state.city = i;
    Array.prototype.forEach.call(tabsEl.children, function (b, j) {
      b.setAttribute('aria-selected', j === i ? 'true' : 'false');
      b.tabIndex = j === i ? 0 : -1;
      if (j === i && focus) b.focus();
    });
    panel.setAttribute('aria-labelledby', 'intel-tab-' + CITIES[i].id);
    render();
  }

  viewBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      state.view = b.getAttribute('data-intel-view');
      viewBtns.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      render();
    });
  });

  // ---- Render helpers ----
  function gauge(c) {
    var tone = c.access >= 65 ? 'good' : c.access >= 40 ? 'mid' : 'low';
    return '<div class="intel-gauge intel-gauge--' + tone + '" role="img" aria-label="Healthcare access rating ' + c.access + ' out of 100: ' + esc(c.accessLabel) + '">' +
      '<svg viewBox="0 0 120 68" aria-hidden="true">' +
      '<path class="intel-gauge-track" d="M10 62a50 50 0 0 1 100 0" pathLength="100"/>' +
      '<path class="intel-gauge-val" d="M10 62a50 50 0 0 1 100 0" pathLength="100" data-val="' + c.access + '"/>' +
      '</svg>' +
      '<div class="intel-gauge-num" aria-hidden="true"><strong>' + c.access + '</strong><span>/100</span></div>' +
      '<p class="intel-gauge-label" aria-hidden="true">' + esc(c.accessLabel) + '</p></div>';
  }

  function matrix(c, mgr) {
    var html = '<ul class="intel-caps">';
    CAPS.forEach(function (k) {
      var s = c.caps[k.key];
      html += '<li class="intel-cap intel-cap--' + s + '">' + svgIcon(k.icon) +
        '<span class="intel-cap-name">' + k.label + '</span>' +
        '<span class="intel-cap-status"><span class="intel-dot" aria-hidden="true"></span>' + STATUS[s] + '</span></li>';
    });
    html += '</ul>';
    if (mgr) html += '<p class="intel-note">' + esc(c.capNote) + '</p>';
    return html;
  }

  function chart(c) {
    var w = 240, h = 90, bw = 14, gap = (w - bw * 12) / 11, max = 5;
    var bars = c.season.map(function (v, m) {
      var bh = Math.max(4, (v / max) * (h - 18));
      var x = Math.round(m * (bw + gap) * 10) / 10;
      var lvl = v >= 4 ? 'hi' : v >= 3 ? 'mid' : 'lo';
      return '<g><title>' + MONTHS[m] + ': ' + v + ' of 5</title>' +
        '<rect class="intel-bar intel-bar--' + lvl + '" x="' + x + '" y="' + (h - 14 - bh) + '" width="' + bw + '" height="' + bh + '" rx="3" style="transition-delay:' + (m * 40) + 'ms"/>' +
        '<text x="' + (x + bw / 2) + '" y="' + (h - 2) + '" text-anchor="middle">' + MONTHS[m].charAt(0) + '</text></g>';
    }).join('');
    var summary = c.season.map(function (v, m) { return MONTHS[m] + ' ' + v; }).join(', ');
    return '<svg class="intel-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(c.seasonLabel) + ' by month, scale 0 to 5: ' + summary + '">' + bars + '</svg>' +
      '<p class="intel-legend" aria-hidden="true"><span class="intel-key intel-key--lo"></span>Low<span class="intel-key intel-key--mid"></span>Moderate<span class="intel-key intel-key--hi"></span>High</p>';
  }

  function render() {
    var c = CITIES[state.city], mgr = state.view === 'manager';
    root.setAttribute('data-intel-mode', state.view);
    panel.innerHTML =
      '<p class="visually-hidden">' + esc(c.name) + ', Republic of Meridia (fictional). ' + (mgr ? 'Manager' : 'Traveller') + ' view.</p>' +
      '<div class="intel-grid">' +
        '<article class="intel-tile intel-tile--gauge"><h3 class="intel-h">Healthcare access rating</h3>' + gauge(c) + '</article>' +
        '<article class="intel-tile intel-tile--caps"><h3 class="intel-h">Facility capability</h3>' + matrix(c, mgr) + '</article>' +
        '<article class="intel-tile intel-tile--evac"><h3 class="intel-h">Recommended evacuation hub</h3>' +
          '<p class="intel-evac-row">' + svgIcon('<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>') + '<strong>' + esc(c.hub) + '</strong></p>' +
          '<p class="intel-evac-row">' + svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') + '<span>Typical transfer: <strong>' + esc(c.transfer) + '</strong></span></p>' +
          (mgr ? '<p class="intel-note">' + esc(c.transferNote) + '</p>' : '') +
        '</article>' +
        '<article class="intel-tile intel-tile--risks"><h3 class="intel-h">Key health risks</h3><ul class="intel-chips">' +
          c.risks.map(function (r) { return '<li class="intel-chip">' + esc(r) + '</li>'; }).join('') + '</ul></article>' +
        '<article class="intel-tile intel-tile--season"><h3 class="intel-h">Seasonal risk <span class="intel-sub">' + esc(c.seasonLabel) + '</span></h3>' + chart(c) + '</article>' +
        '<article class="intel-tile intel-tile--advice"><h3 class="intel-h">' + (mgr ? 'Pre-travel &amp; operational actions' : 'Before you go') + '</h3><ul class="intel-list">' +
          c.advice.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') +
          (mgr ? c.ops.map(function (a) { return '<li class="intel-list-ops"><span class="intel-ops-tag">Ops</span>' + esc(a) + '</li>'; }).join('') : '') + '</ul></article>' +
        '<article class="intel-tile intel-tile--conf intel-conf--' + c.confidence.toLowerCase() + '"><h3 class="intel-h">Assessment confidence</h3>' +
          '<p class="intel-conf-level"><span class="intel-meter" aria-hidden="true"><i></i><i></i><i></i></span><strong>' + esc(c.confidence) + '</strong></p>' +
          '<p class="intel-note">' + (mgr ? esc(c.confNote) : 'Switch to the Security / HR manager view for sourcing detail.') + '</p>' +
        '</article>' +
      '</div>';
    animate();
  }

  function animate() {
    var val = panel.querySelector('.intel-gauge-val');
    var go = function () {
      if (val) val.style.strokeDasharray = val.getAttribute('data-val') + ' 100';
      panel.classList.add('is-drawn');
    };
    if (reduce) return go();
    if (!root.classList.contains('is-seen')) return;
    // Two frames so the initial (empty) state paints before transitioning.
    requestAnimationFrame(function () { requestAnimationFrame(go); });
  }

  // ---- CTA ----
  root.querySelector('[data-intel-cta]').addEventListener('click', function () {
    document.dispatchEvent(new CustomEvent('pg:select-service', { detail: { service: 'Global Healthcare Intelligence' } }));
    var contact = document.getElementById('contact');
    if (contact) contact.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    else location.hash = '#contact';
  });

  select(0, false);
  var reveal = function () { root.classList.add('is-seen'); animate(); };
  if (PG.onVisible) PG.onVisible(root, reveal, { threshold: 0.15 }); else reveal();
})();
