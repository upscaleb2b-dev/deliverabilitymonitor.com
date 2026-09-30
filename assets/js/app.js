// Site chrome (typed wordmark, resources menu) plus the home-page waitlist.
// Every block guards its own elements: section pages carry the chrome but no form.
(function () {
  'use strict';

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  // ── typed wordmark ────────────────────────────────────────────────
  (function typeBrand() {
    var target = document.getElementById('brand-type');
    if (!target) return;

    var DOMAIN = 'deliverabilitymonitor.com';
    var TLD_AT = DOMAIN.length - 4; // ".com" picks up the accent colour

    function render(count) {
      var head = DOMAIN.slice(0, Math.min(count, TLD_AT));
      var tail = count > TLD_AT ? DOMAIN.slice(TLD_AT, count) : '';
      target.textContent = head;
      if (tail) {
        var dot = document.createElement('span');
        dot.className = 'type-dot';
        dot.textContent = tail;
        target.appendChild(dot);
      }
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      render(DOMAIN.length);
      return;
    }

    var wrap = target.closest('.type');
    wrap.classList.add('is-typing');

    var i = 0;
    (function step() {
      render(++i);
      if (i < DOMAIN.length) setTimeout(step, 55);
      else wrap.classList.remove('is-typing');
    })();
  })();

  // ── resources dropdown (present on every page) ────────────────────
  (function resourcesMenu() {
    var toggle = document.querySelector('.tab-menu .tab');
    var menu = document.getElementById('resources-menu');
    if (!toggle || !menu) return;

    function close() {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      var open = toggle.getAttribute('aria-expanded') === 'true';
      menu.hidden = open;
      toggle.setAttribute('aria-expanded', String(!open));
    });

    document.addEventListener('click', function (event) {
      if (!menu.hidden && !menu.contains(event.target)) close();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
  })();

  // ── waitlist (home page only) ─────────────────────────────────────
  (function waitlist() {
    var form = document.getElementById('waitlist');
    if (!form) return;

    var status = document.getElementById('form-status');
    var button = form.querySelector('.submit');
    var email = document.getElementById('email');
    var name = document.getElementById('name');
    var honeypot = document.getElementById('company_website');

    var IDLE_NOTE = status.textContent;
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
          name: name.value.trim(),
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
          name.disabled = true;
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
})();
