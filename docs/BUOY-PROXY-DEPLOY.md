# Cloudflare Worker deploy — Lake Michigan buoy proxy

Fixes the Home dashboard's "Lake Michigan buoy data unavailable / Load failed" error. The app is a
static, client-side-only site (`CLAUDE.md`) — every fetch it makes runs in your browser, where CORS
applies. NOAA's NDBC buoy data is a plain text file meant for server-side tools and doesn't send
CORS headers, so the browser can't fetch it directly. This Worker fetches it server-side (where
CORS never applies) and re-serves it as CORS-friendly JSON the app *can* fetch.

Worker source: `cloudflare/buoy-proxy-worker.js` (not part of the app's build — deployed separately).

## Deploy (dashboard only, no CLI needed)

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create**.
2. Choose **Create Worker** (not Pages — this is a separate, standalone Worker).
3. Give it a name, e.g. `rfc-buoy-proxy`. Click **Deploy** to create it with the default template.
4. Click **Edit code** and replace the entire contents with `cloudflare/buoy-proxy-worker.js` from
   this repo (copy the whole file).
5. Click **Deploy** again.
6. Your Worker's URL is shown at the top of the editor / on the Worker's overview page — it looks
   like `https://rfc-buoy-proxy.<your-account-subdomain>.workers.dev`.
7. **Send that exact URL back** — the app's `BUOY_PROXY_URL` constant in `src/App.jsx` (search for
   `YOUR-SUBDOMAIN`) needs it to actually call your Worker instead of showing the "not deployed
   yet" message. A follow-up commit will wire it in once you have it.

## Verify it works on its own

Visit the Worker's URL directly in a browser (or `curl` it) — it should return JSON like:

```json
{
  "generatedAt": "2026-09-25T02:00:00.000Z",
  "stations": {
    "45186": { "time": "2026-09-24T23:50:00Z", "windDirDeg": 270, "windMs": 4.1, "waveM": 0.4, "waterC": 15.5 },
    "45187": { ... },
    "45174": { ... },
    "45198": { ... },
    "45170": { ... }
  },
  "errors": {}
}
```

If a station is missing or shows up under `"errors"` instead, that specific buoy's NDBC feed is
down or reporting nothing right now — normal and expected occasionally, not a sign the Worker is
broken.

## Cost / limits

Cloudflare Workers' free tier is 100,000 requests/day — this app calls it once per Home tab load,
so normal club usage won't come close. No billing setup needed for this.
