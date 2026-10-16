# Changelog — RFC Fishing App

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — In Progress

### Added
- **Passwordless email link sign-in** (primary flow): member types their club email →
  taps "Send me a sign-in link" → Firebase emails a magic link → tap opens app and
  signs in automatically. No password creation required; Firebase Auth account is
  created on first link use.
- `authService.sendSignInLink(email)` — sends `signInWithEmailLink` email; stores
  email in localStorage for same-device auto-complete.
- `authService.isSignInLink(href)` — detects Firebase email-link URLs.
- `authService.completeSignInWithLink(href)` — completes sign-in on same device
  (reads email from localStorage); returns `{ needsEmail: true }` if opened on a
  different device.
- `authService.completeSignInWithLinkAndEmail(email, href)` — completes sign-in when
  user must confirm their email (different-device scenario).
- **Mount-time link detection** in `App.jsx`: on load, checks if the URL is an email
  sign-in link; if so, navigates to Profile tab, cleans the URL, and auto-completes
  (or shows a confirm-email prompt for different-device opens).
- **ProfileTab auth modes** (replaced old signin/signup/forgot with):
  - `link` — default: email input + "Send me a sign-in link" button
  - `link-sent` — confirmation screen with "check your email" message
  - `link-completing` — spinner while auto-completing on same device
  - `link-confirm` — email-confirm prompt for different-device sign-in
  - `password` — fallback password sign-in for members who set one up previously
- **Plain-language errors** (`translateAuthError`): all Firebase error codes mapped to
  friendly messages understandable by any user.
- **Password show/hide toggle** in password fallback mode.

### Removed
- `authService.signUpMemberEmail` — replaced by email link (auto-creates account on
  first sign-in).
- `authService.sendMemberPasswordReset` — replaced by send-link flow.
- "First time here?" / "Create account" / "Forgot password?" UI modes — email link
  flow handles all three cases in one step.

### Added (continued)
- **Club Spots badge**: red number badge on Spots tab nav icon when new club-shared spots
  exist since the member's last visit; clears on opening Club Spots view.
- **Self excluded from sharing picker**: signed-in user no longer sees themselves in the
  member list when sharing a spot.
- **Saved spots visible on Guide view**: user's private spots appear at the top of the
  Spots tab main view without needing to switch to "My spots" toggle.
- **"Your spots" card on Home**: after GPS loads, shows closest private spots with
  species and seasonal bait tips.
- **Pinned spot → RFC Bite Forecast**: new `pinHome` boolean on spots. Toggled via
  "Show on home page" checkbox in the map-picker save form and spot detail Sharing
  section. When pinned, the RFC Bite Forecast card shows that spot's name, species,
  bait tips, and notes instead of the nearest generic water. Only one spot can be
  pinned at a time. Falls back to generic nearest water when no spot is pinned.

### Added (continued)
- **Severe weather disclaimer on Home**: "Today's Conditions" card now warns that the
  fishing-conditions score doesn't check flood/storm/wind alerts, and points members to
  their phone's Weather app or weather.gov before heading out.
