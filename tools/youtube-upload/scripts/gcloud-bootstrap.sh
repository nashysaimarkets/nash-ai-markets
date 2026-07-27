#!/usr/bin/env bash
# Bootstrap Google Cloud project + YouTube Data API for Project BULLSEYE video automation.
# Does not touch customer Supabase / magic-link / Stripe auth.
#
# Requires: gcloud on PATH, authenticated via browser (gcloud auth login).
# Does NOT print client secrets or account emails.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_LOCAL="${ROOT}/.env.local"
PROJECT_NAME="NASH AI Markets Video Automation"
PROJECT_ID_DEFAULT="nash-ai-markets-video"
CLIENT_DISPLAY_NAME="NASH AI Markets Uploader"
REDIRECT_LOCAL="http://localhost:8787/api/youtube/oauth/callback"
REDIRECT_LOOPBACK="http://127.0.0.1:8787/api/youtube/oauth/callback"
REDIRECT_PROD="https://www.nashaimarkets.com/api/youtube/oauth/callback"
SCOPE="https://www.googleapis.com/auth/youtube.upload"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found on PATH."
  echo "Install: https://cloud.google.com/sdk/docs/install"
  echo "Then run: gcloud auth login"
  echo "Fallback Console steps: tools/youtube-upload/README.md"
  exit 1
fi

ACTIVE_COUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${ACTIVE_COUNT}" -lt 1 ]]; then
  echo "No active gcloud account. Run locally: gcloud auth login"
  echo "Complete browser login yourself — do not paste passwords into chat."
  exit 1
fi
echo "gcloud: authenticated account detected (email not printed)."

PROJECT_ID="${GCP_PROJECT_ID:-$PROJECT_ID_DEFAULT}"
echo "Using project id: ${PROJECT_ID}"
echo "Display name: ${PROJECT_NAME}"

if ! gcloud projects describe "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Creating project…"
  if ! gcloud projects create "${PROJECT_ID}" --name="${PROJECT_NAME}"; then
    echo "Project create failed (id may be taken). Set GCP_PROJECT_ID to a unique id and retry."
    exit 1
  fi
else
  echo "Project already exists."
fi

gcloud config set project "${PROJECT_ID}" >/dev/null

echo "Enabling YouTube Data API v3…"
gcloud services enable youtube.googleapis.com --project="${PROJECT_ID}"

echo ""
echo "=== Automated so far ==="
echo "- Project: ${PROJECT_NAME} (${PROJECT_ID})"
echo "- API enabled: youtube.googleapis.com (YouTube Data API v3)"
echo ""
echo "=== Console-only (or Auth Platform UI) — finish these ==="
echo "1. Google Auth Platform → Branding"
echo "   App home: https://www.nashaimarkets.com"
echo "   Privacy:  https://www.nashaimarkets.com/privacy"
echo "   Terms:    https://www.nashaimarkets.com/terms"
echo "   Domain:   nashaimarkets.com"
echo "   Developer contact: hello@nashaimarkets.com (public support)"
echo "2. Audience → External → add YOUR Google account as test user"
echo "3. Data Access → ONLY: ${SCOPE}"
echo "4. Clients → Create Client → Web application '${CLIENT_DISPLAY_NAME}'"
echo "   Redirect URIs:"
echo "   - ${REDIRECT_LOCAL}"
echo "   - ${REDIRECT_LOOPBACK}"
echo "   - ${REDIRECT_PROD}"
echo "5. Copy Client ID/Secret into gitignored file:"
echo "   ${ENV_LOCAL}"
echo "   (never commit; never paste secret into chat)"
echo ""
echo "Optional after brand exists: try creating the OAuth client via Console download JSON."
echo "Handoff checklist: docs/video-automation/CHATGPT_HANDOFF.md"
echo "Local auth/upload: cd tools/youtube-upload && npm install && npm run auth"
