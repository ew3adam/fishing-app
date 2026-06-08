# RFC Fishing App — Pass-Down for Claude Code Review

**Date:** 2026-06-07  
**Repo:** https://github.com/ew3adam/fishing-app.git  
**Branch:** `main`  
**Live base path:** `/fishing-app/` (GitHub Pages)

---

## Where we left off

Adam approved the **current 7-tab interface** (Home, Species, Spots, Tackle, Catch, Scout, Learn + Profile via header). A large **Jobs 95% redesign** (5-tab nav, Scout Now advisor, offline SW) was **built, pushed, then reverted** — do not reintroduce without explicit approval.

Latest approved work: **Home tab = Forecast + Club Feed toggle**, Catch tab = **log only**, Instagram-style club feed on Home, spot privacy on feed posts.

---

## What shipped in this session

| Feature | Location | Notes |
|---------|----------|-------|
| Forecast \| Club Feed toggle | `HomeTab` in [`src/App.jsx`](../src/App.jsx) | Default **Forecast**; tap Home nav resets to Forecast |
| Club feed UI | [`src/components/ClubFeedList.jsx`](../src/components/ClubFeedList.jsx) | Full-width photos, member name, Nice fish like, loads Firestore via `loadClubFeedCatches` |
| Catch tab simplified | `CatchTab` in [`src/App.jsx`](../src/App.jsx) | Removed Community Feed; link **View club feed →** opens Home feed |
| Spot privacy | [`src/utils/feedSpotPrivacy.js`](../src/utils/feedSpotPrivacy.js) | Blocks street addresses / raw GPS on feed; `spotDisplayName` on club saves |
| Build fix | [`src/index.css`](../src/index.css), [`index.html`](../index.html) | Moved inline CSS out of HTML (Vite build on OneDrive) |

---

## Architecture (quick)

- **React 18 + Vite 5** PWA, logic mostly in [`src/App.jsx`](../src/App.jsx) (~3.9k lines)
- **Firebase** project `rfc-management` — auth, roster gate, catches in `members/{id}/fishingCatches`
- **No backend** for core app; Open-Meteo weather + optional Anthropic from browser
- **Master plan:** [`docs/RFC-MASTER-PLAN.md`](RFC-MASTER-PLAN.md)
- **Audit checklist:** [`docs/RFC-AUDIT.md`](RFC-AUDIT.md)

### Nav (unchanged — keep this)

```
Home | Species | Spots | Tackle | Catch | Scout | Learn
Profile = header avatar → tab "me"
```

### Home tab state

- App holds `homeSection`: `"forecast"` | `"feed"`
- `openClubFeed()` sets section to feed and switches to Home tab

### Club feed data

- Query: [`loadClubFeedCaches`](../src/services/fishingSyncService.js) → catches with `visibility` in `club`, `public_feed`
- Save: `saveCatchToCloud` on submit when user picks Share with club
- Display spot: `formatFeedSpotName(c.spot, c.spotDisplayName)` — never raw EXIF street text

---

## Reverted work (do NOT restore silently)

Commit `d964de0` added then `649a970` reverted:

- 5-tab nav (Scout / Club / Log / Learn / Profile)
- Scout Now rules engine, USGS, offline service worker
- Verified catch Cloud Functions
- Multi-photo ruler measurement utils

Adam said the reverted UI was **terrible**, **not accurate**, and showed **addresses of people's homes**. Any future social/Scout work must keep **7-tab layout** and **spot privacy**.

---

## Known issues / review focus for Claude Code

1. **Spot pre-fill** — `resolveSpotFromExif` still exists; `sanitizeSpotForForm` filters on log pre-fill but reviewers should verify no home addresses reach club feed.
2. **Feed photos** — Stored as base64 in Firestore catch docs today; may hit size limits at scale → future Firebase Storage migration per master plan.
3. **Demo catches** — `CatchTab` still seeds local demo entries (Mike R., Sandra L.) in `localStorage`; club feed only shows cloud `visibility: club` posts.
4. **Nice fish likes** — Local only (`rfc_feed_likes_v1`); not synced across devices yet.
5. **App.jsx size** — Single file is hard to maintain; extract tabs only when asked; minimal diff preferred.
6. **Build** — Run `npm run build` before deploy; inline `<style>` in `index.html` breaks Vite on this machine.

---

## Commands

```bash
npm install
npm run dev          # http://localhost:5173/fishing-app/
npm run build
npm run deploy       # GitHub Pages
```

---

## Suggested next steps (priority)

| P | Task | Doc ref |
|---|------|---------|
| P1 | Firebase Storage for catch photos (not base64 in Firestore) | RFC-MASTER-PLAN Phase 3 |
| P1 | Spot picker at log time — force water name from `SCOUT_SPOTS` / `KNOWN_SPOTS` for club share | This handoff |
| P2 | Sync feed likes + optional comments to Firestore | Master plan member feed |
| P2 | Pull-to-refresh on Club Feed | UX |
| P3 | Per-member public catch list from Profile roster | Master plan Phase 3b |
| **Avoid** | 5-tab nav, Scout Now card on Home, Jobs 95% bundle | User reverted |

---

## Files changed (this session)

```
fishing-app/index.html
fishing-app/src/main.jsx
fishing-app/src/index.css
fishing-app/src/App.jsx
fishing-app/src/components/ClubFeedList.jsx
fishing-app/src/utils/feedSpotPrivacy.js
fishing-app/docs/CLAUDE-CODE-HANDOFF.md
```

---

## Review checklist for Claude Code

- [ ] Home opens to **Forecast**; Club Feed requires sign-in
- [ ] Catch tab has **no** duplicate feed
- [ ] Club share writes `spotDisplayName`; feed never shows street-like strings
- [ ] 7 bottom tabs unchanged
- [ ] `npm run build` passes
- [ ] No reintroduction of reverted Jobs 95% nav without sign-off

---

## Git history (recent)

```
649a970 Revert Jobs 95 percent
d964de0 Ship Jobs 95 percent (reverted)
6dc227e Scout tab, spot map, ruler, catch UX
6da095a Firebase auth + roster gate
```

Contact context: Adam Bielawski — roster admin; Firebase member `adam_bielawski`.
