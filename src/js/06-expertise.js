/* 06 — Expertise: animated depth dots, dot-matrix world map with region hotspots + live panel. */
(function () {
  'use strict';
  var PG = window.PG || {};
  var $ = PG.$ || function (s, c) { return (c || document).querySelector(s); };
  var $$ = PG.$$ || function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var NS = 'http://www.w3.org/2000/svg';

  // Very simplified continent outlines as [lon, lat] polygons (stylised, not cartographic).
  var LAND = [
    [[-168,66],[-140,70],[-95,72],[-80,68],[-62,60],[-55,50],[-66,44],[-76,35],[-81,25],[-97,26],[-97,18],[-87,15],[-80,8],[-85,10],[-105,20],[-117,32],[-125,42],[-125,50],[-135,58],[-150,60],[-165,60]],
    [[-55,82],[-25,83],[-20,70],[-42,60],[-55,68]],
    [[-80,10],[-62,11],[-50,0],[-35,-6],[-39,-15],[-48,-28],[-58,-38],[-66,-55],[-73,-50],[-72,-30],[-70,-18],[-81,-5],[-78,2]],
    [[-10,36],[-9,43],[-4,48],[2,51],[8,54],[5,58],[10,63],[20,70],[30,71],[40,68],[40,45],[28,41],[26,36],[15,38],[3,42],[-5,36]],
    [[-6,50],[2,51],[-2,57],[-5,58],[-6,55]],
    [[-17,21],[-10,30],[-6,36],[10,37],[20,32],[32,31],[35,28],[43,12],[51,12],[42,0],[40,-15],[35,-25],[27,-34],[18,-34],[12,-17],[13,-5],[9,4],[-8,5],[-17,14]],
    [[44,-13],[50,-15],[48,-25],[44,-24]],
    [[35,32],[36,37],[44,38],[50,37],[60,26],[57,22],[52,16],[44,12],[38,20],[33,28]],
    [[40,45],[40,68],[60,70],[80,73],[105,78],[140,72],[180,68],[170,60],[160,58],[142,52],[140,45],[130,42],[122,40],[122,30],[110,20],[108,12],[100,15],[98,8],[92,22],[80,8],[72,20],[66,25],[60,26],[50,37],[44,38],[40,42]],
    [[95,5],[105,-6],[120,-9],[140,-8],[140,-2],[120,2],[110,4],[100,6]],
    [[130,32],[140,35],[142,44],[138,40]],
    [[114,-22],[122,-17],[131,-12],[137,-12],[142,-11],[146,-19],[153,-26],[150,-37],[140,-38],[131,-31],[115,-34]],
    [[172,-35],[178,-38],[172,-46],[167,-46]]
  ];

  var BASE = [-9.1, 38.7]; // Portugal base, for the connecting arc

  var REGIONS = {
    latam: {
      name: 'Latin America', at: [-73.3, -3.7], box: [-120, 33, -30, -60],
      title: 'Where it began',
      text: '1993–1995 with Médecins du Monde in Iquitos, Peru: administrator and logistician for NGO emergency medical assistance during the cholera outbreak in the Amazon basin.',
      tags: ['Outbreak response', 'Field logistics', 'Humanitarian']
    },
    namerica: {
      name: 'North America', at: [-95, 40], box: [-170, 85, -50, 15],
      title: 'Two decades of global programs',
      text: 'GlobalCare, FrontierMEDEX, then from 2012 to 2025 directing health, aeromedical and logistics intelligence at UnitedHealth Group and UnitedHealthcare Global.',
      tags: ['Global assistance', 'Insurers & TPAs', 'Universities']
    },
    europe: {
      name: 'Europe', at: [10, 50], box: [-12, 72, 40, 35],
      title: 'The aeromedical standards community',
      text: 'Now based in Portugal. EURAMI board member from 2012 to 2018 and Chair of its Ethics Committee since 2024, inside the accreditation body for air ambulance and medical escort providers. Educated at Université Paris 1 Panthéon-Sorbonne.',
      tags: ['Accreditation', 'Ethics', 'Air ambulance']
    },
    mea: {
      name: 'Middle East & Africa', at: [31, 30], box: [-18, 38, 62, -36],
      title: 'Crisis coordination',
      text: 'At FrontierMEDEX, helped coordinate with universities during emergencies abroad, such as the 2011 unrest in Egypt. Later, health intelligence and Medical Emergency Response Plans for remote locations.',
      tags: ['Crisis support', 'Study abroad safety', 'Remote locations']
    },
    apac: {
      name: 'Asia-Pacific', at: [115, 12], box: [62, 80, 180, -48],
      title: 'A truly global remit',
      text: 'Global provider quality assessment and country health surveillance at UnitedHealthcare Global, preparing globally mobile customers for the healthcare landscape of their next assignment, wherever it is.',
      tags: ['Provider quality', 'Country health surveillance', 'Global mobility']
    }
  };

  function inPoly(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function px(ll) { return [ll[0] + 180, 90 - ll[1]]; }

  function initDots(root) {
    var groups = $$('.expertise-area', root);
    groups.forEach(function (area) {
      var depth = parseInt(area.getAttribute('data-depth'), 10) || 0;
      var holder = $('.expertise-dots', area);
      for (var i = 0; i < 5; i++) holder.appendChild(document.createElement('i'));
      var dots = $$('i', holder);
      function fill() {
        dots.forEach(function (d, i) {
          if (i >= depth) return;
          if (PG.reducedMotion) d.classList.add('is-on');
          else setTimeout(function () { d.classList.add('is-on'); }, 120 + i * 110);
        });
      }
      if (PG.onVisible) PG.onVisible(area, fill, { threshold: 0.4 }); else fill();
    });
  }

  function initMap(root) {
    var svg = $('.expertise-map-svg', root);
    var g = $('.expertise-map-dots', root);
    var arc = $('.expertise-map-arc', root);
    var hotLayer = $('.expertise-hotspots', root);
    var panel = $('#expertise-panel', root);
    var buttons = $$('.expertise-region', root);
    if (!svg || !g || !panel) return;

    // Dot-matrix land
    var dots = [];
    var frag = document.createDocumentFragment();
    for (var lat = 82; lat >= -58; lat -= 3.6) {
      for (var lon = -178; lon <= 180; lon += 3.6) {
        for (var k = 0; k < LAND.length; k++) {
          if (inPoly(lon, lat, LAND[k])) {
            var c = document.createElementNS(NS, 'circle');
            var p = px([lon, lat]);
            c.setAttribute('cx', p[0].toFixed(1)); c.setAttribute('cy', p[1].toFixed(1)); c.setAttribute('r', '1.15');
            frag.appendChild(c); dots.push({ el: c, lon: lon, lat: lat });
            break;
          }
        }
      }
    }
    g.appendChild(frag);

    // Hotspots (pointer convenience; the region buttons are the accessible controls)
    var hotspots = {};
    Object.keys(REGIONS).forEach(function (key) {
      var r = REGIONS[key];
      var p = px(r.at);
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'expertise-hotspot'; b.tabIndex = -1;
      b.style.left = (p[0] / 360 * 100) + '%';
      b.style.top = ((p[1] - 6) / 150 * 100) + '%';
      var lbl = document.createElement('span'); lbl.className = 'expertise-hotspot-label'; lbl.textContent = r.name;
      b.appendChild(lbl);
      b.addEventListener('click', function () { select(key); });
      b.addEventListener('mouseenter', function () { highlight(key); });
      b.addEventListener('mouseleave', function () { highlight(current); });
      hotLayer.appendChild(b);
      hotspots[key] = b;
    });

    var current = null;

    function highlight(key) {
      var box = REGIONS[key].box; // [west, north, east, south]
      dots.forEach(function (d) {
        d.el.classList.toggle('is-hot', d.lon >= box[0] && d.lon <= box[2] && d.lat <= box[1] && d.lat >= box[3]);
      });
    }

    function drawArc(key) {
      var a = px(BASE), b = px(REGIONS[key].at);
      if (key === 'europe') { arc.setAttribute('d', ''); return; }
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      var dist = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2));
      var cy = my - dist * 0.35;
      arc.setAttribute('d', 'M' + a[0] + ',' + a[1] + ' Q' + mx + ',' + cy.toFixed(1) + ' ' + b[0] + ',' + b[1]);
      if (!PG.reducedMotion) arc.classList.add('is-drawing');
    }

    function render(key) {
      var r = REGIONS[key];
      panel.innerHTML = '';
      var kicker = document.createElement('p'); kicker.className = 'expertise-panel-kicker'; kicker.textContent = r.name;
      var h = document.createElement('h4'); h.className = 'expertise-panel-title'; h.textContent = r.title;
      var t = document.createElement('p'); t.className = 'expertise-panel-text'; t.textContent = r.text;
      var ul = document.createElement('ul'); ul.className = 'expertise-panel-tags';
      r.tags.forEach(function (tag) { var li = document.createElement('li'); li.textContent = tag; ul.appendChild(li); });
      panel.appendChild(kicker); panel.appendChild(h); panel.appendChild(t); panel.appendChild(ul);
      if (!PG.reducedMotion) {
        panel.classList.remove('is-swapping'); void panel.offsetWidth; panel.classList.add('is-swapping');
      }
    }

    function select(key, silent) {
      if (!REGIONS[key]) return;
      var changed = key !== current;
      current = key;
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-region') === key)); });
      Object.keys(hotspots).forEach(function (k) { hotspots[k].classList.toggle('is-active', k === key); });
      highlight(key);
      drawArc(key);
      if (changed && !silent) render(key);
    }

    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () { select(b.getAttribute('data-region')); });
      b.addEventListener('mouseenter', function () { highlight(b.getAttribute('data-region')); });
      b.addEventListener('mouseleave', function () { if (current) highlight(current); });
      b.addEventListener('keydown', function (e) {
        var dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        var next = buttons[(i + dir + buttons.length) % buttons.length];
        next.focus(); select(next.getAttribute('data-region'));
      });
    });

    select('latam', true); // panel already holds the Latin America copy in HTML
  }

  function init() {
    var root = document.getElementById('expertise');
    if (!root) return;
    initDots(root);
    initMap(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
