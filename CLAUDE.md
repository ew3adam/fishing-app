# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A React fishing app for RFC (Riverside Fishing Club, North Riverside IL). Members log catches, get species/rig guidance, scout spots, view a club feed, and sync data across devices. Client-side only (no server) — deployed as a static site to GitHub Pages, with Firebase for auth/data.

## Startup Protocol
At the start of every session:
1. Run `git fetch` and check if local branch is behind remote — if so, pull automatically.
2. Report: current branch, uncommitted changes, and a one-line summary of where we left off (see `docs/dev-session-log.md`).

## Keeping this file current
This file must stay accurate as the app evolves — that's an ongoing responsibility, not a one-off docs pass. Whenever a change touches something this file describes (tech stack, tab structure, data model/sync behavior, auth flow, a documented gotcha, the key-files table, dev commands), update the relevant section **in the same commit/PR as the code change**, not only when someone explicitly asks for a "docs" task. Before calling any non-trivial change done, check whether it made a claim here stale and fix it — treat a stale CLAUDE.md the same as a bug you introduced.

## Tech Stack
- **Framework**: React 18 + Vite 5, plain JS/JSX (no TypeScript)
- **Backend**: Firebase (Auth, Firestore, Storage) — shared project `rfc-management`, also used by a separate RFC CRM app
- **Maps**: Leaflet, OpenStreetMap tiles
- **EXIF parsing**: exifr (reads GPS coords from catch photos)
- **Weather**: Open-Meteo REST API (no key)
- **AI features**: direct browser `fetch` to `api.anthropic.com` (weather-estimate fallback, fishing tips, tackle images/lookups) — see gotcha below
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

**Gotcha:** `src/FishingApp.jsx` (~2400 lines) is a separate, unrelated file that looks like an alternate copy of the app but is **not imported anywhere** — `main.jsx` only ever renders `App.jsx`. Don't edit `FishingApp.jsx` expecting it to affect the running app; confirm with the user before touching or removing it.

### Tabs (`NAV` array in `App.jsx`, ~line 4020)
`Home` → `Species` → `Spots` → `Tackle` (`catalogue`) → `Catch` → `Scout` → `Learn`, plus `Profile` reached via a header avatar button (not in `NAV`). Each tab is its own top-level function component inside `App.jsx` (e.g. `HomeTab`, `SpotsTab`, `CatchTab`, `ProfileTab`, `ScoutTab`) — search for `function XxxTab(` to jump to one.
- **Home**: toggles between Forecast (weather + species/bait tips, optionally overridden by a pinned spot) and the Club Feed.
- **Catch**: log a new catch (photo upload, EXIF GPS, species, size via ruler overlay, weight, gear).
- **Spots**: private + club-shared fishing spots, Leaflet map picker.
- **Scout**: browse/search known spots.
- **Profile**: sign-in, member profile, gear list, favorite spots, roster import/health, theme.

### Local-first, cloud-synced data
Profile and catches live in `localStorage` first and are mirrored to Firestore once a member is signed in — this is not a thin Firestore client, so don't assume every read/write round-trips the network. Sync logic is in `src/services/fishingSyncService.js`:
- `members/{memberId}/fishingProfile/main` — level, favSpecies, favSpots, gear, privateSpots, spotActivityLog
- `members/{memberId}/fishingCatches/{catchId}` — individual catch records (photo stored in Firebase Storage, not as base64 in Firestore — see `catchPhotoStorage.js`)
- Club feed (`loadClubFeedCatches`) and the club spot map (`loadClubSharedSpots`) work by fetching the active roster and reading every member's subcollections client-side, filtering to `visibility: club/public_feed` catches and `shareClub: true` spots in JS. **That filtering is client-side only, not rules-enforced**: `firebase/firestore.rules` lets any signed-in member read the full `fishingProfile/{docId}` doc for any other member (`allow read: if isSignedIn();`), including non-shared `privateSpots` entries — the rule doesn't scope by field. Don't treat an unset `shareClub` flag as actually private; a signed-in member could read it directly from Firestore regardless of what the UI shows.

### Auth and the roster gate
Only emails present in the Firestore `members` collection (shared with the RFC CRM app, project `rfc-management`) with `isActive !== false` may use the app — `src/services/authService.js` signs the user out again if the roster lookup fails. Primary sign-in is **passwordless email link** (`sendSignInLink` / `completeSignInWithLink[AndEmail]`); email+password (`signInMemberEmail`) is kept only as a fallback for members who set a password previously. Google/Facebook/Apple/Phone are wired as placeholders (`src/config/authProviders.js`, `signInMemberOAuth`) that throw a "not configured yet" error until `VITE_*` client IDs are set and the provider is enabled in the Firebase Console.

There are two separate "roster" concepts — don't conflate them:
- **Cloud roster** (`src/services/memberService.js`) — the Firestore `members` collection, source of truth for who can sign in.
- **Local roster** (`src/services/rosterImport.js`) — a CSV/JSON import cached in `localStorage`, used for the member-sharing picker and offline directory before/without a cloud roster; seeded from `data/seeds/club-roster-v1.json`. Format documented in `docs/roster-format.md`.

### Spot privacy
`src/utils/feedSpotPrivacy.js` strips anything that looks like a street address or raw GPS coordinates before a spot name reaches the club feed or a shared catch — always route spot names shown outside a member's own private view through `formatFeedSpotName` / `buildSpotDisplayName` / `sanitizeSpotForForm` rather than passing raw strings.

