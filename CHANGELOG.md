# Changelog — RFC Fishing App

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — In Progress

### Added
- **Self-serve member signup** (`authService.signUpMemberEmail`): roster-gated account
  creation using `createUserWithEmailAndPassword`; rolls back the Auth account if the
  email is not in the active Firestore members collection.
- **Forgot password flow** (`authService.sendMemberPasswordReset`): sends Firebase
  password-reset email; confirmation message shown inline in the sign-in card.
- **ProfileTab auth modes**: sign-in card now toggles between `signin`, `signup`, and
  a forgot-password confirmation state; "New member? Set up your account" and
  "Already have an account? Sign in" links switch between modes.

### Next
- Enable Email/Password in Firebase Console (rfc-management → Auth → Sign-in method)
- Admin panel: list members + `authUid` link status (who has set up an account)

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

_Last updated: 2026-07-08_
