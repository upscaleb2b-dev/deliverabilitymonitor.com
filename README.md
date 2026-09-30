# deliverabilitymonitor.com

Closed-beta lander for **Deliverability Monitor** — "the deliverability layer" —
with a waitlist form that pushes signups into GoHighLevel.

Terminal/console aesthetic: monospace, dark, status chips, console chrome.
No build step, no framework, no dependencies — static HTML/CSS/JS plus one
serverless function.

```
index.html          the lander
assets/css/style.css
assets/js/app.js    form validation + submit
api/waitlist.js     serverless endpoint that delivers signups to GHL
test/waitlist.test.js
```

## Brand assets

The nav has no logo — it types out `deliverabilitymonitor.com` once on load, caret
trailing the text, `.com` in accent green. A hidden full-width copy of the string
reserves the space so the nav never reflows mid-type; `prefers-reduced-motion`
renders it instantly.

The favicon is the "sentinel" mark: a chamfered chassis with an antenna alert
lamp, jointed limbs and a scanline across a chamfered **D**.

| File | Used for |
| --- | --- |
| `assets/icons/favicon.svg` | 32px and up — full mark with limbs and antenna |
| `assets/icons/favicon-16.svg` | 16px — limbs and antenna dropped, D maximal |
| `assets/icons/favicon-16.png`, `favicon-32.png` | fallbacks for browsers without SVG favicon support |
| `assets/icons/apple-touch-icon.png` | 180px, opaque plate (iOS applies its own mask) |

Two files exist because arms, legs, a flap and a letter cannot coexist in 256
pixels — the detailed mark turns to mush at 16px. Browsers pick per size via the
`sizes` attribute on each `<link rel="icon">`.

**The D is drawn as a path, not text.** SVG favicons render without webfonts, so a
`font-family` reference would fall back to whatever monospace each OS ships. Edit
the letter by editing the path.

## Page structure

Multi-page static site. Tabs in the header are real pages, not anchors, so the
home page stays short.

| Path | File | Contents |
| --- | --- | --- |
| `/` | `index.html` | Hero console with the waitlist form, monitor rail, closing CTA |
| `/what-we-monitor` | `what-we-monitor.html` | Six panels — inboxes, infrastructure, placement signals, campaign health, benchmarks, integrations |
| `/how-it-works` | `how-it-works.html` | Connect → Monitor → Diagnose → Act |
| `/ai-native` | `ai-native.html` | Claude skills, GPT/Grok prompt packs, MCP server |
| `/api-docs` | `api-docs.html` | Endpoint list and sample response |
| `/faq` | `faq.html` | Four Q&As |
| `/join` | `join.html` | Opt-in page — the old closing CTA band, now with its own waitlist form and a "what happens next" list |

Every "join the closed beta" CTA — nav, section-page bands — points at `/join`.
The home page keeps its own form in the hero console, so two pages carry a
waitlist form; both use the same `#waitlist` markup and the same handler.

Clean URLs come from `"cleanUrls": true` in `vercel.json`, which serves
`what-we-monitor.html` at `/what-we-monitor`. The API page is `/api-docs` rather
than `/api` so it cannot collide with the `api/` serverless function directory.

**The header and footer are duplicated across all six files.** There is no build
step, so changing a nav link or a footer entry means editing every page. They are
byte-identical, so a find-and-replace across `*.html` works.

`assets/js/app.js` runs on every page. Each block guards its own elements: the
typed wordmark and resources dropdown run everywhere, the waitlist logic returns
early when `#waitlist` is absent.

The wordmark text is in the markup, so it renders before JS and without JS. The
typing animation replays only on the first page of a visit (tracked in
`sessionStorage`) — every tab is a full page load, so animating each time would
blank the header on every navigation.

The resources menu opens on hover where the pointer supports it, and on click
everywhere. A pointer click on a hover device only opens, never toggles, or the
hover that just opened it would be undone; keyboard activation (`event.detail
=== 0`) still toggles properly.

**Everything user-facing is placeholder copy.** Before launch, replace the monitor
rail numbers, every `beta`/`alpha`/`soon` chip, the API routes and sample
response, the Claude skill names, the MCP install command, and all four FAQ
answers.


## Connecting GoHighLevel

The form posts to `/api/waitlist`, which forwards the signup to GHL sub-account
(location) `rEOhehvSrqKntIWlFlWl`. Pick **one** of two delivery modes by setting
one environment variable.

### Option 1 — Inbound webhook (recommended, no API key)

1. In GHL, go to **Automation → Workflows → Create Workflow**.
2. Add the trigger **Inbound Webhook** and copy the URL it generates.
3. Set `GHL_WEBHOOK_URL` to that URL.
4. In the same workflow, add a **Create/Update Contact** action and map the
   incoming fields (below) onto the contact.

### Option 2 — Contacts API

1. In GHL, go to **Settings → Private Integrations → Create**, grant the
   `contacts.write` scope, and copy the token.
2. Set `GHL_API_TOKEN` to that token.

Contacts are created directly against the location, tagged `waitlist` and
`deliverability-monitor`. An email that already exists is treated as success —
they're already on the list.

If both variables are set, the webhook wins.

### Payload sent to GHL

```json
{
  "email": "founder@example.com",
  "name": "Ada Lovelace",
  "source": "Website Waitlist — deliverabilitymonitor.com",
  "tags": ["waitlist", "deliverability-monitor"],
  "locationId": "rEOhehvSrqKntIWlFlWl",
  "submittedAt": "2026-09-17T00:00:00.000Z",
  "attribution": { "utm_source": "linkedin", "utm_campaign": "launch", "referrer": "..." }
}
```

UTM parameters on the landing URL are captured automatically and passed through,
so paid traffic attributes correctly in GHL.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GHL_WEBHOOK_URL` | one of the two | Inbound-webhook URL from a GHL workflow |
| `GHL_API_TOKEN` | one of the two | Private Integration token, `contacts.write` |
| `GHL_LOCATION_ID` | no | Defaults to `rEOhehvSrqKntIWlFlWl` |

Copy `.env.example` to `.env` for local work. If neither delivery variable is
set, the endpoint returns a 500 and logs the dropped signup rather than silently
losing it.

## Local development

```bash
npm run dev     # vercel dev — serves the page and /api/waitlist together
npm test        # endpoint tests, no network calls
```

To preview just the page without the API, any static server works
(`python3 -m http.server`); the form will fail on submit, which is expected.

## Deploying

Built for Vercel — push the repo, import the project, add the environment
variable, and it ships as-is. The static files and `api/waitlist.js` need no
configuration beyond `vercel.json`.

On another host, port `api/waitlist.js` to that platform's function signature;
the GHL logic is self-contained and platform-agnostic apart from the
`req`/`res` handler shape.

## Spam handling

- Hidden honeypot field (`company_website`) — filled means silently accepted and
  dropped.
- Per-IP throttle of 5 signups/minute, best-effort within a warm instance.
- Email validated on both the client and the server.
