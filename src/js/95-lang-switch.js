/* Language switcher: injects a compact EN · FR · ES · DE pill (fixed bottom-left) linking to the
   condensed translated one-pagers in public/{fr,es,de}/. */
(function () {
  'use strict';
  if (document.querySelector('.langsw')) return;

  var LANGS = [
    { code: 'en', label: 'EN', name: 'English', href: './' },
    { code: 'fr', label: 'FR', name: 'Français', href: 'fr/' },
    { code: 'es', label: 'ES', name: 'Español', href: 'es/' },
    { code: 'de', label: 'DE', name: 'Deutsch', href: 'de/' }
  ];
  // Directory URLs don't resolve to index.html when the site is opened from disk.
  var fromDisk = location.protocol === 'file:';

  var nav = document.createElement('nav');
  nav.className = 'langsw';
  nav.setAttribute('aria-label', 'Language / Langue / Idioma / Sprache');

  var list = document.createElement('ul');
  list.className = 'langsw-list';
  list.setAttribute('role', 'list');

  LANGS.forEach(function (l) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.className = 'langsw-link';
    a.textContent = l.label;
    a.setAttribute('lang', l.code);
    a.setAttribute('hreflang', l.code);
    a.setAttribute('title', l.name);
    a.setAttribute('aria-label', l.name);
    if (l.code === 'en') {
      a.href = '#top';
      a.setAttribute('aria-current', 'page');
    } else {
      a.href = fromDisk ? l.href + 'index.html' : l.href;
    }
    li.appendChild(a);
    list.appendChild(li);
  });

  nav.appendChild(list);
  document.body.appendChild(nav);
})();
