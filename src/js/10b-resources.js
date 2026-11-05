/* 10b-resources: show saved checklist progress on each resource card. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var cards = document.querySelectorAll('.resources-card[data-resource]');
    Array.prototype.forEach.call(cards, function (card) {
      var out = card.querySelector('[data-resource-progress]');
      var total = parseInt(card.getAttribute('data-total'), 10) || 0;
      if (!out || !total) return;
      var state = null;
      try { state = JSON.parse(localStorage.getItem('pelagos-resource-' + card.getAttribute('data-resource')) || 'null'); } catch (e) { state = null; }
      if (!state || typeof state !== 'object') return;
      var done = Object.keys(state).filter(function (k) { return k.indexOf('notes-') !== 0; }).length;
      if (!done) return;
      out.textContent = done >= total ? 'Completed: print or revisit anytime' : 'In progress: ' + done + ' of ' + total + ' done';
      out.hidden = false;
    });
  });
})();
