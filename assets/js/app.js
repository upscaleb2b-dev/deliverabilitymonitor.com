// Waitlist prompt: validate, submit to /api/waitlist, report state inline.
// Also types the wordmark out on first load.
(function () {
  'use strict';

  var form = document.getElementById('waitlist');
  var status = document.getElementById('form-status');
  var button = form.querySelector('.submit');
  var email = document.getElementById('email');
  var honeypot = document.getElementById('company_website');

  var IDLE_NOTE = status.textContent;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  document.getElementById('year').textContent = String(new Date().getFullYear());

  // ── typed wordmark ────────────────────────────────────────────────
  (function typeBrand() {
    var target = document.getElementById('brand-type');
    if (!target) return;

    var NAME = 'Deliverability Monitor';
    var ACCENT_AT = NAME.indexOf('Monitor'); // last word picks up the accent colour

    function render(count) {
      var head = NAME.slice(0, Math.min(count, ACCENT_AT));
      var tail = count > ACCENT_AT ? NAME.slice(ACCENT_AT, count) : '';
      target.textContent = head;
      if (tail) {
        var accent = document.createElement('span');
        accent.className = 'type-dot';
        accent.textContent = tail;
        target.appendChild(accent);
      }
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      render(NAME.length);
      return;
    }

    var wrap = target.closest('.type');
    wrap.classList.add('is-typing');

    var i = 0;
    (function step() {
      render(++i);
      if (i < NAME.length) setTimeout(step, 55);
      else wrap.classList.remove('is-typing');
    })();
  })();

  // The full prompt copy clips on narrow screens, so shorten it there.
  (function syncPlaceholder() {
    var LONG = 'enter your work email to request closed beta access';
    var SHORT = 'your work email';
    function apply() { email.placeholder = window.innerWidth < 620 ? SHORT : LONG; }
    apply();
    window.addEventListener('resize', apply);
  })();

  // ── "1 / Join the closed beta." drops the cursor in the prompt ────
  var focusLink = document.querySelector('[data-focus-email]');
  if (focusLink) {
    focusLink.addEventListener('click', function (event) {
      event.preventDefault();
      email.focus();
    });
  }

  // ── waitlist ──────────────────────────────────────────────────────
  function setNote(message, state) {
    status.textContent = message;
    status.classList.toggle('is-error', state === 'error');
    status.classList.toggle('is-success', state === 'success');
  }

  // Keep whatever the ad or link carried so GHL sees the source.
  function attribution() {
    var params = new URLSearchParams(window.location.search);
    var out = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (key) {
      var value = params.get(key);
      if (value) out[key] = value.slice(0, 120);
    });
    if (document.referrer) out.referrer = document.referrer.slice(0, 300);
    return out;
  }

  email.addEventListener('input', function () {
    email.removeAttribute('aria-invalid');
    if (status.classList.contains('is-error')) setNote(IDLE_NOTE, 'idle');
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    if (form.classList.contains('is-loading') || form.dataset.done === 'true') return;

    var address = email.value.trim();
    if (!EMAIL_RE.test(address)) {
      email.setAttribute('aria-invalid', 'true');
      email.focus();
      setNote('// error: that email address does not look right.', 'error');
      return;
    }

    form.classList.add('is-loading');
    button.disabled = true;
    setNote('// requesting access…', 'idle');

    fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: address,
        company_website: honeypot.value, // honeypot, must stay empty
        attribution: attribution()
      })
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) throw new Error(body.error || 'Request failed');
          return body;
        });
      })
      .then(function () {
        form.dataset.done = 'true';
        form.classList.remove('is-loading');
        button.querySelector('.submit-label').textContent = 'access requested';
        email.disabled = true;
        setNote('// confirmed. your invite goes to ' + address + ' when the next wave opens.', 'success');
      })
      .catch(function (error) {
        form.classList.remove('is-loading');
        button.disabled = false;
        setNote(
          error && error.message && error.message !== 'Request failed'
            ? error.message
            : '// error: request failed. try again, or email hello@deliverabilitymonitor.com.',
          'error'
        );
      });
  });
})();
