# Scaling Watchlist — external dependencies to keep an eye on

This app runs entirely on free tiers and no-key public APIs today. That's fine at RFC's current
size, but every one of these has a ceiling. This doc exists so a future session (or Adam) can
check it periodically rather than discovering a limit by hitting it. Nothing here is urgent —
it's a watchlist, not a backlog.

Revisit this doc if: membership grows noticeably, a feature gets used a lot more than expected,
or something that used to work starts intermittently failing.

## Geocoding — OSM Nominatim (`nominatim.openstreetmap.org`)

**Used for**: Scout's manual location search (`geocodePlaceName`) and the "use my location"
reverse-geocode display (`reverseGeocodePlace`).

**The free public instance's usage policy caps clients at ~1 request/second and asks for no bulk
use** — this app is nowhere near that at RFC's size (a member searches/GPS-fixes a handful of
times per session, not in a tight loop), but it's a shared, free, best-effort service with no SLA.
It already fails intermittently for reasons unrelated to load (see `CLAUDE.md`'s "Scout's search
box" gotcha — a GPS fix with no named place at that exact point is a normal result, not an outage).

**Watch for**: requests start getting rejected/blocked outright (not just "no place name back"),
or response times climb noticeably across many members.
**If it becomes a real problem**: a paid geocoder (Mapbox, Google Geocoding, LocationIQ) or a
self-hosted Nominatim instance. Low priority — this app's geocoding volume is tiny.

## Live water/business lookups — Overpass API

**Used for**: `loadNearbyWater` / `loadNearbyFishingBusinesses` in Scout, via the shared
`fetchOverpass` helper (`App.jsx`) trying `overpass-api.de` then `overpass.kumi.systems` in order.

Already documented in `CLAUDE.md` as flaky under load (429/504 with no CORS headers, surfacing as
an opaque browser fetch failure) — that's why there are two mirrors plus a manual Retry button
today. This is the dependency most likely to produce a support question ("Scout shows nothing
near me") that isn't actually a data problem.

**Watch for**: both mirrors failing together more often than occasionally — would suggest this
app's own traffic, or a third-party outage pattern, rather than the free servers' normal flakiness.
**If it becomes a real problem**: a third mirror, a short client-side cache of recent queries (same
spot searched repeatedly in one session), or a dedicated/paid Overpass instance.

## Weather — Open-Meteo (`api.open-meteo.com`)

**Used for**: Forecast on Home (`HomeTab`'s weather load, `App.jsx` ~line 1089). No API key, no
rate limit enforced for this kind of non-commercial volume per Open-Meteo's own docs. Lowest-risk
dependency in this app — flagging it here only for completeness.

## NOAA NDBC buoy data — via `cloudflare/buoy-proxy-worker.js`

NDBC's own realtime text files have no rate limit stated, and this Worker's own doc
(`docs/BUOY-PROXY-DEPLOY.md`) already notes Cloudflare's free tier (100,000 requests/day) is far
more than a club needs at one Worker call per Home tab load. Nothing to add here beyond what's
already documented there — just keeping the full dependency list in one place.

## Direct-from-browser Anthropic calls — no API key (`App.jsx`)

**This one is a known gap, not just a future scaling concern.** `loadWeather`'s AI fallback,
`loadFishingTip`, and `loadTackleImage` call `api.anthropic.com` directly from the browser with no
auth header at all. Per `CLAUDE.md`'s "AI features have no API key" gotcha, this only works in a
sandboxed/proxied environment (this dev session, or Claude.ai's artifact preview) — **on the real
deployed site (GitHub Pages / Cloudflare Pages), these calls already fail with 401/CORS errors
today.** Most of them fail silently (by design, acceptable); `loadWeather`'s fallback has an actual
bug where an uncaught rejection can leave the forecast stuck loading (also already flagged in
`CLAUDE.md`).

**If these features are worth having for real** (AI weather estimate, one-line tips, tackle image
lookups), the fix isn't a client-exposed API key — it's the same pattern already used for the
Fishing Assistant: a small Cloudflare Worker holding the real key server-side, with the browser
calling the Worker instead of Anthropic directly. That's new infrastructure to build, not a
limit to watch — listed here so it isn't forgotten as "working" when it currently isn't in
production.

## Fishing Assistant — Cloudflare Worker + Anthropic (`cloudflare/fishing-assistant-worker.js`)

Already documented in `docs/FISHING-ASSISTANT-DEPLOY.md`:
- **Cloudflare**: free tier is 100,000 requests/day — not a concern at this scale.
- **Anthropic**: billed per request to Adam's own Anthropic account. Each message is capped (max
  500 output tokens, Haiku — the cheapest current model). **There's no per-member usage cap** —
  the app's login gate is the only access control, so cost scales directly with how much members
  actually use the chat bubble.

**Watch for**: actual Anthropic usage-dashboard spend, especially in the first few weeks after
members discover it. If a handful of members chat heavily, cost is still small per message, but
there's currently no ceiling if usage is much higher than expected.
**Known separate gap** (also in `CLAUDE.md`): the Worker checks for *any* signed-in Firebase user,
not a full active-roster check — worth tightening before this gets wider use, independent of cost.

## Firebase (`rfc-management` project) — Auth, Firestore, Storage

Shared with the separate RFC CRM app, so usage here isn't the only load on this project's quota.

- **Firestore reads**: Club Feed (`loadClubFeedCatches`) and the club spot map
  (`loadClubSharedSpots`) both read every active member's subcollection in parallel
  (`Promise.all`, fixed from a slower sequential loop per `docs/BUG-TRIAGE-AND-FEATURE-ROADMAP.md`
  BUG-3) — but it's still **N reads per feed/map load**, where N is roster size. This scales
  linearly with both membership count and how often members open Home/Scout. `BigFishBoard` reads
  every member's catches the same way. This is the Firestore cost center most likely to grow with
  the club, not with any single feature's traffic.
- **Firestore writes**: normal catch logging / profile saves / likes / comments — all
  per-member-action, not loop-driven, low risk of a surprise spike.
- **Storage**: catch photos are compressed client-side before upload (`catchPhotoStorage.js`), so
  per-photo cost is controlled, but total storage still grows with every catch ever logged with a
  photo, forever (no deletion/retention policy exists).
- **Which billing plan** (Spark/free vs. Blaze/pay-as-you-go) this project is actually on isn't
  recorded in this repo's docs — worth confirming directly in the Firebase Console rather than
  assuming, since that determines whether a quota gets throttled (free) or just billed (paid) once
  exceeded.

**Watch for**: Firestore usage dashboard trending toward its free-tier daily read/write limits as
roster size or feed engagement grows; Storage size trending up with no offsetting cleanup.
**If it becomes a real problem**: the roadmap in `docs/BUG-TRIAGE-AND-FEATURE-ROADMAP.md` already
flags a `collectionGroup` query redesign as the real fix for the N-reads pattern, just not needed
yet at RFC's size.

## GitHub Pages / Cloudflare Pages hosting

Both free, both generous for a small club site (GitHub Pages' soft bandwidth guidance is far above
what a few dozen members browsing a lightweight static app would use). Lowest-risk item on this
list — included only for completeness.

## Not yet in place: automated CI code review

There's currently no GitHub Actions workflow in this repo (`.github/workflows/` is empty) — the
`bug-fixes` subagent review happens only within a live Claude Code session, on PRs opened from one,
not on every push to the repo from any source. If that broader always-on coverage is wanted later,
it needs a GitHub Actions workflow running Claude Code against each push/PR, which costs an
Anthropic API key stored as a repo secret and runs (and costs) on every push — a deliberate
decision to make later, not something to add by default.
