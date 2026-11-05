/* 04 — Services: audience filter, detail dialog, "Discuss this" hand-off to the contact form. */
(function () {
  'use strict';
  var PG = window.PG || {};
  var $ = PG.$, $$ = PG.$$;

  function init() {
    var root = $('#services');
    if (!root) return;
    var cards = $$('.services-card', root);
    var chips = $$('.services-filter__chip', root);
    var status = $('[data-services-status]', root);

    // ---------------- Filter ----------------
    function applyFilter(key) {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.filter === key)); });
      var shown = 0;
      cards.forEach(function (card) {
        var match = key === 'all' || (' ' + card.dataset.audience + ' ').indexOf(' ' + key + ' ') > -1;
        if (match) shown++;
        var hidden = card.classList.contains('is-hidden');
        if (PG.reducedMotion) {
          card.classList.toggle('is-hidden', !match);
          return;
        }
        if (match && hidden) {
          card.classList.remove('is-hidden', 'is-leaving');
          card.classList.add('is-visible');
          card.classList.remove('is-entering'); void card.offsetWidth; card.classList.add('is-entering');
        } else if (!match && !hidden) {
          card.classList.remove('is-entering');
          card.classList.add('is-leaving');
          setTimeout(function () {
            if (card.classList.contains('is-leaving')) { card.classList.add('is-hidden'); card.classList.remove('is-leaving'); }
          }, 220);
        } else if (match) {
          card.classList.remove('is-leaving');
        }
      });
      var label = chips.filter(function (c) { return c.dataset.filter === key; })[0];
      if (status) status.textContent = shown + ' services shown' + (key === 'all' ? '' : ' for ' + label.textContent);
    }
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () { applyFilter(chip.dataset.filter); });
    });

    // ---------------- Dialog ----------------
    var dialog = $('.services-dialog', root);
    if (!dialog) return;
    var titleEl = $('.services-dialog__title', dialog);
    var iconEl = $('.services-dialog__icon', dialog);
    var bodyEl = $('.services-dialog__body', dialog);
    var cta = $('.services-dialog__cta', dialog);
    var opener = null;
    var current = null;
    var supportsDialog = typeof dialog.showModal === 'function';

    function openFor(card, trigger) {
      current = { slug: card.dataset.slug, label: $('.services-card__title', card).textContent.trim() };
      titleEl.textContent = current.label;
      iconEl.innerHTML = $('.services-card__icon', card).innerHTML;
      bodyEl.innerHTML = $('.services-detail', card).innerHTML;
      bodyEl.scrollTop = 0;
      cta.setAttribute('href', '#contact?service=' + current.slug);
      opener = trigger || null;
      document.documentElement.classList.add('services-lock');
      if (supportsDialog) dialog.showModal(); else dialog.setAttribute('open', '');
      var close = $('.services-dialog__close', dialog);
      if (close) close.focus();
    }

    function closeDialog() {
      if (!dialog.open) return;
      if (supportsDialog) dialog.close(); else { dialog.removeAttribute('open'); onClosed(); }
    }
    function onClosed() {
      document.documentElement.classList.remove('services-lock');
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
      opener = null;
    }
    dialog.addEventListener('close', onClosed);

    root.addEventListener('click', function (e) {
      var btn = e.target.closest('.services-card__more');
      if (btn) openFor(btn.closest('.services-card'), btn);
    });
    $('.services-dialog__close', dialog).addEventListener('click', closeDialog);
    $('.services-dialog__back', dialog).addEventListener('click', closeDialog);

    // Backdrop click: the dialog has no padding and its inner panel fills it, so a click whose
    // target is the <dialog> itself can only come from the ::backdrop.
    dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDialog(); });

    // Focus trap + Esc (native showModal handles Esc too; this covers the fallback)
    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeDialog(); return; }
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', dialog)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // ---------------- Hand-off to contact ----------------
    function selectService(slug, label) {
      try { document.dispatchEvent(new CustomEvent('pg:select-service', { detail: { service: label, slug: slug } })); } catch (err) {}
      window.location.hash = 'contact?service=' + slug;
      var contact = document.getElementById('contact');
      if (contact) contact.scrollIntoView({ behavior: PG.reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }

    cta.addEventListener('click', function (e) {
      if (!current) return;
      e.preventDefault();
      var c = current;
      opener = null; // focus moves on to the contact section, not back to the card
      closeDialog();
      selectService(c.slug, c.label);
    });

    $$('.services-tier__cta', root).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        selectService(a.getAttribute('href').split('service=')[1], a.dataset.serviceLabel);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
