# Grv Mailer — fresh Cloudflare Worker

Files:
- `index.js` — OAuth + Gmail sending app
- `wrangler.jsonc` — minimal project config

Required Cloudflare Production bindings:
- Variable: `GOOGLE_CLIENT_ID`
- Secret: `GOOGLE_CLIENT_SECRET`
- KV Namespace binding: `GRV_KV`

Google OAuth redirect URI:
`https://YOUR-WORKER-DOMAIN/oauth/google/callback`

Do not put the Google client secret in GitHub.
Do not manually add KV entries; the Worker creates its own keys.
