# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A React fishing app for RFC (a fishing club). Members log catches, scout spots, view a club feed, and sync data across devices. Client-side-only PWA (no custom backend) deployed to GitHub Pages, backed by a Firebase project shared with the separate RFC CRM.

## Startup Protocol
At the start of every session:
1. Run `git fetch` and check if local branch is behind remote — if so, pull automatically.
2. Report: current branch, uncommitted changes, and a one-line summary of where we left off (see `docs/dev-session-log.md`).

When the user says **"save state"** (any casing): update `docs/dev-session-log.md` (`lastSessionAt`, **Where we left off** + **Next**), run `npm run scan:pii`, then `git add` / `git commit` / `git push origin main`. Never commit `.env.local`, service-account JSON, real member CSVs, or PII in docs.

## Tech Stack
- **Framework**: React 18 + Vite 5, no TypeScript
- **Backend**: Firebase (Auth, Firestore, Storage) — project `rfc-management`, shared with the RFC CRM app
- **Maps**: Leaflet
- **EXIF parsing**: exifr (reads GPS coords from catch photos)
- **Weather**: Open-Meteo, called directly from the browser (no key)
- **Deploy**: `npm run deploy` → gh-pages branch
- **No test framework and no linter are configured.** Manually verify in the browser (`npm run dev`) before marking work done.

## Development Commands
```bash
npm install       # also installs the pre-commit PII-scan git hook (npm "prepare" script)
npm run dev        # local dev server — http://localhost:5173/fishing-app/ (note the base path)
npm run dev -- --host 0.0.0.0   # bind to all interfaces (useful in cloud/VM sandboxes)
npm run build      # production build (vite build)
npm run preview    # preview a production build locally
npm run scan:pii          # full-repo PII/secrets audit
npm run scan:pii:staged   # staged-files-only scan (what the pre-commit hook runs)
npm run deploy      # scan:pii on src/public/data → build → gh-pages -d dist
```
There is no single-test command — there are no automated tests in this repo.

### Vite base path
`vite.config.js` sets `base: '/fishing-app/'` normally, but `'/'` when `CF_PAGES` is set (Cloudflare Pages preview builds). Local dev and GitHub Pages URLs must include the `/fishing-app/` prefix.

## High-Level Architecture

### Entry point and the two "App" files
`src/main.jsx` renders `src/App.jsx` — that is the entire live application (routing, all tabs, all state). **`src/FishingApp.jsx` (~2.4k lines) is dead code**: it is never imported anywhere and hasn't been touched since the initial commit. Don't extend it and don't assume it reflects current behavior; treat `src/App.jsx` as the single source of truth. If asked to clean up dead code, this file is a candidate for removal, but confirm with the user first since it's a large deletion.

### `src/App.jsx` is a deliberate ~4.3k-line monolith
Nearly all UI, state, and business logic lives in one file: THEMES/constants, standalone helpers (distance math, bite-forecast scoring, EXIF spot resolution, moon/solunar calc, etc.), a handful of shared UI primitives (`Card`, `Pill`, `OBtn`, `BFRDial`), and one function per tab. Rough map (line numbers drift as the file grows — use `grep -n "^function "` to re-locate):

