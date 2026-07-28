# ChatGPT / assistant handoff — Project BULLSEYE YouTube video automation
# Non-secret checklist only. No emails of individuals, no client secrets.

## Goal
Finish Google Cloud + OAuth for uploading videos to the NASH AI Markets YouTube channel for Project BULLSEYE video automation.

## Already prepared in repo (`nash-ai-markets-live`)
- Tooling: `tools/youtube-upload/` (README, `.env.example`, OAuth CLI, resumable upload CLI)
- Callback scaffold: `app/api/youtube/oauth/callback` (operator-only; NOT customer auth)
- Bootstrap script: `tools/youtube-upload/scripts/gcloud-bootstrap.sh`
- Customer Supabase / magic-link / Stripe auth must remain untouched

## Exact Console steps remaining
1. Create GCP project named **NASH AI Markets Video Automation** (suggested id: `nash-ai-markets-video`) if not already created.
2. Enable **YouTube Data API v3** (APIs & Services → Library).
3. Google Auth Platform → Branding:
   - App name: NASH AI Markets (or NASH AI Markets Video Automation)
   - Home: https://www.nashaimarkets.com
   - Privacy: https://www.nashaimarkets.com/privacy
   - Terms: https://www.nashaimarkets.com/terms
   - Authorized domain: nashaimarkets.com
   - Developer contact: hello@nashaimarkets.com (public site support address)
   - Support email: operator chooses their business/Google account email in Console (do not invent private personal data)
4. Audience → **External** → add the operator’s own Google account as test user.
5. Data Access → add ONLY: `https://www.googleapis.com/auth/youtube.upload`
6. Clients → Create Client → **Web application** named **NASH AI Markets Uploader**
7. Authorized redirect URIs:
   - http://localhost:8787/api/youtube/oauth/callback
   - http://127.0.0.1:8787/api/youtube/oauth/callback
   - https://www.nashaimarkets.com/api/youtube/oauth/callback
8. Download client JSON → put Client ID/Secret into `tools/youtube-upload/.env.local` (gitignored). Never commit. Never paste secret into chat.

## Local verify
```bash
cd tools/youtube-upload
cp .env.example .env.local   # if needed, then fill values
npm install
npm run auth
npm run upload -- --file ./sample.mp4 --title "Test private upload" --privacy private
```

## Constraints
- Scope must stay youtube.upload only
- Do not wire into Supabase magic-link or Stripe
- Do not print or store secrets in docs/chat
