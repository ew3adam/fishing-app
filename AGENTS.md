# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
Single-page React PWA — "North Riverside Fishing Guide" — built with Vite. No backend, no database, no authentication. All data is hardcoded in JSX; external API calls (Open-Meteo weather, Anthropic AI chat) happen client-side.

### Running the dev server
```bash
npm run dev -- --host 0.0.0.0 --port 5173
```
App is served at `http://localhost:5173/fishing-app/` (note the `/fishing-app/` base path set in `vite.config.js`).

### Build
```bash
npm run build
```

### Key caveats
- **No test framework** is configured — there are no unit/integration tests to run.
- **No linter** is configured — there is no ESLint, Prettier, or similar tooling in the project.
- The Vite CJS deprecation warning (`The CJS build of Vite's Node API is deprecated`) is expected and harmless on Vite 5.x.
- The app uses `package-lock.json` — always use `npm` (not pnpm/yarn).
- `App.jsx` is the main component (~2500 lines); `FishingApp.jsx` appears to be an earlier version.
- Anthropic API key is entered by the user in the app UI at runtime — no env vars needed.