### AI features have no API key
Several features (weather-estimate fallback, one-line fishing tips, tackle image/info lookups in `App.jsx`) call `https://api.anthropic.com/v1/messages` directly from the browser with **no `x-api-key`/auth header at all**. This only works in environments that transparently proxy that origin (e.g. this session's sandboxed network, or Claude.ai's artifact preview) — in a normal browser hitting the real `api.anthropic.com`, or the deployed GitHub Pages site, these calls will fail with 401/CORS errors. Most call sites (`loadFishingTip`, `loadTackleImage`) wrap the whole thing in `try/catch` and fail silently — those are fine. **`loadWeather`'s Anthropic fallback is not**: it runs unguarded inside the `catch` block that handles the Open-Meteo failure (`src/App.jsx` ~line 1016-1033), so if it also throws (CORS/network error), the exception isn't caught anywhere, `loadWeather(...)` rejects, and its only caller (`HomeTab`'s `load()`, ~line 1118) has no `.catch()` — so `setLoading(false)` never runs and the forecast can be stuck loading. Treat this as a real bug to fix (wrap the Anthropic call in its own `try/catch` returning `null`, and/or add a `.catch()` at the call site), not as an intentional silent-fallback pattern — don't add a client-exposed API key to "fix" it instead.

### Firebase config
`src/lib/firebase.js` has hardcoded fallback values for the public web config (safe to expose — it's not a secret); `VITE_FIREBASE_*` env vars override them when set (see `.env.example`). `src/config/authProviders.js` **is committed to git** (not gitignored) and reads `VITE_GOOGLE_CLIENT_ID` / `VITE_FACEBOOK_APP_ID` / `VITE_APPLE_CLIENT_ID` / `VITE_PHONE_AUTH_ENABLED` at runtime, all disabled by default; `src/config/authProviders.example.js` is an older/unused template with a different (static object) shape — prefer editing `authProviders.js` directly.

## Key Files
| File | Purpose |
|------|---------|
| `src/App.jsx` | The app — all tabs, state, and UI logic (see Architecture above) |
| `src/FishingApp.jsx` | Unused/orphaned duplicate — not imported by `main.jsx`, do not assume edits here matter |
| `src/lib/firebase.js` | Firebase init (env-var overrides via `VITE_FIREBASE_*`) |
| `src/services/fishingSyncService.js` | Firestore sync for catches, fishing profiles, club feed, club spot map |
| `src/services/authService.js` | Auth (email link + password fallback + OAuth placeholders), roster gate, cloud profile pull/push |
| `src/services/memberService.js` | Cloud roster (Firestore `members` collection) lookup/formatting helpers |
| `src/services/rosterImport.js` | Local CSV/JSON roster import + seed roster, cached in `localStorage` |
| `src/services/rosterHealthService.js` | Diagnostic check that the roster/auth Firestore reads work |
| `src/services/catchPhotoStorage.js` | Compresses + uploads catch photos to Firebase Storage; strips base64 before Firestore writes |
| `src/components/ClubFeedList.jsx` | Club-wide catch feed (pull-to-refresh, likes) |
| `src/components/SpotMapPicker.jsx` / `SpotMapThumb.jsx` | Leaflet map for picking/displaying spots |
| `src/utils/feedSpotPrivacy.js` | Strips private spot details before sharing to feed (see Architecture above) |
| `src/data/scoutSpots.js` | Static list of known scout spots |
| `data/seeds/club-roster-v1.json` | Seed data for the local roster import |
| `src/config/authProviders.js` | OAuth provider runtime config (committed; no real secrets, only client IDs) |
| `firebase/firestore.rules`, `firebase/storage.rules` | Security rules; deploy per `docs/FIREBASE-DEPLOY.md` |
| `scripts/scan-pii.js` | PII/secrets scanner (pre-commit + pre-deploy) |
| `docs/RFC-PLATFORM-PRD.md` | Platform PRD — CRM + Fishing App on shared Firebase (`rfc-management`) |
| `docs/dev-session-log.md` | Short **where we left off** / **next** — say **save state** to update |

## Coding Style
- Vanilla JS inside JSX (no TypeScript).
- Inline styles via theme objects (`THEMES.dark`, `THEMES.light`, `THEMES.bluesteel`) — no CSS modules. The same `THEMES` shape is duplicated per-file (`App.jsx`, `ClubFeedList.jsx`, etc.) rather than shared — match that pattern rather than introducing a shared import.
- `var` used throughout the codebase (mixed with `const`/`let` in newer code) — match the surrounding function's style rather than normalizing.
- Minimal diffs: no drive-by refactors unless asked; if you do touch a file, leave it cleaner per `docs/refactoring-policy.md` (delete dead code/unused imports you encounter in the area you're already editing — don't go looking for more).

## Important Constraints
- **Keep CLAUDE.md current** — update it alongside any change that affects what it documents (see "Keeping this file current" above); don't let it drift into a stale snapshot.
- **No test suite, no linter** — manually test in browser before marking anything done.
- **PII scan** — `npm run scan:pii` audits the repo; pre-commit hook blocks staged emails/phones/passwords; `npm run deploy` scans `src`, `public`, `data` first. Known-safe strings go in `scripts/pii-allowlist.txt`.
- `App.jsx` is intentionally monolithic; don't split it unless the user asks.
- Spot privacy must be respected: use `feedSpotPrivacy.js` utilities before pushing spots/catches to the club feed.
- Never commit `.env`/`.env.local`, `service-account.json`, real member CSVs, or PII in docs (also enforced by the PII scanner's blocked-filename list).
