# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A React fishing app for RFC (Riverside Fishing Club, North Riverside IL). Members log catches, get species/rig guidance, scout spots, view a club feed, and sync data across devices. Client-side only (no server) — deployed as a static site to GitHub Pages, with Firebase for auth/data.

## Startup Protocol
At the start of every session:
1. Run `git fetch` and check if local branch is behind remote — if so, pull automatically.
   - Exception: if behind origin AND there are local changes, STOP and ask Adam before pulling.
2. Report: current branch, uncommitted changes, and a one-line summary of where we left off (see `docs/dev-session-log.md`).

## Keeping docs current
`CLAUDE.md` and `CHANGELOG.md` must both stay accurate as the app evolves — that's an ongoing responsibility, not a one-off docs pass.
- **`CLAUDE.md`**: whenever a change touches something this file describes (tech stack, tab structure, data model/sync behavior, auth flow, a documented gotcha, the key-files table, dev commands), update the relevant section **in the same commit/PR as the code change**, not only when someone explicitly asks for a "docs" task.
- **`CHANGELOG.md`**: add an entry under `## [Unreleased]` (Keep a Changelog format — `Added`/`Fixed`/`Removed`, etc.) for any user-facing change or notable internal fix, in the same commit/PR as the change itself.

Before calling any non-trivial change done, check whether it made a claim in either file stale and fix it — treat stale docs the same as a bug you introduced.

## Tech Stack
- **Framework**: React 18 + Vite 5, plain JS/JSX (no TypeScript)
- **Backend**: Firebase (Auth, Firestore, Storage) — shared project `rfc-management`, also used by a separate RFC CRM app
- **Maps**: Leaflet, OpenStreetMap tiles
- **EXIF parsing**: exifr (reads GPS coords from catch photos)
- **Weather**: Open-Meteo REST API (no key)
- **AI features**: direct browser `fetch` to `api.anthropic.com` (weather-estimate fallback, fishing tips, tackle images/lookups) — see gotcha below. Exception: the Fishing Assistant chat bubble goes through a Cloudflare Worker that holds the real API key, not a direct browser call.
- **Deploy**: `npm run deploy` → `gh-pages` branch (GitHub Pages); base path also supports Cloudflare Pages

## Development Commands
```bash
npm install
npm run dev       # local dev server, served at /fishing-app/ base path
npm run build     # production build
npm run preview   # preview the production build
npm run deploy    # PII scan on src/public/data, then build, then push to gh-pages
npm run scan:pii        # full-repo PII/secrets audit
npm run scan:pii:staged # staged-files-only (used by the pre-commit hook)
```
- No test suite and no linter are configured — manually verify changes in the browser.
- `npm install` runs `scripts/setup-git-hooks.js` (via the `prepare` script), which wires a pre-commit hook that blocks commits containing emails/phones/passwords (see `scripts/scan-pii.js` and `scripts/pii-allowlist.txt`).
- Firebase security rules (`firebase/firestore.rules`, `firebase/storage.rules`) are deployed separately, not by `npm run deploy`: `firebase deploy --only firestore:rules,storage --project rfc-management` (see `docs/FIREBASE-DEPLOY.md`).

## Architecture

### Entry point and the monolith
`src/main.jsx` renders `src/App.jsx` — that's the entire app. `App.jsx` (~4300 lines) owns all tabs, all state, and all UI as one file; keep changes there unless the user explicitly asks to split it (see `docs/refactoring-policy.md` for the "leave it cleaner than you found it" rule that otherwise applies).