- **Scout tab overhaul**: adjustable search radius (1–50mi, was fixed at 10), a
  location search field (scout a place you're not standing in), direction-exclude
  chips, club-shared spots pulled into Scout's results, live named-water and
  fishing-business lookups from OpenStreetMap/Overpass (with a best-effort
  public/private access label and an "unverified" disclaimer), and an IRAP card
  linking to Illinois DNR's official private-land fishing access program.
- **NWS severe weather alert banner on Home**: pulls active alerts for the member's
  location from the free NWS API and shows them above the Bite Forecast card,
  explicitly separate from the bite-quality score (which has no way to know about
  flood/storm conditions on its own).
- **GPS-fallback notice on Home and Scout**: if location access is denied, times out,
  or isn't supported, both tabs now show a clear warning that results are centered on
  a default location (North Riverside, IL) instead of silently showing the wrong
  spots with no explanation — plus a Retry button. The Scout "can't load live water"
  message also moved from the bottom of a long results list to right under the
  search controls, where it's actually visible.

### Added (continued)
- **Scout results map**: "Near Me" now shows a read-only overview map (blue dot =
  you, red pins = every known/club/OSM/business result currently listed) above the
  result cards, so a member can visually check a pin actually sits on water before
  trusting the card — prompted by a reported bad `SCOUT_SPOTS` coordinate.

### Changed
- **Bottom nav order**: Scout moved from 6th to 2nd position, right after Home
  (`Home, Scout, Species, Spots, Tackle, Catch, Learn`).

### Fixed
- **Home rain % stuck at 0%**: `loadWeather` was requesting Open-Meteo's
  `precipitation_probability` under `current` params, but that field only exists
  under `hourly` — rain chance silently always read 0%. Now reads the correct hourly
  value for the current hour.
- **Spots: stale pre-filled name**: tapping a Guide Spot to prefill a spot name, then
  dragging the map pin more than ~0.3mi away, now clears the name (with a heads-up
  hint while it's still unedited) instead of silently keeping a name that no longer
  matches the pin.
- **Home forecast could get stuck loading**: `loadWeather`'s Anthropic-estimate
  fallback could throw with nothing to catch it, leaving the forecast on "Fetching
  live conditions…" forever if both Open-Meteo and the fallback failed. Now guarded
  with its own try/catch plus a defensive `.catch()` at the call site.
- **Scout: empty search silently did nothing** — tapping "Go" in the "Search a
  location" card with an empty field now shows "Type a city, zip, or address first."
  instead of no-oping with zero feedback. ([PR #23](https://github.com/ew3adam/fishing-app/pull/23), merged)

### Fixed — full-codebase bug triage
_See `docs/BUG-TRIAGE-AND-FEATURE-ROADMAP.md` for the full triage (7 bugs, ranked P0–P2)
this line of work is drawn from. All merged._
- **BUG-1 (P0) — catch photos could exceed `localStorage` quota and break catch
  logging**: photos are now compressed before ever being written to `localStorage`
  (not just before the Firebase Storage upload), the `rfc_catches_v1` write is
  wrapped in try/catch with a toast on quota failure instead of failing silently,
  and the local base64 copy is dropped once a cloud `photoUrl` exists.
  ([PR #28](https://github.com/ew3adam/fishing-app/pull/28), merged)
- **BUG-2 (P1) — corrupt local catch data could silently break post-sign-in sync**:
  the unguarded `JSON.parse` on `rfc_catches_v1` in the post-sign-in effect is now
  wrapped in try/catch, defaulting to `[]`. ([PR #28](https://github.com/ew3adam/fishing-app/pull/28), merged)
- **BUG-3 (P1) — club feed and club-spot map did N sequential Firestore reads**:
  `loadClubFeedCatches` and `loadClubSharedSpots` now issue all per-member reads via
  `Promise.all` instead of a sequential loop. ([PR #29](https://github.com/ew3adam/fishing-app/pull/29), merged)
- **BUG-4 (P1) — sign-in could fail for roster emails not stored lowercase**:
  `findMemberByEmail` now falls back to a case-insensitive scan of active members
  (reusing the existing email normalization) instead of guessing at alternate
  casings, so a mixed-case CRM-imported email no longer blocks sign-in.
  ([PR #29](https://github.com/ew3adam/fishing-app/pull/29), merged)
- **BUG-5 (P1) — CSV roster import broke on quoted fields containing commas**: now
  uses a real RFC-4180-aware tokenizer instead of a naive `split(",")`; a row whose
  column count doesn't match the header throws a clear error instead of silently
  importing shifted data. ([PR #31](https://github.com/ew3adam/fishing-app/pull/31), merged)
- **BUG-6 (P2) — sign-in email link could fail with `auth/unauthorized-continue-uri`
  on non-canonical domains**: `sendSignInLink` no longer builds the Firebase
  continue-link URL from `window.location` at send time — hardcoded to the canonical
  `https://ew3adam.github.io/fishing-app/` in production builds, falling back to
  `window.location` only in local dev. ([PR #32](https://github.com/ew3adam/fishing-app/pull/32), merged)
- **BUG-10 — club feed like button could double-count on a rapid double-tap**
  (found in a follow-up audit, not the original triage). ([PR #36](https://github.com/ew3adam/fishing-app/pull/36), merged)
- **BUG-8/BUG-9 — spot-name privacy fallback bugs** (found in the same follow-up audit).
  ([PR #35](https://github.com/ew3adam/fishing-app/pull/35), merged)
- **Maps: pinch-zoom snap-back; pin placement switched to press-and-hold**
  ([PR #24](https://github.com/ew3adam/fishing-app/pull/24), merged).
- **Scout: results map re-centered on every render; default search radius set to 5mi**
  ([PR #25](https://github.com/ew3adam/fishing-app/pull/25), merged).
- **Home rain alert/sign-in regressions from the 2026-09-03 reconciliation merge**:
  `WelcomeBanner` restored non-blocking (not a gate — PR #37), sign-in email link
  actually completes sign-in again (`setTab("me")` call restored — PR #38).
  ([PR #37](https://github.com/ew3adam/fishing-app/pull/37), [PR #38](https://github.com/ew3adam/fishing-app/pull/38), merged)

### Added — developer tooling
- `docs/BUG-TRIAGE-AND-FEATURE-ROADMAP.md` — full-codebase bug triage (7 issues,
  P0–P2) and feature-idea PRDs, written outside any single feature PR.
  ([PR #26](https://github.com/ew3adam/fishing-app/pull/26), merged)
- `bug-fixes` review subagent + a `Stop` hook that gates new code against the triage
  doc. ([PR #27](https://github.com/ew3adam/fishing-app/pull/27), merged)
- **FEATURE-2 — text-size setting**: Small/Medium/Large picker in Profile, persists
  to `localStorage`, applies a CSS `zoom` to the app's single root wrapper (scales
  the whole app without touching ~480 individual `fontSize` declarations).
  ([PR #33](https://github.com/ew3adam/fishing-app/pull/33), merged)

### Added — login, Home dashboard & theme (PRs #37–#50)
- **Non-blocking `WelcomeBanner`** for signed-out visitors, later restyled to match a
  "Screen 1: Splash" mockup (fish-on-the-line hero art, "RFC Fishing" wordmark).
  ([PR #37](https://github.com/ew3adam/fishing-app/pull/37), [PR #39](https://github.com/ew3adam/fishing-app/pull/39), merged)
- **Scout "search complete" confirmation** — green toast after "Use my location"
  finishes its GPS+search cycle. ([PR #40](https://github.com/ew3adam/fishing-app/pull/40), merged)
- **Production hardening**: top-level React error boundary (`ErrorBoundary.jsx`) so
  an uncaught render error shows a recoverable fallback instead of a white screen;
  `firebase` dependency bump (12.14.0 → 12.19.0) resolving a `protobufjs` vuln.
  ([PR #41](https://github.com/ew3adam/fishing-app/pull/41), merged)
- **Real privacy fix for private spots**: new owner-written `clubShare` Firestore doc
  (full-replace, only already-`shareClub:true` spots) is now the only thing
  club-readable; the full profile doc (`privateSpots` included) is owner-read-only.
  ⚠️ **The updated `firestore.rules` are merged and app-deployed but still need a
  manual `firebase deploy --only firestore:rules,storage --project rfc-management`
  run by someone with Firebase CLI access before the new rule is actually enforced**
  — not something any sandboxed coding session has credentials to do itself.
  ([PR #42](https://github.com/ew3adam/fishing-app/pull/42), merged)
- **Home dashboard rebuilt** to match a shared mockup: real weather card (added
  `humidity`), Nearby Hot Spots (real `SCOUT_SPOTS` distances), Recent Catch, and a
  "Top Catch — Club Feed" section. ([PR #43](https://github.com/ew3adam/fishing-app/pull/43), merged)
- **Login/profile overhaul**: one-time `WelcomeSplash` (shown once per device ever),
  Profile Name/Email made read-only once signed in (sourced from the roster, with a
  "Request a change" mailto), and real self-service password reset via Firebase's
  `sendPasswordResetEmail`. ([PR #44](https://github.com/ew3adam/fishing-app/pull/44), merged)
- **Removed the confusing "Join us" button** — it and "Sign in" did the same thing;
  single "Sign in" button now. ([PR #45](https://github.com/ew3adam/fishing-app/pull/45), merged)
- **Full login gate**: no tab content is reachable while signed out — `App()` renders
  only `WelcomeSplash` (full-page, no nav, embedded sign-in form, no skip/dismiss)
  whenever `!authMember`. Reverses the earlier "keep open browsing" decision at the
  user's explicit request. ([PR #46](https://github.com/ew3adam/fishing-app/pull/46), merged)
- **New default "beige" theme**: warm ivory background, white cards, muted sage-green
  accent — `THEMES.beige`, now the app default (was dark). Fixed a hardcoded
  dark-green `index.css` body background that never synced to the selected theme.
  ([PR #47](https://github.com/ew3adam/fishing-app/pull/47), merged)
- **Restyled AI species recognition** in the Catch flow to match a FishAngler
  reference: thumbnail + checkmark + confidence bar, tap-to-select instead of a
  separate "✓ Use" button. ([PR #48](https://github.com/ew3adam/fishing-app/pull/48), merged)
- **Simplified the Catch flow's measurement step**: defaults to a plain editable
  length number pre-filled from the AI photo estimate; the full ruler/reference-object
  system moved behind a "Measure precisely from photo instead" link.
  ([PR #49](https://github.com/ew3adam/fishing-app/pull/49), merged)
- **Three Catch-flow bug fixes**: "Use Photo" always opened the camera instead of the
  photo library (stray `capture="environment"` removed); searching "musky" found
  nothing even though Muskellunge exists (added species aliases); Bullhead's icon was
  an ox emoji (🐂, an unclear catfish pun) — swapped to a plain fish emoji.
  ([PR #50](https://github.com/ew3adam/fishing-app/pull/50), merged)

### Added — Lake Michigan buoy shore report & tactics (PRs #51–#55)
- **Lake Michigan buoy shore report on Home**: translates live NOAA NDBC buoy
  readings (5 stations) into a 🟢/🟡/🔴 shore-fishing status, a daily bait rotation,
  and RFC's verified bait shop list, per RFC's own buoy-translation rules.
  ([PR #51](https://github.com/ew3adam/fishing-app/pull/51), merged)
- Widened the buoy data window (6h → 24h, since the upstream API 404s on a
  zero-row match rather than returning empty) and made fetch failures show visibly
  in the UI instead of silently vanishing. ([PR #52](https://github.com/ew3adam/fishing-app/pull/52), merged)
- **Fixed the buoy report failing on real devices (CORS)**: the data source has no
  CORS headers for browser `fetch`, so a small standalone Cloudflare Worker
  (`cloudflare/buoy-proxy-worker.js`) now proxies it server-side. ⚠️ **The app calls
  a placeholder `BUOY_PROXY_URL` until the Worker is actually deployed to the user's
  own Cloudflare account** (dashboard-only steps in `docs/BUOY-PROXY-DEPLOY.md`) —
  no sandboxed session has Cloudflare credentials to do this itself.
  ([PR #53](https://github.com/ew3adam/fishing-app/pull/53), merged)
- **Time-of-day bait tactics**: connects the existing golden-hour/solunar window data
  to the "Try:" bait callout on Home — dawn/dusk, midday, and after-dark technique
  guidance layered under the existing real per-species bait name. Also added
  Indiana/Michigan/Wisconsin official DNR regs links alongside the existing Illinois
  one. ([PR #54](https://github.com/ew3adam/fishing-app/pull/54), merged)
- **Real MidwestOutdoors tactical tips**: condensed real how-to content (jig/rig/setup
  tips) from the MidwestOutdoors articles already referenced in the app into 1-2
  sentence summaries, surfaced next to the matching species on Home and in the
  Fishing Articles list. Also fixed several of those article URLs, which didn't match
  either source site's real structure. ([PR #55](https://github.com/ew3adam/fishing-app/pull/55), merged)

### Added — documentation
- **"Keeping docs current" standing policy** in `CLAUDE.md`: update `CLAUDE.md` and
  this changelog in the same commit/PR as the code change they describe, not as a
  separate pass. ([PR #56](https://github.com/ew3adam/fishing-app/pull/56), merged)

### Next
- **Firebase Console (manual, one-time steps)**:
  1. Authentication → Sign-in method → Add provider → **Email link (passwordless)** → Enable
  2. Authentication → Settings → Authorized domains → Add `ew3adam.github.io`
- Email/Password provider can stay enabled as fallback.
- Admin panel: list members + `authUid` link status (who has signed in vs. not yet)
- **⚠️ Run `firebase deploy --only firestore:rules,storage --project rfc-management`**
  to actually enforce PR #42's privacy rule (merged in code since; not yet confirmed
  live in Firestore).
- **⚠️ Deploy `cloudflare/buoy-proxy-worker.js`** per `docs/BUOY-PROXY-DEPLOY.md` and
  send back its real `*.workers.dev` URL to replace the `BUOY_PROXY_URL` placeholder
  in `src/App.jsx` (PR #53).
- **⚠️ Supply RFC's real buoy wave/wind thresholds** for the 🟢/🟡/🔴 shore-fishing
  status (PR #51 shipped with proposed placeholder defaults, asked for twice, not
  yet received).
- **⚠️ Real-device confirmation** still outstanding for PRs #44, #46, #47, #48, #49,
  #50, #54, #55 — all verified only via headless-browser/sandbox testing so far.
- **src/FishingApp.jsx** is still unreferenced dead code (confirmed again while
  closing stale PR #9) — removal needs the user's explicit go-ahead per `CLAUDE.md`.

---

## [Phase 8] — Infrastructure & Developer Tooling
_Commits: `4ff6853` → `2194187`_

### Added
- `CLAUDE.md` — Claude Code session instructions and codebase map
- `.cursor/rules/brief-directions.mdc` — Cursor collaboration norms
- PII scan (`npm run scan:pii`) — audits `src/`, `public/`, `data/` before deploy
- Pre-commit hook — blocks staged emails, phones, or passwords from being committed
- `docs/dev-session-log.md` — session continuity log (updated via **save state**)
- `docs/RFC-PLATFORM-PRD.md` — platform PRD for CRM + Fishing App on shared Firebase
- Deploy guard: PII scan runs automatically before `npm run deploy`

---

## [Phase 7] — Scout Tab & Club Map
_Commits: `6da095a` → `d964de0`_

### Added
- **Scout tab** — dedicated tab for browsing and searching known fishing spots
- Leaflet map integration — interactive map with spot pins and thumbnails
- In-app spot map — tap any spot to view details and map location
- `SpotMapPicker` component — reusable Leaflet map for picking/displaying spots
- `scoutSpots.js` — curated database of known RFC spots
- SVG ruler overlay improvements — better UX for fish measurement
- 5-tab navigation — Log, Feed, Scout, Profile, Settings

---

## [Phase 6] — Firebase Auth, Roster Gate & Cloud Sync
_Commits: `0207bfe` → `04b8ee8`_

### Added
- **Firebase Authentication** — email/password sign-in
- **Roster gate** — only emails in the Firestore `members` collection can sign in
- **Cross-device sync** — catches, profile, gear, and spots sync to Firestore on sign-in
- `authService.js` — sign-in, sign-out, auth state subscription, roster verification
- `fishingSyncService.js` — Firestore read/write for catches and fishing profile
- `memberService.js` — member lookup, roster queries, `authUid` linking
- `catchPhotoStorage.js` — photos upload to Firebase Storage; Firestore stores URL only
- **Club Feed** — members' club-visible catches appear in a shared feed
- **Home Forecast / Club Feed toggle** — Feed tab switches between weather and club catches
- `ClubFeedList.jsx` — renders club-wide catch feed
- `feedSpotPrivacy.js` — strips private spot details before pushing to club feed
- Firebase Security Rules — members can only read/write their own data; club feed is read-only
- Like/unlike catches in Club Feed (increments `likeCount` in Firestore)
- Toast notifications for cloud save success and errors
- `firebase.js` — Firebase init with env-var overrides (`VITE_FIREBASE_*`)

---

## [Phase 5] — Weather Card & Home Dashboard
_Commits: `ba960a8` → `632a0e3`_

### Added
- Live weather card on Home tab — temperature, conditions, wind
- Sunrise and sunset times in weather card
- Moon phase display — fishing moon phase shown on Home
- Nearby fishing locations — 3 closest spots shown under weather card
- "Search Near Me" button with GPS distance sorting

---

## [Phase 4] — UI Polish, Branding & Tackle
_Commits: `1ec06c2` → `5751034`_

### Added
- RFC branding — app renamed to Riverside Fishing Club
- Orange RFC icons and PWA manifest icons
- Persistent header bar with RFC logo and profile avatar
- Modernized Home UI — card-based layout
- Mobile nav refinements — bottom tab bar
- **Tackle tab** — list and tile views, ordering controls
- **Species tab** — sortable species list, favorites, touch controls
- Spot card reordering — drag to reorder saved spots
- Species card reordering — drag to reorder saved species
- GitHub Pages + Cloudflare Pages dual deployment support

---

## [Phase 3] — Spots, Maps & Location
_Commits: `9ba78b1` → `e3a4e4a`_

### Added
- **Private Spots** — GPS-save personal spots with name, notes, photos
- **Near Me** — sorts spots by GPS distance; shows Chicago lakefront spots
- In-app map pin picker — tap map to save a custom spot location
- Spots search — search by name across Local, Near Me, and Lakes views
- Lakes tab — browse nearby lakes with FPDCC depth map links
- Salmon Trail spots — dedicated trail toggle
- Shore access, parking, and boat launch info per spot
- Custom location flow — manually enter spot address or coordinates
- Spot sharing — share club spots with specific members
- Club map — shared spots visible to club members

---

## [Phase 2] — Catch Wizard & Measurement
_Commits: `222564b` → `4098ad6`_

### Added
- **Guided Catch Wizard** — multi-step flow: photo → species → measurement → details → save
- Ruler overlay — SVG ruler pinned to catch photo for length measurement
- Horizontal and vertical ruler orientation toggle
- Photo rotation and portrait display fixes
- EXIF GPS extraction — auto-fills spot from photo metadata (`exifr`)
- Weight estimation — length-to-weight regression by species
- Species picker step — select species before logging measurement
- Gallery upload option in addition to camera capture
- 72 DPI photo downscaling before upload
- Catch persistence — catches saved to `localStorage` (`rfc_catches_v1`)
- Catch metadata fallback and location privacy choice (private vs. club-visible)

---

## [Phase 1] — Foundation
_Commits: `524b219` → `7b4ce5a`_

### Added
- Initial React + Vite project setup
- Basic fishing app with Home, Spots, and Catch tabs
- Firebase project scaffolding (`rfc-management`)
- Allowed club email invite/share roster flow
- First catch flow — photo upload, manual length entry, save
- `src/lib/firebase.js` — Firebase init
- `src/data/scoutSpots.js` — initial known spots
- GitHub repository, `.gitignore`, `package.json`
- Deployed to GitHub Pages via `npm run deploy`

---

## Deployment URLs
- **GitHub Pages**: https://ew3adam.github.io/fishing-app/
- **Cloudflare Pages**: https://fishing-app-4lg.pages.dev

_Last updated: 2026-10-16_
