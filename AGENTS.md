# AGENTS.md

## Cursor Cloud specific instructions

**Product:** "North Riverside Fishing Guide" — a client-side React PWA (Progressive Web App) for shore fishing in the North Riverside / Cook County / Lake Michigan corridor (Illinois). Frontend-only, no backend or database.

**Tech stack:** React 18, Vite 5, deployed to GitHub Pages via `gh-pages`.

### Running the app

- `npm run dev` starts the Vite dev server (default port 5173). The app is served at `/fishing-app/` due to the `base` path in `vite.config.js`.
- Use `npm run dev -- --host 0.0.0.0` to expose on all interfaces inside Cloud VMs.
- `npm run build` produces a production build in `dist/`.

### Notes

- There is no linter, test runner, or formatter configured in `package.json`. Only `dev`, `build`, `preview`, and `deploy` scripts exist.
- `App.jsx` (~2500 lines) is the main component containing all app logic and hardcoded data (species, lakes, rigs, etc.).
- `FishingApp.jsx` is an alternate/older copy of the same app — not imported anywhere.
- External APIs called client-side: Open-Meteo (free, no key) and Anthropic (appears non-functional due to missing API key / CORS).
- The Vite CJS deprecation warning is cosmetic and does not affect functionality.