| Tab component | Nav tab |
|---|---|
| `HomeTab` | Home — Forecast ⇄ Club Feed toggle (`homeSection` state: `"forecast"` \| `"feed"`) |
| `SpeciesTab` | Species |
| `SpotsTab` | Spots — private + club-shared spots |
| `LakesTab` / `CatalogueTab` | supporting screens under Spots/Tackle |
| `CatchTab` | Catch — log a new catch only (no feed here; links out to Home's Club Feed) |
| `LearnTab` | Learn |
| `ProfileTab` | Profile (opened via header avatar, not a bottom nav tab) — also owns all auth UI |
| `ScoutTab` | Scout — browse `SCOUT_SPOTS` (`src/data/scoutSpots.js`) |

`App.jsx` is intentionally monolithic — **don't split it into files unless the user explicitly asks**. When touching it, prefer the smallest diff that accomplishes the task; this file has a documented history of large speculative rewrites being reverted (see `docs/CLAUDE-CODE-HANDOFF.md`).

### Services layer (`src/services/`) — Firestore access
All Firebase reads/writes go through these modules rather than being inlined in components:
- `firebase.js` (in `src/lib/`) — app/auth/db/storage init; hardcoded public web-config fallbacks, overridable via `VITE_FIREBASE_*` env vars.
- `authService.js` — roster-gated sign-in. Primary flow is passwordless email link (`sendSignInLink`/`completeSignInWithLink*`); email+password is a fallback for members who set one up previously. Only emails present in the `members` roster are allowed to stay signed in.
- `memberService.js` — active member roster lookups; member doc ID is `firstname_lastname` (e.g. `adam_bielawski`).
- `fishingSyncService.js` — reads/writes `fishingProfile` and `fishingCatches`; also the club feed query (catches with `visibility` in `club`/`public_feed`).
- `catchPhotoStorage.js` — compresses and uploads catch photos to Firebase Storage (kept out of Firestore docs to avoid document-size limits; some older catches still have base64 photos inline — see `resolveCatchPhotoUrl`).
- `rosterImport.js` / `rosterHealthService.js` — CSV roster import, seed roster fallback, and a connectivity/health probe for the roster + auth setup.

### Firestore data model
```
members/{memberId}                        — CRM roster row (shared with CRM app)
members/{memberId}/fishingProfile/main    — level, favSpecies, favSpots, gear, privateSpots
members/{memberId}/fishingCatches/{id}    — individual catch records (visibility: private|club|public_feed)
```
`firebase/firestore.rules` is the source of truth for access control. Notably: the fishing app may only ever update **`authUid`** and **`lastFishingAppLoginAt`** on a `members/{memberId}` doc — every other roster field is CRM-owned and read-only from this app. A signed-in member can write their own `fishingProfile`/`fishingCatches`; club-visible catches are readable by any signed-in member, and `likeCount` is the only field other members may update on someone else's club catch.

### Spot privacy
Club feed posts must never leak street addresses or raw GPS. `src/utils/feedSpotPrivacy.js` provides `looksLikePrivateAddress`, `buildSpotDisplayName`, `sanitizeSpotForForm`, and `formatFeedSpotName` — always run spot text through these before it reaches `ClubFeedList.jsx` or any shared/club-visibility write. This exists because an earlier revision leaked home addresses to the club feed and was reverted (see `docs/CLAUDE-CODE-HANDOFF.md`, "Reverted work").

### PII scanning
`scripts/scan-pii.js` blocks staged commits (via a git hook auto-installed by `npm install`'s `prepare` script) and full-repo/deploy scans from containing real emails, phones, or credential-shaped files (e.g. `service-account.json`, `.env.local`). `scripts/pii-allowlist.txt` holds known-safe strings (placeholders, public club contact). `npm run deploy` always runs the full scan over `src`, `public`, `data` before building.

## Key Files
| File | Purpose |
|------|---------|
| `docs/RFC-PLATFORM-PRD.md` | Platform PRD — CRM + Fishing App on shared Firebase (`rfc-management`) |
| `docs/RFC-MASTER-PLAN.md` | Product/engineering master plan and phased rollout decisions |
| `docs/CLAUDE-CODE-HANDOFF.md` | Latest architecture/state pass-down, including reverted work not to reintroduce |
| `docs/dev-session-log.md` | Short **where we left off** / **next** — say **save state** to update |
| `docs/refactoring-policy.md` | Leave-it-cleaner-than-you-found-it policy; checklist mirrored in the PR template |
| `src/App.jsx` | Main app (~276KB, single large component) — all tabs, state, and UI logic |
| `src/FishingApp.jsx` | **Dead code**, not imported — do not treat as current |
| `src/lib/firebase.js` | Firebase init (supports env-var overrides via `VITE_FIREBASE_*`) |
| `src/services/fishingSyncService.js` | Firestore sync for catches and fishing profiles |
| `src/services/authService.js` | Auth (email link + password fallback, OAuth), cloud profile pull/push |
| `src/services/memberService.js` | Active member roster from Firestore |
| `src/services/rosterImport.js` | CSV roster import + seed roster |
| `src/components/ClubFeedList.jsx` | Club-wide catch feed |
| `src/components/SpotMapPicker.jsx` / `SpotMapThumb.jsx` | Leaflet map for picking / read-only display of spots |
| `src/utils/feedSpotPrivacy.js` | Strips private spot details before sharing to feed |
| `src/data/scoutSpots.js` | Static list of known scout spots |
| `src/config/authProviders.js` | OAuth provider config (gitignored, do not commit real keys — template: `authProviders.example.js`) |
| `firebase/firestore.rules`, `firebase/storage.rules` | Security rules — source of truth for what each role can read/write |

## Important Constraints
- **No test suite and no linter** — manually test in browser before marking anything done.
- **PII scan** — `npm run scan:pii` audits the repo; pre-commit hook blocks staged emails/phones/passwords. Deploy runs the scan on `src`, `public`, `data` first.
- `App.jsx` is intentionally monolithic; don't split it unless the user asks. Prefer minimal diffs — large speculative rewrites in this file have been built, shipped, and then reverted before.
- `src/FishingApp.jsx` is unused dead code; don't build on it.
- Firebase config has hardcoded fallback values (public web config); env vars override them.
- `authProviders.js` is gitignored — use `authProviders.example.js` as the template.
- Spot privacy must be respected: use `feedSpotPrivacy.js` utilities before pushing spots to the club feed.
- `members/{memberId}` roster docs are CRM-owned; this app may only write `authUid` and `lastFishingAppLoginAt` on them (enforced by Firestore rules, not just convention).

## App Tabs (as of last known state)
1. **Home** — Forecast ⇄ Club Feed toggle; also shows a pinned spot's forecast when the member has pinned one
2. **Species** — species reference info
3. **Spots** — private + club-shared spots, map picker, sharing/privacy controls
4. **Catch** — log a new catch (photo upload, EXIF GPS, species, size, weight, gear) — log only, no feed
5. **Scout** — browse/search known spots (`SCOUT_SPOTS`) with map
6. **Learn** — glossary/how-to content
7. **Profile** — member profile, auth (sign in/up), gear list, favourite spots, roster/admin tools — opened via header avatar, not a bottom nav tab

Do not reintroduce the 5-tab nav, "Scout Now" advisor, or offline service worker — that redesign was built and explicitly reverted (`docs/CLAUDE-CODE-HANDOFF.md`).

## Coding Style
- Vanilla JS style inside JSX (no TypeScript).
- Inline styles via theme objects (`THEMES.dark/light/bluesteel`) — no CSS modules. Note `ClubFeedList.jsx` keeps its own local copy of a subset of `THEMES` rather than importing from `App.jsx`.
- `var` used throughout the codebase; match existing style.
- Keep diffs minimal — no drive-by refactors unless asked; if you do touch a file for another reason, it's fine (and encouraged, per `docs/refactoring-policy.md`) to remove dead code/duplication you notice in the area you're already changing, but don't mix that with feature/bug-fix work in the same PR unless trivial.
