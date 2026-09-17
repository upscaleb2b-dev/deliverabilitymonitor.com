// Exercises api/waitlist.js against a stubbed fetch — no network, no real GHL calls.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/test/webhook';

const { default: handler } = await import('../api/waitlist.js');

function mockRes() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

function mockReq(body, { method = 'POST', ip = '203.0.113.' + Math.random() } = {}) {
  return { method, body, headers: { 'x-forwarded-for': ip }, socket: {} };
}

let captured = [];
globalThis.fetch = async (url, init) => {
  captured.push({ url, init, payload: JSON.parse(init.body) });
  return { ok: true, status: 200, text: async () => '' };
};

test('rejects non-POST', async () => {
  const res = mockRes();
  await handler(mockReq({}, { method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
});

test('rejects a malformed email', async () => {
  const res = mockRes();
  await handler(mockReq({ email: 'not-an-email' }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /valid email/i);
});

test('accepts a valid signup and forwards it to GHL', async () => {
  captured = [];
  const res = mockRes();
  await handler(
    mockReq({
      email: '  Founder@Example.COM ',
      name: 'Ada Lovelace',
      attribution: { utm_source: 'linkedin', referrer: 'https://linkedin.com/' }
    }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(captured.length, 1);

  const sent = captured[0].payload;
  assert.equal(sent.email, 'founder@example.com', 'email is trimmed and lowercased');
  assert.equal(sent.name, 'Ada Lovelace');
  assert.equal(sent.locationId, 'rEOhehvSrqKntIWlFlWl');
  assert.deepEqual(sent.tags, ['waitlist', 'deliverability-monitor']);
  assert.equal(sent.attribution.utm_source, 'linkedin');
});

test('swallows honeypot submissions without calling GHL', async () => {
  captured = [];
  const res = mockRes();
  await handler(mockReq({ email: 'bot@spam.com', company_website: 'http://spam.biz' }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(captured.length, 0, 'nothing reaches GHL');
});

test('throttles a burst from one IP', async () => {
  const ip = '198.51.100.7';
  let last;
  for (let i = 0; i < 7; i++) {
    last = mockRes();
    await handler(mockReq({ email: `user${i}@example.com` }, { ip }), last);
  }
  assert.equal(last.statusCode, 429);
});

test('surfaces a GHL failure as a 502', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  const res = mockRes();
  await handler(mockReq({ email: 'ok@example.com' }), res);
  assert.equal(res.statusCode, 502);
});
