# RFC Helper: deploy steps

The RFC Helper (`cloudflare/rfc-helper/`) is the club's one Cloudflare Worker. Routes:
`/health`, `/buoy` (NOAA buoy data), `/species-id` (AI fish ID, members only).
It is not part of `npm run deploy`; it is deployed on its own with Wrangler.

All commands run in a terminal from `cloudflare/rfc-helper/`.

1. Sign in to Cloudflare (opens your browser once): `npx wrangler login`
2. Deploy: `npx wrangler deploy`. Note the address it prints, like
   `https://rfc-helper.<your-subdomain>.workers.dev`.
3. Check it: open `<that address>/health` in a browser. It should show `{"ok":true}`.
4. AI key (only needed for species ID): create a key at https://console.anthropic.com and set a
   monthly spend limit there. Then run `npx wrangler secret put ANTHROPIC_API_KEY` and paste the
   key when asked. Never put the key in a file, the app, or a chat.
5. Tell the app where the Helper is: in the app folder, create `.env.local` (not committed) with
   `VITE_RFC_HELPER_URL=https://rfc-helper.<your-subdomain>.workers.dev`
   Restart `npm run dev`. Set the same value before `npm run deploy` for the live site.

Settings live in `wrangler.toml` (`ALLOWED_ORIGINS`, `MODEL`, `FIREBASE_PROJECT_ID`).
If `VITE_RFC_HELPER_URL` is empty, buoy data and AI species ID are simply turned off.
