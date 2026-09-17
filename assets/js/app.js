// Waitlist form: validate, submit to /api/waitlist, report state inline.
(function () {
  'use strict';

  var form = document.getElementById('waitlist');
  var status = document.getElementById('form-status');
  var button = form.querySelector('.submit');
  var email = document.getElementById('email');
  var name = document.getElementById('name');
  var honeypot = document.getElementById('company_website');

  var IDLE_NOTE = status.textContent;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  document.getElementById('year').textContent = String(new Date().getFullYear());

  function setNote(message, state) {
    status.textContent = message;
    status.classList.toggle('is-error', state === 'error');
    status.classList.toggle('is-success', state === 'success');
  }

  // Attribution: keep whatever the ad/link carried so GHL sees the source.
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
