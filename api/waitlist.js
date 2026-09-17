// POST /api/waitlist — pushes a waitlist signup into GoHighLevel.
//
// Two delivery modes, picked by whichever env var is set:
//   1. GHL_WEBHOOK_URL   — an inbound webhook from a GHL workflow trigger (no key needed).
//   2. GHL_API_TOKEN     — a Private Integration token for the GHL v2 contacts API.
// GHL_WEBHOOK_URL wins if both are present.

const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'rEOhehvSrqKntIWlFlWl';
const GHL_API_VERSION = '2021-07-28';
const CONTACTS_ENDPOINT = 'https://services.leadconnectorhq.com/contacts/';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_FIELD = 200;

// Best-effort throttle. Serverless instances are ephemeral and not shared, so this
// blunts a single noisy client rather than acting as real abuse protection.
const RATE_LIMIT = { windowMs: 60_000, max: 5 };
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);

  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_LIMIT.max;
}

function clean(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_FIELD) : '';
}

function splitName(full) {
  const parts = full.split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return {};
}

async function sendToWebhook(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`GHL webhook responded ${response.status}: ${await response.text()}`);
  }
}

async function sendToContactsApi(token, payload) {
  const { firstName, lastName } = splitName(payload.name);

  const response = await fetch(CONTACTS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_API_VERSION,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      locationId: GHL_LOCATION_ID,
      email: payload.email,
      firstName,
      lastName,
      name: payload.name || undefined,
      source: payload.source,
      tags: payload.tags,
      customFields: [],
      attributionSource: {
        url: payload.attribution.referrer,
        campaign: payload.attribution.utm_campaign,
        utmSource: payload.attribution.utm_source,
        utmMedium: payload.attribution.utm_medium,
        utmContent: payload.attribution.utm_content,
        referrer: payload.attribution.referrer
      }
    })
  });

  if (response.ok) return;

  const text = await response.text();

  // An existing contact is a fine outcome for a waitlist — they are already in.
  if (response.status === 400 && /duplicat/i.test(text)) return;

  throw new Error(`GHL contacts API responded ${response.status}: ${text}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many signups from this connection. Try again shortly.' });
  }

  const body = readBody(req);
  if (!body) return res.status(400).json({ error: 'Invalid request body.' });

  // Honeypot: real people never fill this in.
  if (clean(body.company_website)) return res.status(200).json({ ok: true });

  const email = clean(body.email).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const attribution = {};
  if (body.attribution && typeof body.attribution === 'object') {
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer']) {
      const value = clean(body.attribution[key]);
      if (value) attribution[key] = value;
    }
  }

  const payload = {
    email,
    name: clean(body.name),
    source: 'Website Waitlist — deliverabilitymonitor.com',
    tags: ['waitlist', 'deliverability-monitor'],
    locationId: GHL_LOCATION_ID,
    submittedAt: new Date().toISOString(),
    attribution
  };

  const webhookUrl = process.env.GHL_WEBHOOK_URL;
  const apiToken = process.env.GHL_API_TOKEN;

  if (!webhookUrl && !apiToken) {
    console.error('Waitlist signup dropped — set GHL_WEBHOOK_URL or GHL_API_TOKEN.', { email });
    return res.status(500).json({ error: 'Waitlist is not accepting signups yet. Please email us instead.' });
  }

  try {
    if (webhookUrl) {
      await sendToWebhook(webhookUrl, payload);
    } else {
      await sendToContactsApi(apiToken, payload);
    }
  } catch (error) {
    console.error('GHL delivery failed:', error.message);
    return res.status(502).json({ error: 'We could not save your signup just now. Please try again.' });
  }

  return res.status(200).json({ ok: true });
}
