# Session 2026-11-11: handoff (branch `session-2026-11-11`)

Work was done on the T7 copy of `main`, which was 14 commits behind GitHub at the time.
This branch is NOT merged. Before merging, merge `origin/main` into it and reconcile overlaps:

- Overlaps with newer GitHub work: Bite Forecast contrast fix (#25b767a), member invite
  (13123be, 22d8dc3), FishingApp.jsx removal (#57), buoy wrangler.toml (#58), Fishing Assistant
  Worker (#59). Fold the buoy and assistant Workers into the single RFC Helper rather than
  keeping three Workers.

## What this branch adds
- RFC Helper Worker (`cloudflare/rfc-helper/`): /health, /buoy, /species-id (members only,
  Firebase ID token verified). App reads `VITE_RFC_HELPER_URL` (`src/lib/rfcHelper.js`).
- AI species ID: up to 3 suggestions with field marks; auto-picks only at 70%+.
- Scout: rivers pinned at closest bank, launches/piers, one distance-sorted list, Overpass
  fallback + 24h cache. Sag Quarry East moved to the real lake (41.6926, -87.9312).
- Catch: image-only picker, Start over / change photo, ruler SVG fixed (bad control char),
  sliders under photo, My catches thumbnails + delete, open by default (profile switch).
- Club Feed: Facebook-style posts, Like + Comment (comments subcollection).
- Profile: toggles save instantly, sync-loop fix, login race fix, invite button restored.
- Themes moved to `src/theme.js`; WCAG AA contrast for light/beige; desktop phone frame;
  text-size zoom no longer hides the bottom nav on iPhone; scroll to top on page change.
- Rules: comments + owner photo delete (`firebase/*.rules`). NOT deployed yet.

## Open / next
1. Deploy Firebase rules (needed for cloud catch save, comments, deletes).
2. Deploy RFC Helper; add AI key as a secret.
3. Edit a catch + more photos; sync-status badge; species cards with member photos.
