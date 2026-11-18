# Future reference: weather feature stack, if this app ever goes native iOS

**Status: not current architecture. Nothing here applies today.** This app is a React web app
(client-side only, GitHub Pages / Cloudflare Pages, no native mobile build), and its weather
feature already works today on Open-Meteo (free, no key) — see `CLAUDE.md`'s Tech Stack section
and `docs/SCALING-WATCHLIST.md`. This doc exists only so the research isn't lost if the club ever
decides to build a native iOS app instead of (or alongside) the web app.

## Why this doc exists

Adam was pitched a generic two-option weather-feature tech stack (the kind of comparison you'd
give a PM deciding how to build a weather feature from scratch in a native mobile app). Almost
none of it applies to this app as it exists today — we already have a working weather feature, a
proven proxy-worker pattern, and no native mobile code at all. The one genuinely new idea worth
keeping — a native WeatherKit-based approach — only becomes relevant if the project pivots to a
real native iOS build. Saving it here rather than losing it.

## If we go native iOS: the relevant option

**Weather data**: Apple WeatherKit (native Swift/JWT integration, minute-by-minute precipitation,
included free up to 500k calls/month under an Apple Developer membership) rather than continuing
with Open-Meteo. Worth it specifically because of OS-native integration and severe-weather push
alerts, not because Open-Meteo is lacking for what this app does today.

**Location/geocoding**: Apple MapKit for native autocomplete + reverse geocoding, replacing the
browser Geolocation API + OSM Nominatim this app uses now.

**Backend proxy + caching**: unlike the current web app's lightweight Cloudflare Worker pattern
(`cloudflare/fishing-assistant-worker.js`, `cloudflare/buoy-proxy-worker.js`), a native app with
saved per-user locations and push alerts would want a real scheduled backend job (cron) that
pre-fetches weather for saved locations and triggers APNs for severe weather — this is the piece
that would need genuinely new infrastructure, not a reused pattern.

**Client state/UI**: native WeatherKit Swift framework bindings, local disk persistence
(UserDefaults/DataStore) for instant cold-start rendering, SF Symbols for native multicolor
weather icons instead of this app's inline-style/emoji-based UI.

**Trade-off vs. staying web-only**: 2–3 sprints of native-specific work (Apple JWT auth, native
SDKs) vs. the current app's near-zero marginal cost on Open-Meteo. Only worth it if "native iOS
app" becomes a real goal for reasons beyond weather (App Store presence, push notifications,
offline-first, camera/EXIF integration tighter than a browser `<input type="file">` allows) — not
a reason to pivot on its own.

## What this doc deliberately leaves out

The pitch Adam received also covered a cross-platform option (OpenWeatherMap/WeatherAPI.com +
Node/Lambda proxy + Redis + React Query + Lottie/SVG icon sets) framed as the "fast, cheap"
choice for a from-scratch build. Not reproduced here in detail because it's strictly worse than
what this app already has: we already get the same current+hourly+daily data from Open-Meteo for
free with no key, already have the Cloudflare Worker proxy pattern proven twice over, and don't
need Redis-tier caching at RFC's scale. If a cross-platform (not iOS-native) direction is ever
actually on the table, re-derive this from scratch against whatever this app looks like at that
time rather than resurrecting the original pitch — a lot of it (React Query, Retrofit+Room,
SwiftData) is about offline mobile apps with local databases, which this app still may not be.
