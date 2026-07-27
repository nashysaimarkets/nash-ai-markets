# YouTube Upload — Project BULLSEYE Video Automation

Operator-only tooling for uploading videos to the NASH AI Markets YouTube channel via **YouTube Data API v3** using the single scope:

`https://www.googleapis.com/auth/youtube.upload`

**This is completely separate from customer magic-link / Supabase / Stripe auth.** Do not reuse these credentials in the member login flow.

## Google Cloud project

| Field | Value |
|---|---|
| Project display name | **NASH AI Markets Video Automation** |
| Suggested project id | `nash-ai-markets-video` (or Console-generated) |
| OAuth client name | **NASH AI Markets Uploader** (Web application) |
| Audience | External (Testing until verification) |
| API | YouTube Data API v3 |

## Redirect URIs (OAuth web client)

Add all of these on the client (Clients → NASH AI Markets Uploader → Authorized redirect URIs):

| Environment | Redirect URI |
|---|---|
| Local CLI / scaffold | `http://localhost:8787/api/youtube/oauth/callback` |
| Production (future operator callback) | `https://www.nashaimarkets.com/api/youtube/oauth/callback` |
| Optional loopback | `http://127.0.0.1:8787/api/youtube/oauth/callback` |

Authorized JavaScript origins (optional for this server-side flow):

- `http://localhost:8787`
- `https://www.nashaimarkets.com`

Vercel preview hosts change per deploy; prefer local + production URIs for Testing mode. Add a stable preview host later only if needed.

## Console setup (exact path)

If `gcloud` is unavailable or not logged in, do this in [Google Cloud Console](https://console.cloud.google.com/):

1. **Create project** named `NASH AI Markets Video Automation`.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **Google Auth Platform → Branding** — application details using public business info:
   - App name: `NASH AI Markets` (or `NASH AI Markets Video Automation`)
   - User support email: your Google Workspace / business inbox (operator chooses)
   - App logo: from brand assets if available
   - App home page: `https://www.nashaimarkets.com`
   - Privacy policy: `https://www.nashaimarkets.com/privacy`
   - Terms of service: `https://www.nashaimarkets.com/terms`
   - Authorized domains: `nashaimarkets.com`
   - Developer contact: `hello@nashaimarkets.com` (public support address from the site)
4. **Audience → External** → add **your own** Google account as a test user (Testing mode).
5. **Data Access** → add **only** `https://www.googleapis.com/auth/youtube.upload`.
6. **Clients → Create Client → Web application** named `NASH AI Markets Uploader` with the redirect URIs above.
7. Download the client JSON (or copy Client ID / Secret) into `tools/youtube-upload/.env.local` — **never commit**.

Automated helpers (when authenticated):

```bash
# One-time on this machine (gcloud was installed under ~/google-cloud-sdk)
source tools/youtube-upload/scripts/gcloud-env.sh
gcloud auth login          # browser login — do not paste passwords into chat
bash tools/youtube-upload/scripts/gcloud-bootstrap.sh
```

`gcloud-bootstrap.sh` creates/selects the GCP project and enables YouTube Data API v3.
OAuth branding, audience/test users, scopes, and the web client are still Console steps
(Google Auth Platform APIs are incomplete for full automation).

## Local tool usage

```bash
cd tools/youtube-upload
cp .env.example .env.local
# Fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI
npm install
npm run auth          # browser consent → saves refresh token under .tokens/ (gitignored)
npm run upload -- --file ./video.mp4 --title "Draft title" --privacy private
```

## Cedar-narrated branded episode

The renderer uses only a supplied, reviewed script. It does not fetch or invent
market values. Keep `OPENAI_API_KEY` in `.env.local` or another protected runtime.
Every video carries an on-screen AI-narration disclosure.

```bash
npm run create:episode -- \
  --script-file ./brief.txt \
  --title "Pre-market briefing" \
  --label "Pre-market · 07:30 UK" \
  --output ./premarket.mp4
```

Requirements: `OPENAI_API_KEY`, `BULLSEYE_TTS_VOICE=cedar`, and `ffmpeg`.
Keep the first upload private for operator review:

```bash
npm run upload -- \
  --file ./premarket.mp4 \
  --title "NASH AI Markets — Pre-market briefing" \
  --privacy private
```

## Next.js callback stub

`app/api/youtube/oauth/callback/route.ts` is a **non-production scaffold** that accepts the OAuth redirect for operator flows. It does **not** integrate with Supabase session cookies or magic-link auth.

## Secrets

- `.env.local`, `.tokens/`, `client_secret*.json` are gitignored.
- Never paste client secrets into chat or commit them.
- `npm run security:scan` (repo root) should remain clean.

## Handoff

Non-secret Console checklist for continuing in another assistant:

- `docs/video-automation/CHATGPT_HANDOFF.md`