### Tabs (`NAV` array in `App.jsx`, ~line 4528)
`Home` → `Scout` → `Species` → `Spots` → `Tackle` (`catalogue`) → `Catch` → `Learn`, plus `Profile` reached via a header avatar button (not in `NAV`). Each tab is its own top-level function component inside `App.jsx` (e.g. `HomeTab`, `SpotsTab`, `CatchTab`, `ProfileTab`, `ScoutTab`) — search for `function XxxTab(` to jump to one.
- **Home**: toggles between Forecast (weather + species/bait tips, optionally overridden by a pinned spot), the Club Feed, and Big Fish (`BigFishBoard`) — see the Big Fish Award section below.
- **Species**: field guide grid with an All/Caught/Not Yet filter and a caught checkmark badge per card (derived by matching `catch.species` against `SPECIES[].name` — exact string match, same as the personal-best check in `TrophyScreen`), reading the local-first catch cache via `loadLocalCatches()`. A species' detail page shows a "My catches" card (thumbnail via `resolveCatchPhotoUrl`, length, date, shared tag) when the member has logged one, skipped entirely otherwise — no fabricated/placeholder entries.
- **Catch**: log a new catch (photo upload, EXIF GPS, species, size via ruler overlay, weight, gear). "My catches" (own full history, private + club-shared alike — sharing to the club never removes a catch from here) is always expanded, not a collapse toggle, scrollable in its own `maxHeight` box so "Log a Catch" below stays reachable; each row shows the catch photo (`resolveCatchPhotoUrl`, falling back to the species emoji when there's no photo) plus species habitat info and the Big Fish Award toggle.
- **Spots**: private + club-shared fishing spots, Leaflet map picker.
- **Scout**: browse/search known spots, club-shared spots, and live OSM/Overpass water + businesses; results also plot as red pins on a `ScoutResultsMap` overview map (blue dot = your position) so a bad/mislabeled entry is visible before you drive there — see spot-data-quality gotcha below.
- **Profile**: sign-in, member profile, gear list, favorite spots, roster import/health, theme, inviting never-signed-in roster members via Mail/Messages (`buildInviteMailtoLink`/`buildInviteSmsLink`).

### Local-first, cloud-synced data
Profile and catches live in `localStorage` first and are mirrored to Firestore once a member is signed in — this is not a thin Firestore client, so don't assume every read/write round-trips the network. Sync logic is in `src/services/fishingSyncService.js`:
- `members/{memberId}/fishingProfile/main` — level, favSpecies, favSpots, gear, privateSpots, spotActivityLog. **Owner-read-only** (`firebase/firestore.rules`) — no other member can read this doc, `privateSpots` included, regardless of each spot's `shareClub` flag.
- `members/{memberId}/fishingProfile/clubShare` — a derived, owner-written subset containing only that member's `shareClub:true` spots (full-replace on every profile save, so un-sharing a spot actually removes it here too — see `saveFishingProfileToCloud`). **This** doc is what's actually club-readable (`allow read: if isSignedIn()`), not `main`.
- `members/{memberId}/fishingCatches/{catchId}` — individual catch records (photo stored in Firebase Storage, not as base64 in Firestore — see `catchPhotoStorage.js`)
- Club feed (`loadClubFeedCatches`) reads every member's catches subcollection client-side, filtering to `visibility: club/public_feed` in JS — catches don't have a separate club-visible doc the way spots now do, so that filtering is still client-side only (rules allow reading a catch doc if it's club-visible *or* you own it, so this one is fine as-is). The club spot map (`loadClubSharedSpots`) reads each member's `clubShare` doc above, not `main` — **this used to read the full `main` doc client-side-filtered, which meant `firestore.rules` had to allow any signed-in member to read the whole profile doc (including unshared `privateSpots`) since rules can't filter by field; fixed by splitting the club-visible data into its own doc instead.** Note: the rules-file change ships in the repo but Firestore rules deploy separately from the app (`firebase deploy --only firestore:rules,storage` — see `docs/FIREBASE-DEPLOY.md`), so confirm that's actually been run in `rfc-management` before treating this as closed in production.

### Big Fish Award — unofficial in-app board, not a judged contest
RFC runs a real monthly "Big Fish Award": members submit a fish (self-measured, not independently verified), top 3 get prizes/raffle tickets, and the year's biggest fish is honored at the November awards presentation. All entries currently go through a club officer (Jim Svestka) outside the app, and **this app does not change that** — it only gives members an in-app way to flag a catch as an entry and see informal standings, nothing more.
- A catch gets an entry by tapping "Enter Big Fish Award" (on `TrophyScreen` right after logging, or on any row in `CatchTab`'s "My catches" list), which sets `bigFish: true` on the catch record via `toggleBigFish` in `CatchTab` and `setCatchBigFishEntry` in `fishingSyncService.js`. Submitting always force-sets `visibility: "club"` — a private catch is quietly promoted to club-visible on submit (and the UI copy says so), since otherwise Firestore rules would block other members from reading it and the entry would just silently not appear on the board, which is worse than being explicit about the visibility change.
- `BigFishBoard` (`src/App.jsx`, Home tab's third toggle alongside Forecast/Club Feed) reads every member's `bigFish`-flagged catches via `loadBigFishEntries()` (same N-reads-in-parallel-with-per-member-skip-on-error pattern as `loadClubFeedCatches`), then does month/year filtering and length-sort entirely client-side. It always shows an "Unofficial standings" disclaimer and never declares a winner — that's still Jim's call, made outside the app.
- **Deliberately no email integration** — an earlier real-world report that a club email went unsent/lost (unrelated feature) is why this stayed in-app-only rather than routing entries to Jim via `mailto:`, unlike the existing per-catch "Email RFC members?" link already in `TrophyScreen`. Revisit only if asked.

### Auth and the roster gate
Only emails present in the Firestore `members` collection (shared with the RFC CRM app, project `rfc-management`) with `isActive !== false` may use the app — `src/services/authService.js` signs the user out again if the roster lookup fails. Primary sign-in is **passwordless email link** (`sendSignInLink` / `completeSignInWithLink[AndEmail]`); email+password (`signInMemberEmail`) is kept only as a fallback for members who set a password previously. Google/Facebook/Apple/Phone are wired as placeholders (`src/config/authProviders.js`, `signInMemberOAuth`) that throw a "not configured yet" error until `VITE_*` client IDs are set and the provider is enabled in the Firebase Console.

There are two separate "roster" concepts — don't conflate them:
- **Cloud roster** (`src/services/memberService.js`) — the Firestore `members` collection, source of truth for who can sign in.
- **Local roster** (`src/services/rosterImport.js`) — a CSV/JSON import cached in `localStorage`, used for the member-sharing picker and offline directory before/without a cloud roster; seeded from `data/seeds/club-roster-v1.json`. Format documented in `docs/roster-format.md`.

### Spot privacy
`src/utils/feedSpotPrivacy.js` strips anything that looks like a street address or raw GPS coordinates before a spot name reaches the club feed or a shared catch — always route spot names shown outside a member's own private view through `formatFeedSpotName` / `buildSpotDisplayName` / `sanitizeSpotForForm` rather than passing raw strings.

### Spot data quality is unverified — don't trust coordinates on faith
`src/data/scoutSpots.js` (`SCOUT_SPOTS`) is a hand-typed lat/lng list — nothing checks it against real-world data, and it has shipped at least one confirmed-wrong entry (a "DPR — Riverside Lagoon" pin reported ~0.5mi off from the real Swan Pond location). Live Overpass/Nominatim results in Scout are labeled "Unverified" for the same reason — OSM tags can mislabel or mis-locate a feature, and this app has no way to confirm a pin is really on fishable water vs. private property from the server side. `ScoutResultsMap` (red pins on a Leaflet map, in Scout's "Near Me" view) exists specifically so a member can *visually* catch a bad pin before driving out — treat that as the actual verification mechanism, not something to duplicate with more automated "is this real" logic. If you're asked to fix a specific bad `SCOUT_SPOTS` entry, get real coordinates from the reporting member (a dropped pin/link) rather than guessing from geocoding — this sandbox's network egress blocks Nominatim, Overpass, and even generic `WebFetch` to most map/reference sites (confirmed: `nominatim.openstreetmap.org`, `openstreetmap.org`, `wikipedia.org`, `riverside.il.us` all blocked), so coordinates can't be independently verified from here; `WebSearch` still works for background research.

### AI features have no API key
Several features (weather-estimate fallback, one-line fishing tips, tackle image/info lookups in `App.jsx`) call `https://api.anthropic.com/v1/messages` directly from the browser with **no `x-api-key`/auth header at all**. This only works in environments that transparently proxy that origin (e.g. this session's sandboxed network, or Claude.ai's artifact preview) — in a normal browser hitting the real `api.anthropic.com`, or the deployed GitHub Pages site, these calls will fail with 401/CORS errors. Most call sites (`loadFishingTip`, `loadTackleImage`) wrap the whole thing in `try/catch` and fail silently — those are fine. **`loadWeather`'s Anthropic fallback is not**: it runs unguarded inside the `catch` block that handles the Open-Meteo failure (`src/App.jsx` ~line 1016-1033), so if it also throws (CORS/network error), the exception isn't caught anywhere, `loadWeather(...)` rejects, and its only caller (`HomeTab`'s `load()`, ~line 1118) has no `.catch()` — so `setLoading(false)` never runs and the forecast can be stuck loading. Treat this as a real bug to fix (wrap the Anthropic call in its own `try/catch` returning `null`, and/or add a `.catch()` at the call site), not as an intentional silent-fallback pattern — don't add a client-exposed API key to "fix" it instead.

**The Fishing Assistant is the one exception** (`src/components/FishingAssistant.jsx`, the chat bubble on Home) — it does NOT call Anthropic from the browser. It calls a Cloudflare Worker (`cloudflare/fishing-assistant-worker.js`, same no-server-side-key-in-the-bundle pattern as the buoy proxy below) that holds a real `ANTHROPIC_API_KEY` secret and makes the actual API call server-side. Requires a signed-in member (checks a Firebase ID token via Firebase's own `accounts:lookup` REST endpoint — not a full active-roster check, see the Worker file's top comment for the known limitation). Scoped by its own system prompt to answer only from the real context `HomeTab` sends it (weather, buoy report, nearby spots, bait tips) plus general fishing knowledge — told explicitly not to invent regs numbers or specifics it wasn't given. `FISHING_ASSISTANT_URL` in that component is a placeholder (`YOUR-SUBDOMAIN`) until the Worker is deployed — see `docs/FISHING-ASSISTANT-DEPLOY.md`.

### Firebase config
`src/lib/firebase.js` has hardcoded fallback values for the public web config (safe to expose — it's not a secret); `VITE_FIREBASE_*` env vars override them when set (see `.env.example`). `src/config/authProviders.js` **is committed to git** (not gitignored) and reads `VITE_GOOGLE_CLIENT_ID` / `VITE_FACEBOOK_APP_ID` / `VITE_APPLE_CLIENT_ID` / `VITE_PHONE_AUTH_ENABLED` at runtime, all disabled by default; `src/config/authProviders.example.js` is an older/unused template with a different (static object) shape — prefer editing `authProviders.js` directly.

## Key Files
| File | Purpose |
|------|---------|
| `src/App.jsx` | The app — all tabs, state, and UI logic (see Architecture above) |
| `src/lib/firebase.js` | Firebase init (env-var overrides via `VITE_FIREBASE_*`) |
| `src/services/fishingSyncService.js` | Firestore sync for catches, fishing profiles, club feed, club spot map, Big Fish Award entries |
| `src/services/authService.js` | Auth (email link + password fallback + OAuth placeholders), roster gate, cloud profile pull/push |
| `src/services/memberService.js` | Cloud roster (Firestore `members` collection) lookup/formatting helpers |
| `src/services/rosterImport.js` | Local CSV/JSON roster import + seed roster, cached in `localStorage` |
| `src/services/rosterHealthService.js` | Diagnostic check that the roster/auth Firestore reads work |
| `src/services/catchPhotoStorage.js` | Compresses + uploads catch photos to Firebase Storage; strips base64 before Firestore writes |
| `src/components/ClubFeedList.jsx` | Club-wide catch feed (pull-to-refresh, likes) |
| `src/components/FishingAssistant.jsx` | Home chat bubble — scoped Q&A grounded in real app data, via Worker (not a direct Anthropic call) |
| `cloudflare/fishing-assistant-worker.js` | Holds the real `ANTHROPIC_API_KEY` secret server-side; deployed separately, see `docs/FISHING-ASSISTANT-DEPLOY.md` |
| `src/components/SpotMapPicker.jsx` / `SpotMapThumb.jsx` | Leaflet map for picking/displaying spots |
| `src/components/ScoutResultsMap.jsx` | Read-only Leaflet overview map for Scout results (red pins) — visual sanity-check, not a picker |
| `src/utils/feedSpotPrivacy.js` | Strips private spot details before sharing to feed (see Architecture above) |
| `src/data/scoutSpots.js` | Static list of known scout spots |
| `public/rfc-logo.png` | Real club logo (black line art, transparent PNG) — referenced via `RFC_LOGO_SRC`, always on a fixed white chip/card since it's invisible directly on a dark theme's background |
| `data/seeds/club-roster-v1.json` | Seed data for the local roster import |
| `src/config/authProviders.js` | OAuth provider runtime config (committed; no real secrets, only client IDs) |
| `firebase/firestore.rules`, `firebase/storage.rules` | Security rules; deploy per `docs/FIREBASE-DEPLOY.md` |
| `scripts/scan-pii.js` | PII/secrets scanner (pre-commit + pre-deploy) |
| `docs/RFC-PLATFORM-PRD.md` | Platform PRD — CRM + Fishing App on shared Firebase (`rfc-management`) |
| `docs/dev-session-log.md` | Short **where we left off** / **next** — say **save state** to update |
| `CHANGELOG.md` | User-facing + notable internal changes, Keep a Changelog format under `[Unreleased]` — keep current per "Keeping docs current" above |

## Coding Style
- Vanilla JS inside JSX (no TypeScript).
- Inline styles via theme objects (`THEMES.dark`, `THEMES.light`, `THEMES.bluesteel`) — no CSS modules. The same `THEMES` shape is duplicated per-file (`App.jsx`, `ClubFeedList.jsx`, etc.) rather than shared — match that pattern rather than introducing a shared import.
- `var` used throughout the codebase (mixed with `const`/`let` in newer code) — match the surrounding function's style rather than normalizing.
- Minimal diffs: no drive-by refactors unless asked; if you do touch a file, leave it cleaner per `docs/refactoring-policy.md` (delete dead code/unused imports you encounter in the area you're already editing — don't go looking for more).

## Important Constraints
- **Keep CLAUDE.md and CHANGELOG.md current** — update both alongside any change that affects what they document (see "Keeping docs current" above); don't let them drift into a stale snapshot.
- **No test suite, no linter** — manually test in browser before marking anything done.
- **PII scan** — `npm run scan:pii` audits the repo; pre-commit hook blocks staged emails/phones/passwords; `npm run deploy` scans `src`, `public`, `data` first. Known-safe strings go in `scripts/pii-allowlist.txt`.
- `App.jsx` is intentionally monolithic; don't split it unless the user asks.
- Spot privacy must be respected: use `feedSpotPrivacy.js` utilities before pushing spots/catches to the club feed.
- Never commit `.env`/`.env.local`, `service-account.json`, real member CSVs, or PII in docs (also enforced by the PII scanner's blocked-filename list).
