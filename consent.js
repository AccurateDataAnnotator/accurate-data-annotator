/* ADA cookie consent banner
 * - Accept / Reject have equal weight. The site works either way.
 * - Choice is stored in localStorage under 'consent_ada_v1'
 *   (deliberately NOT prefixed "ada_" so the device-reset tool in zunoon.js does not wipe it).
 * - Other scripts can read the choice with ADAConsent.get() / ADAConsent.allows('analytics'|'ads')
 *   and react with ADAConsent.onChange(fn). Analytics and ad scripts must only load when allowed.
 */
(function () {
  'use strict';
  var KEY = 'consent_ada_v1';
  var listeners = [];

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return (v && (v.choice === 'accepted' || v.choice === 'rejected')) ? v : null;
    } catch (e) { return null; }
  }
  function save(choice) {
    var v = { choice: choice, ts: new Date().toISOString(), v: 1 };
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
    listeners.forEach(function (fn) { try { fn(v); } catch (e) {} });
    return v;
  }

  window.ADAConsent = {
    get: read,
    allows: function () { var c = read(); return !!c && c.choice === 'accepted'; },
    onChange: function (fn) { listeners.push(fn); },
    open: function () { showBanner(); }
  };

  var banner = null;

  function hideBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function showBanner() {
    if (banner) return;
    banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Cookie choices');
    banner.innerHTML =
      '<div class="cookie-banner-text">' +
        '<strong>Your cookie choice</strong>' +
        '<p>We use essential storage to make this platform work. With your permission we also use analytics and advertising cookies. ' +
        'The site works the same if you reject. <a href="cookies.html">Cookie Policy</a> &middot; <a href="privacy.html">Privacy Policy</a></p>' +
      '</div>' +
      '<div class="cookie-banner-actions">' +
        '<button type="button" class="cookie-btn" data-choice="rejected">Reject</button>' +
        '<button type="button" class="cookie-btn" data-choice="accepted">Accept</button>' +
      '</div>';
    document.body.appendChild(banner);
    banner.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-choice]') : null;
      if (!b) return;
      save(b.getAttribute('data-choice'));
      hideBanner();
    });
  }

  function init() {
    var links = document.querySelectorAll('[data-cookie-settings]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function () { showBanner(); });
    }
    if (!read()) showBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
