# RFC Fishing App — Bug Triage & Feature Roadmap

Source: full-codebase review (`src/App.jsx`, all `src/services/*`, `firebase/*.rules`, map/feed components) done outside any single feature PR. See `docs/RFC-MASTER-PLAN.md` for the original build plan and `docs/dev-session-log.md` for recent shipped work this builds on.

**Sequencing rule, same one this project already uses (`RFC-MASTER-PLAN.md`: "Vertical Westcott ruler bug: P0 fix before new features"):** ship Phase 0 (bug fixes) before starting Phase 2+ feature work. Phase 1 is cheap enough to run alongside Phase 0.

---

## Part 1 — Bug triage

**Status as of this update: all seven original bugs (BUG-1 through BUG-7) have fixes up for review (PR #28, PR #29, PR #31, PR #32, PR #33); a follow-up audit after that work found three more (BUG-8, BUG-9, BUG-10), also up for review (PR #35, PR #36).** #26 is this document itself, #27 is the `bug-fixes` review subagent/hook — neither touches bug code directly. (Separately, three *other*, directly-reported bugs not part of this triage — Scout's empty-search no-op, the map pinch-zoom snap-back, and the Scout results-map re-centering issue — have their own fixes in PR #23 (merged), #24 (open), and #25 (merged); those aren't BUG-1..10 and aren't tracked in this table.)

| ID | Severity | Title | Where | Status |
|----|----------|-------|-------|--------|
| [BUG-1](#bug-1-p0--catch-photos-can-exceed-localstorage-quota-and-break-catch-logging) | **P0** | Catch photos can exceed `localStorage` quota and break catch logging | `CatchTab`, `App.jsx` | Fix up for review — [PR #28](https://github.com/ew3adam/fishing-app/pull/28) |
| [BUG-2](#bug-2-p1--corrupt-local-catch-data-can-silently-break-post-sign-in-sync) | **P1** | Corrupt local catch data can silently break post-sign-in sync | `App.jsx:4624` | Fix up for review — [PR #28](https://github.com/ew3adam/fishing-app/pull/28) |
| [BUG-3](#bug-3-p1--club-feed-and-club-spot-map-do-n-sequential-firestore-reads) | **P1** | Club feed and club-spot map do N sequential Firestore reads | `fishingSyncService.js` | Fix up for review — [PR #29](https://github.com/ew3adam/fishing-app/pull/29) |
| [BUG-4](#bug-4-p1--sign-in-can-fail-for-roster-emails-not-stored-lowercase) | **P1** | Sign-in can fail for roster emails not stored lowercase | `memberService.js` | Fix up for review — [PR #29](https://github.com/ew3adam/fishing-app/pull/29) |
| [BUG-5](#bug-5-p1--csv-roster-import-breaks-on-quoted-fields-containing-commas) | **P1** | CSV roster import breaks on quoted fields containing commas | `rosterImport.js` | Fix up for review — [PR #31](https://github.com/ew3adam/fishing-app/pull/31) |
| [BUG-6](#bug-6-p2--passwordless-sign-in-link-domain-depends-on-window-location-at-send-time) | **P2** | Passwordless sign-in link domain depends on `window.location` at send-time | `authService.js` | Fix up for review — [PR #32](https://github.com/ew3adam/fishing-app/pull/32) |
| [BUG-7](#bug-7-p2--accessibility-gaps-tiny-text-missing-alt-text) | **P2** | Accessibility gaps: tiny text, missing alt text | `App.jsx` (widespread) | Fix up for review — [PR #33](https://github.com/ew3adam/fishing-app/pull/33) (FEATURE-2 built to close it) |
| [BUG-8](#bug-8-p1--buildspotdisplaynames-private-address-fallback-fabricates-a-real-spot-name) | **P1** | `buildSpotDisplayName`'s private-address fallback fabricates a real spot name | `feedSpotPrivacy.js` | Fix up for review — [PR #35](https://github.com/ew3adam/fishing-app/pull/35) |
| [BUG-9](#bug-9-p1--spotstabs-club-shared-map-view-renders-an-unsanitized-spot-name) | **P1** | SpotsTab's "Club shared map" view renders an unsanitized spot name | `App.jsx` (`SpotsTab`) | Fix up for review — [PR #35](https://github.com/ew3adam/fishing-app/pull/35) |
| [BUG-10](#bug-10-p2--club-feed-like-button-can-double-count-on-a-rapid-double-tap) | **P2** | Club feed like button can double-count on a rapid double-tap | `ClubFeedList.jsx` | Fix up for review — [PR #36](https://github.com/ew3adam/fishing-app/pull/36) |

### BUG-1 (P0) — Catch photos can exceed `localStorage` quota and break catch logging
**Status:** Fix up for review — [PR #28](https://github.com/ew3adam/fishing-app/pull/28). Verified live via Playwright: a ~5.81MB synthetic photo compressed to 333.7KB (17.8x smaller) before hitting `localStorage`.
**Impact:** the core catch-logging feature can break itself from normal use, with no error message a member would understand.
**Root cause:** `readImageFile` (`App.jsx` ~2915) stores the **full, uncompressed** photo as base64 directly into the `catches` array. That array is written to `localStorage` on every change (`App.jsx:2914`) with **no try/catch**. A modern phone photo (4–8MB) plus base64 overhead (~33%) can single-handedly approach the ~5–10MB `localStorage` quota most browsers enforce per origin. Two or three catches logged while signed out (nothing offloads to Firebase Storage) can throw `QuotaExceededError` inside a `useEffect`.
**Compounding factor:** even after a photo successfully uploads to Firebase Storage, the local copy still keeps the raw base64 (`App.jsx:3110-3118` only *adds* `photoUrl`, never drops `photo`) — bloat accumulates for signed-in members too, just slower.
**Fix direction:**
1. Run photos through the existing `compressDataUrl` (already written for cloud uploads in `catchPhotoStorage.js`) before ever storing them locally — reuse, don't duplicate.
2. Wrap the `rfc_catches_v1` write in try/catch (matching the pattern already used for the profile write at `App.jsx:567`), and surface a toast on failure instead of failing silently.
3. Once `photoUrl` exists for an entry, drop `photo` from the locally-persisted copy.
**Effort:** S–M.

### BUG-2 (P1) — Corrupt local catch data can silently break post-sign-in sync
**Status:** Fix up for review — [PR #28](https://github.com/ew3adam/fishing-app/pull/28), shipped alongside BUG-1 as planned.
**Impact:** if BUG-1 ever produces a partial/corrupt write, sign-in sync breaks with zero visible error.
**Root cause:** `App.jsx:4624` — `JSON.parse(localStorage.getItem("rfc_catches_v1") || "[]")` runs unguarded inside the post-sign-in effect. A synchronous throw here also skips `loadCatchesFromCloud` on the next line, since both are in the same effect body.
**Fix direction:** wrap in try/catch, default to `[]` on parse failure (same pattern already used elsewhere, e.g. `loadScoutHistory`).
**Effort:** XS. Ship alongside BUG-1.

### BUG-3 (P1) — Club feed and club-spot map do N sequential Firestore reads
**Status:** Fix up for review — [PR #29](https://github.com/ew3adam/fishing-app/pull/29). Verified via a standalone logic simulation (real timing, no live Firestore available in this sandbox): 8 simulated member reads went from 404ms sequential to 52ms parallel.
**Impact:** feed/map load time scales linearly with roster size; burns Firestore read quota; already noticeably slow at current roster size, will get worse as the club grows.
**Root cause:** `loadClubFeedCatches` and `loadClubSharedSpots` (`fishingSyncService.js`) loop over every active member with `for` + `await` instead of `Promise.all` — fully sequential.
**Fix direction:** parallelize with `Promise.all` (low-risk, same result shape). Longer-term (not this ticket): a Firestore `collectionGroup` query would remove the N-reads pattern entirely, but that's a rules/index redesign, not a quick fix.
**Effort:** S.

### BUG-4 (P1) — Sign-in can fail for roster emails not stored lowercase
**Status:** Fix up for review — [PR #29](https://github.com/ew3adam/fishing-app/pull/29). Shipped without the cross-repo backfill originally planned below — see that PR for why a client-side case-insensitive fallback (reusing `mapMemberDoc`'s existing `normalizeEmail`) fixes this in-repo, no CRM change required. The backfill/enforce-lowercase-on-write idea is still worth doing in `rfc-firebase` for defense in depth.
**Impact:** a member whose CRM-imported email has any uppercase character may be unable to sign in, with a confusing "not on the club list" error despite being a real active member.
**Root cause:** `findMemberByEmail` (`memberService.js`) queries with a lowercased version of what the member *typed*; Firestore's `==` is case-sensitive, so if the stored `email` field isn't lowercase, the primary query misses and the fallback only helps if the member happens to type the exact original casing.
**Fix direction:** normalize `email` to lowercase at the source — either a one-time backfill script against the `members` collection, or enforce lowercase on every CRM write path (that's in the sibling `rfc-firebase` repo, not this one — cross-repo ticket).
**Effort:** S in this repo (remove the fragile fallback once data is clean) + a backfill step in `rfc-firebase`.

### BUG-5 (P1) — CSV roster import breaks on quoted fields containing commas
**Status:** Fix up for review — [PR #31](https://github.com/ew3adam/fishing-app/pull/31). Took the small-dependency-free-parser branch of the fix direction below, plus the row/column-count sanity check. Verified live by importing the real shipped module through the Vite dev server and exercising it directly (quoted commas, escaped quotes, CRLF, a malformed row now throwing instead of silently shifting).
**Impact:** any roster CSV export (e.g., from Excel/Sheets) with a quoted field containing a comma — a notes column, "Smith, Jr." — silently shifts every subsequent column with no error surfaced.
**Root cause:** `parseRosterCsv` (`rosterImport.js`) splits on a bare `,` and only strips leading/trailing quote characters; no proper CSV quoting/escaping support.
**Fix direction:** swap in a small, dependency-free RFC 4180-aware parser (a few dozen lines), or take a minimal CSV parsing library if one's acceptable for this "no backend, keep it light" app. Add a row-count/column-count sanity check that surfaces an error instead of silently importing shifted data.
**Effort:** S.

### BUG-6 (P2) — Passwordless sign-in link domain depends on `window.location` at send-time
**Status:** Fix up for review — [PR #32](https://github.com/ew3adam/fishing-app/pull/32). Canonical URL decision: GitHub Pages (`https://ew3adam.github.io/fishing-app/`), per the user. Verified live against both `vite dev` and a real `vite preview` production build, capturing the actual Firebase `sendOobCode` request.
**Impact:** already diagnosed this cycle as the mechanism behind the "invite email links to the wrong place" issue — the link a member gets depends on whatever URL happened to be open when *someone* triggered the send, not a fixed, correct production URL.
**Root cause:** `sendSignInLink` (`authService.js:32`) builds `url: window.location.origin + window.location.pathname` live.
**Fix direction:** hardcode (or env-configure) the canonical production URL for the continue-link instead of deriving it from the current page, reserving `window.location`-based behavior for local dev only.
**Effort:** S, but needs a decision on the canonical URL (plain `ew3adam.github.io` vs. a custom domain, if one's ever added) before fixing.

### BUG-7 (P2) — Accessibility gaps: tiny text, missing `alt` text
**Status:** Fix up for review — [PR #33](https://github.com/ew3adam/fishing-app/pull/33). The missing-`alt`-text half was already fixed (all 9 `<img>` tags in `App.jsx` now have `alt`) — the PR closes the tiny-text half by building FEATURE-2 (a Small/Medium/Large text-size setting), per the fix direction below, rather than patching font sizes piecemeal.
**Impact:** real readability barrier for older members specifically — 155 of 480 `fontSize` declarations in `App.jsx` are 9–11px, often paired with the low-contrast `muted` theme color; 3 of 9 `<img>` tags have no `alt` text.
**Fix direction:** folded into Feature-1 below (text-size setting) rather than a standalone patch — fixing font sizes piecemeal without a real setting just moves the problem around.
**Effort:** rolled into FEATURE-2.

---

## Follow-up audit (found after BUG-1 through BUG-7 shipped)

A second pass over files/areas not closely covered by the original review, plus a fresh look at
this session's own new code, found three more bugs — BUG-8, BUG-9, BUG-10. Same severity scale
as Part 1 above.

### BUG-8 (P1) — `buildSpotDisplayName`'s private-address fallback fabricates a real spot name
**Status:** Fix up for review — [PR #35](https://github.com/ew3adam/fishing-app/pull/35).
**Impact:** a member whose entered spot text looked like a private address or raw GPS coordinates had their club-visible catch silently misattributed to a real, specific, unrelated spot — not a safe generic label, an actively wrong one — with no indication to them that their entered text got swapped for something else.
**Root cause:** `buildSpotDisplayName(spot, knownWaterNames)` (`feedSpotPrivacy.js`) returned `knownWaterNames[0]` when `looksLikePrivateAddress` matched, instead of the generic `"RFC water"` label its own other branches and the sibling `formatFeedSpotName` both use. The one call site (`App.jsx`'s `submitCatch`) always passed the same fixed-order list, so this was always the same value in practice: `KNOWN_SPOTS[0].name`, i.e. `"Salt Creek"`.
**Fix direction:** always fall back to `"RFC water"`, matching the rest of the function and `formatFeedSpotName`.
**Effort:** XS.

### BUG-9 (P1) — SpotsTab's "Club shared map" view renders an unsanitized spot name
**Status:** Fix up for review — [PR #35](https://github.com/ew3adam/fishing-app/pull/35).
**Impact:** a member's freely-typed spot name — which could be a real street address if they weren't careful when saving it privately — reached every other club member unsanitized once shared, contradicting the privacy invariant `CLAUDE.md` documents for this exact scenario.
**Root cause:** the "Club shared map" view in `SpotsTab` (`App.jsx`) rendered `s.name` directly. The other two places a club-shared spot name is displayed — `ScoutTab`'s `nearClubSpots` and the club catch feed (`ClubFeedList.jsx`) — both already correctly route through `formatFeedSpotName` first; this one didn't.
**Fix direction:** route through `formatFeedSpotName(s.name, s.name)`, same as the other two display points.
**Effort:** XS.

### BUG-10 (P2) — Club feed like button can double-count on a rapid double-tap
**Status:** Fix up for review — [PR #36](https://github.com/ew3adam/fishing-app/pull/36).
**Impact:** a rapid double-tap on "Nice fish" silently double-counts a `likeCount` that's visible to the entire club, with no way for it to self-correct afterward.
**Root cause:** `ClubFeedList.jsx`'s `toggleLike` reads `wasLiked` from the `likes` state closure with no synchronous re-entry guard. Two click events fired back to back both run before React flushes the first call's state update, so both read the same stale `wasLiked` and each send their own `+1`/`-1` to Firestore via `updateCatchLike`'s `increment()`. Same root-cause pattern as the double-submit bug already fixed in `CatchTab.submitCatch` (BUG-1, PR #28) — a `useState` guard alone isn't sufficient here either, for the same reason.
**Fix direction:** a `useRef` guard, keyed per-post so liking two different posts in quick succession still both go through.
**Effort:** XS.

---

## Part 2 — Feature PRDs

Each entry: problem, goal, in/out of scope, rough approach, effort. Ordered by rough priority, not numbering scheme.

### FEATURE-1 — Progressive disclosure app-wide (generalize the existing beginner/advanced pattern)
**Problem:** `CatchTab` already hides measurement methods 2–6 behind a "Show more" toggle for `profile.level === "Beginner"` (`App.jsx` ~3353) — a good pattern that exists in exactly one place. Everywhere else, a first-time member sees the same density of options as a 10-year veteran.
**Goal:** fewer choices shown by default to members who've marked themselves Beginner; same power available one tap away.
**In scope:** audit each tab for option-heavy UI (Scout's radius/direction controls, Spots' sharing options, Tackle's advanced filters) and apply the same show/hide pattern already proven in `CatchTab`.
**Out of scope:** a full onboarding wizard/tutorial (separate, larger idea if wanted later).
**Approach:** extract the existing inline pattern into a small shared helper (`showAdvanced` state + toggle button, reusable across tabs) rather than copy-pasting it — this is also a good moment to reduce duplication per this repo's own refactoring policy.
**Effort:** M.

### FEATURE-2 — Real text-size setting
**Status:** Fix up for review — [PR #33](https://github.com/ew3adam/fishing-app/pull/33). Shipped via a CSS `zoom` on the app's single root wrapper rather than the `--rfc-scale`/`rem` approach sketched below — the spike this ticket called for concluded that rewriting App.jsx's ~480 individual `fontSize` declarations to a relative unit was too large/high-conflict a refactor for this pass; `zoom` gets the same real-scaling result (not reliant on OS/browser zoom, since `index.html` disables that) without touching them. Also note: `theme` turned out not to actually be persisted anywhere in the current code (the "persisted the same way `theme` already is" line below was aspirational, not accurate) — text scale is instead persisted the same way `HOME_TARGET_SPECIES_KEY` already is, a plain standalone `localStorage` key, kept local-only/per-device rather than synced via `profile`.
**Problem:** small text (BUG-7) compounds with `user-scalable=no` in `index.html`, which blocks the usual pinch-zoom workaround.
**Goal:** a Profile setting (Small/Medium/Large, or a slider) that scales the app's text, not reliant on OS/browser zoom.
**In scope:** a root font-size CSS variable multiplied through the existing `THEMES`-based inline-style system; persisted the same way `theme` already is.
**Out of scope:** a full design-system rewrite — this is a scaling multiplier over what exists today, not new visual design.
**Approach:** since styles are inline objects computed per-render (not CSS classes), the cleanest lever is a CSS custom property on the root (`--rfc-scale`) combined with `rem`-based sizing at the few dozen highest-traffic text spots, or a simple `em`-relative wrapper — needs a short spike to confirm which approach fits this codebase's inline-style pattern without a large refactor.
**Effort:** M.

### FEATURE-3 — Offline-first caching for the essentials
**Problem:** no offline handling anywhere; Home's forecast, Scout's results, and the club feed all require a live connection, with no cached fallback — and fishing spots are exactly where cell signal is worst.
**Goal:** a member standing at the water with no signal sees their **last successfully loaded** forecast, Scout results, and private spots, clearly labeled as cached/stale, instead of blank or failed states.
**In scope:** cache-last-good-response for `loadWeather`, the Scout Overpass/water calls, and private spots (already in `localStorage`/profile, so this is mostly making sure it's *readable* offline, which it already partly is). A "last updated X ago" indicator wherever cached data is shown.
**Out of scope:** full offline write queueing (logging a catch with no signal and having it sync later) — worth a future ticket, but bigger scope (needs conflict resolution).
**Approach:** a service worker isn't required for the read-cache piece — a simple "store last successful response + timestamp in `localStorage`, fall back to it on fetch failure" pattern covers most of the value at a fraction of the complexity. A real service worker (already implied by the PWA manifest existing but unused) is a larger follow-up if true offline *app shell* loading is wanted.
**Effort:** M for the read-cache version; L if bundled with a real service worker.

### FEATURE-4 — Fishing buddy check-in / share-my-trip
**Problem:** no safety feature for a member fishing alone beyond the NWS alert banner shipped this cycle (which warns about weather, not "nobody knows where I am").
**Goal:** before heading out, a member can send a link (text/email, no new account needed on the receiving end) showing their planned spot and an expected-return time to a family member or friend.
**In scope:** generate a one-time shareable view (reuse the existing spot-privacy-safe display name, never raw GPS to a non-member per existing `feedSpotPrivacy.js` rules) with spot + expected return time; a simple "I'm back" dismiss.
**Out of scope:** live location tracking (privacy-sensitive, bigger scope, and this app has already deliberately declined building location-surfacing features once this cycle — stay consistent with that).
**Approach:** a new, narrowly-scoped Firestore doc per check-in (short-lived, no PII beyond what the member explicitly chose to share) with a public read-only view route; needs a new Firestore rule scoped tightly to that one document shape.
**Effort:** M–L (new data model + new rule + new UI surface).

### FEATURE-5 — Personal catch history & personal bests
**Problem:** catches are logged but there's no reflection of progress — no personal-best tracking, no simple "X species caught this year" summary.
**Goal:** a per-member view (Profile or a new section) showing personal bests by species and a simple yearly species count.
**In scope:** derive from data already being logged — no new inputs required. Personal-best = largest logged length/weight per species from the member's own `fishingCatches`.
**Out of scope:** club-wide leaderboards (different privacy posture — needs explicit opt-in design, not bundled here).
**Approach:** pure client-side aggregation over the member's own catches (already fetched via `loadCatchesFromCloud`); no new backend work.
**Effort:** S–M.

### FEATURE-6 — State fishing license & regulation lookup
**Problem:** the single most common blocker for a total beginner is not knowing what license they need or where to get one — currently only handled ad hoc via `SPECIES.alert` strings on individual species entries.
**Goal:** a simple, curated reference (by state — IL/IN/WI given this club's footprint) linking to official license purchase and regulation pages.
**In scope:** static curated data (same pattern as `SCOUT_SPOTS`/`SPECIES` — hand-maintained, not scraped/live), surfaced in Learn and/or Species tabs.
**Out of scope:** live regulation-change tracking or a legal-advice framing — link out to official state sources, don't restate rules as fact (same caution already applied to `SCOUT_SPOTS`' "unverified" framing).
**Effort:** S (mostly content, not code).

### FEATURE-7 — Voice or minimal-typing catch logging
**Problem:** typing a full catch-log form is friction, especially for older users or anyone with wet hands/gloves at the water.
**Goal:** let a member speak "12 inch largemouth, spinnerbait" and have it parsed into the form instead of typing/selecting through every field.
**In scope:** browser-native Web Speech API for capture; reuse the existing AI-parsing pattern already in `CatchTab`'s photo-analysis flow for structuring the transcribed text into form fields.
**Out of scope:** shipping this against the current keyless, no-backend Anthropic call pattern — that pattern is already documented as broken in production (`CLAUDE.md`'s AI-features gotcha). This feature should wait for or be bundled with the backend migration already noted as future scope in `docs/dev-session-log.md`, so it can use a real, keyed API call instead of extending a call path that doesn't work for real users today.
**Effort:** M, but **blocked** on having a working backend for the API call — sequence after that migration, not before.

---

## Part 3 — Phased roadmap

```
Phase 0 — Bug fixes (do first, per this project's own "fix bugs before features" precedent)
  BUG-1, BUG-2   (same PR — shared fix)
  BUG-3
  BUG-4          (this-repo half; cross-repo backfill tracked separately in rfc-firebase)
  BUG-5
  BUG-6
  ↳ ship as 3-4 small PRs, same pattern as this session's other fixes

Phase 1 — Cheap, high-impact, no new infrastructure
  FEATURE-2  Text-size setting (closes BUG-7 too)
  FEATURE-1  Progressive disclosure app-wide
  FEATURE-6  State license/regulation lookup (content-only)

Phase 2 — Medium effort, still no new infrastructure
  FEATURE-5  Personal catch history & personal bests

Phase 3 — New infrastructure, bigger lift
  FEATURE-3  Offline-first caching (read-cache version first; full service worker later)
  FEATURE-4  Fishing buddy check-in (new Firestore doc shape + rule)

Phase 4 — Explicitly blocked on other future-scope work already on record
  FEATURE-7  Voice/minimal-typing logging — wait for the backend migration
             already noted in docs/dev-session-log.md's "Future scope" section
```

**Note on existing future-scope items** (`docs/dev-session-log.md`): the visual/UX modernization pass, the Firebase-to-no-cost-backend migration, and in-app outbound email are already on record as "after current functionality is solid, don't start without explicitly picking back up." This roadmap doesn't start any of those — Phase 3/4 above are scoped to work within the current Firebase setup; only FEATURE-7 explicitly depends on the backend migration happening first, and is sequenced last for exactly that reason.
