# RFC Fishing App — CLAUDE.md

## Project Overview
A React fishing app for RFC (a fishing club). Members log catches, scout spots, view a club feed, and sync data across devices. Deployed to GitHub Pages.

## Startup Protocol
At the start of every session:
1. Run `git fetch` and check if local branch is behind remote — if so, pull automatically.
2. Report: current branch, uncommitted changes, and a one-line summary of where we left off.

## Tech Stack
- **Framework**: React 18 + Vite 5
- **Backend**: Firebase (Auth, Firestore, Storage) — project `rfc-management`
- **Maps**: Leaflet
- **EXIF parsing**: exifr (reads GPS coords from catch photos)
- **Deploy**: `npm run deploy` → gh-pages branch

## Key Files
| File | Purpose |
|------|---------|
| `src/App.jsx` | Main app (~260KB, single large component) — all tabs, state, and UI logic |
| `src/lib/firebase.js` | Firebase init (supports env-var overrides via `VITE_FIREBASE_*`) |
| `src/services/fishingSyncService.js` | Firestore sync for catches and fishing profiles |
| `src/services/authService.js` | Auth (email + OAuth), cloud profile pull/push |
| `src/services/memberService.js` | Active member roster from Firestore |
| `src/services/rosterImport.js` | CSV roster import + seed roster |
| `src/components/ClubFeedList.jsx` | Club-wide catch feed |
| `src/components/SpotMapPicker.jsx` | Leaflet map for picking/displaying spots |
| `src/utils/feedSpotPrivacy.js` | Strips private spot details before sharing to feed |
| `src/data/scoutSpots.js` | Static list of known scout spots |
| `src/config/authProviders.js` | OAuth provider config (do not commit real keys) |

## Firestore Data Model
```
members/{memberId}/fishingProfile/main   — level, favSpecies, favSpots, gear, privateSpots
members/{memberId}/fishingCatches/{id}   — individual catch records
```

## Development Commands
```bash
npm run dev      # local dev server
npm run build    # production build
npm run deploy   # build + push to gh-pages
```

## Important Constraints
- **No test suite** — manually test in browser before marking anything done.
- `App.jsx` is intentionally monolithic; don't split it unless the user asks.
- Firebase config has hardcoded fallback values (public web config); env vars override them.
- `authProviders.js` is gitignored — use `authProviders.example.js` as the template.
- Spot privacy must be respected: use `feedSpotPrivacy.js` utilities before pushing spots to the club feed.

## App Tabs (as of last known state)
1. **Log** — log a new catch (photo upload, EXIF GPS, species, size, weight, gear)
2. **Feed** — toggle between Home Forecast and Club Feed
3. **Scout** — browse/search known spots with map
4. **Profile** — member profile, gear list, favourite spots
5. **Settings** — theme, auth, roster management

## Coding Style
- Vanilla JS style inside JSX (no TypeScript).
- Inline styles via theme objects (`THEMES.dark`, etc.) — no CSS modules.
- `var` used throughout the codebase; match existing style.
