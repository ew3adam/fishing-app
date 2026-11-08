# Cloudflare Worker deploy — Fishing Assistant

Powers the chat bubble on Home ("Ask the Fishing Assistant"). The app is a static, client-side-only
site (`CLAUDE.md`) with no server — a real Anthropic API key can never ship in the browser bundle
(anyone could read it out of the page source and run up your bill). This Worker holds the key as a
Cloudflare **secret** (not a plain env var — secrets aren't visible in the dashboard or `wrangler.toml`
after you set them) and is the only thing that calls `api.anthropic.com` for this feature.

Worker source: `cloudflare/fishing-assistant-worker.js` (not part of the app's build — deployed
separately, same pattern as the buoy proxy).

**This one needs an actual Anthropic API key**, unlike the buoy proxy (which only proxies free
public NOAA data). Get one from [console.anthropic.com](https://console.anthropic.com/) →
Settings → API Keys, if you don't already have one — this is billed per use on your Anthropic
account, separate from Cloudflare.

## Deploy via CLI (recommended — this is the only way to set the secret from the command line)

From `cloudflare/`:

```
CLOUDFLARE_API_TOKEN=<token with Workers Edit permission> \
CLOUDFLARE_ACCOUNT_ID=<your account ID> \
npx wrangler deploy --config wrangler.fishing-assistant.toml
```

Then set the secret (prompts you to paste the key, doesn't echo it or store it in any file):

```
CLOUDFLARE_API_TOKEN=<same token> \
CLOUDFLARE_ACCOUNT_ID=<same account ID> \
npx wrangler secret put ANTHROPIC_API_KEY --config wrangler.fishing-assistant.toml
```

Paste your Anthropic API key when prompted. The Worker will return a clear "not configured" error
until this is set.

## Deploy (dashboard only, no CLI needed)

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create**.
2. Choose **Create Worker**. Name it `rfc-fishing-assistant`. Click **Deploy** to create it with
   the default template.
3. Click **Edit code** and replace the entire contents with `cloudflare/fishing-assistant-worker.js`
   from this repo (copy the whole file). Click **Deploy** again.
4. Go to the Worker's **Settings → Variables and Secrets** → **Add** → name it `ANTHROPIC_API_KEY`,
   type **Secret**, paste your Anthropic API key, save.
5. Your Worker's URL is on the Worker's overview page — looks like
   `https://rfc-fishing-assistant.<your-account-subdomain>.workers.dev`.
6. **Send that exact URL back** — the app's `FISHING_ASSISTANT_URL` constant in `src/App.jsx`
   (search for `YOUR-SUBDOMAIN` near it) needs it to actually call your Worker.

## Verify it works on its own

The Worker rejects unauthenticated requests by design (it checks for a valid Firebase sign-in
token — see the comment at the top of the Worker file), so a plain browser visit or bare `curl`
will correctly get a 401, not a reply. That's expected — it means the auth check is working, not
that the Worker is broken. Real verification happens through the app itself once the URL is wired
in: sign in, open the chat bubble, ask a question, confirm you get an answer back.

## Cost / limits

- **Cloudflare**: free tier is 100,000 requests/day, far more than a club needs.
- **Anthropic**: billed per request to your Anthropic account. Each chat message is one short,
  capped request (max 500 output tokens, Haiku model — the cheapest current Claude model, chosen
  specifically because this is grounded short-answer Q&A, not open-ended reasoning). The app's
  own login gate is the only access control — there's no per-member usage cap, so cost scales with
  how much members actually use it. Worth keeping an eye on your Anthropic usage dashboard for the
  first few weeks to see real-world volume.
