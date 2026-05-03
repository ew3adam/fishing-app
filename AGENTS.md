# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Riverside Fishing Club (RFC) — a client-side React 18 PWA built with Vite 5. No backend, no database, no Docker required.

### Commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (serves at `http://localhost:5173/fishing-app/`) |
| Build | `npm run build` |
| Preview prod build | `npm run preview` |
| Deploy (GH Pages) | `npm run deploy` |

### Notes

- The Vite base path is `/fishing-app/` — local dev URLs must include this prefix.
- No ESLint or test framework is configured in the repo; lint/test steps are not available.
- The CJS deprecation warning from Vite is cosmetic and does not affect functionality.
- External APIs (Open-Meteo weather, Anthropic AI chat) are called directly from the browser — no API keys needed for core fishing guide functionality.
- To bind to all interfaces (useful in cloud VMs), run: `npm run dev -- --host 0.0.0.0`
