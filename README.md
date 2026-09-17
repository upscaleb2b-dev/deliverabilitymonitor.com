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

## Page structure

| Section | `#id` | Notes |
| --- | --- | --- |
| Hero console | — | Headline, waitlist form, placeholder monitor rail |
| Connect & monitor | `#monitor` | 6 panels — inboxes, infrastructure, placement signals, campaign health, benchmarks, integrations |
| Built AI native | `#ai` | Claude skills, GPT/Grok/Perplexity prompt packs, MCP server |
| The API | `#api` | Endpoint list + sample response |
| How it works | `#how` | 4 steps |
| CTA band | — | "Built for the future of outbound" |
| FAQ | `#faq` | 4 placeholder Q&As |

**Everything user-facing is placeholder copy.** Before launch, replace: the monitor
rail numbers, the `beta`/`alpha`/`soon` status chips on every feature line, the
API routes and sample response, the Claude skill names, the MCP install command,
and all four FAQ answers.

Status chips are `.chip-beta` (green), `.chip-alpha` (amber) and `.chip-soon`
(grey) — swap the class to change a line's status.

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
