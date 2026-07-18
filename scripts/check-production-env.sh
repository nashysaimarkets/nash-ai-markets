#!/usr/bin/env bash
set -euo pipefail

missing=()
invalid=()

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    missing+=("${name}")
  fi
}

require_https_url() {
  local name="$1"
  local value="${!name:-}"
  require_var "${name}"
  if [[ -n "${value}" && "${value}" != https://* ]]; then
    invalid+=("${name}: must use https")
  fi
}

require_var NEXT_PUBLIC_SUPABASE_URL
require_var NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
require_var SUPABASE_SERVICE_ROLE_KEY
require_var STRIPE_SECRET_KEY
require_var STRIPE_WEBHOOK_SECRET
require_var STRIPE_PRO_PRICE_ID
require_var STRIPE_ELITE_PRICE_ID
require_var STRIPE_PRO_ANNUAL_PRICE_ID
require_var STRIPE_ELITE_ANNUAL_PRICE_ID
require_var STRIPE_LEGACY_PRO_PRICE_ID
require_var STRIPE_LEGACY_ELITE_PRICE_ID
require_https_url STRIPE_CUSTOMER_PORTAL_LINK
require_var APP_VERSION
require_var BUILD_TIMESTAMP
require_var BULLSEYE_TEST_TOTALS
require_var BULLSEYE_ADMIN_EMAILS

if [[ -n "${OPENAI_BRIEF_MODEL:-}" || -n "${OPENAI_MORNING_BRIEF_MODEL:-}" ]]; then
  require_var OPENAI_API_KEY
fi

if [[ -z "${GIT_COMMIT_SHA:-}" && -z "${VERCEL_GIT_COMMIT_SHA:-}" && -z "${CF_PAGES_COMMIT_SHA:-}" ]]; then
  missing+=("GIT_COMMIT_SHA (or supported platform commit SHA)")
fi

provider="${MARKET_DATA_PROVIDER:-}"
require_var MARKET_DATA_PROVIDER
if [[ "${provider}" == "fmp" ]]; then
  require_var FMP_API_KEY
  require_https_url FMP_API_BASE_URL
  if [[ "${FMP_API_BASE_URL:-}" == *"apikey="* ]]; then
    invalid+=("FMP_API_BASE_URL: must not contain credentials")
  fi
elif [[ -n "${provider}" && "${provider}" != "preview" ]]; then
  require_https_url MARKET_DATA_API_URL
elif [[ "${provider}" == "preview" ]]; then
  invalid+=("MARKET_DATA_PROVIDER: preview is fail-closed and not actionable for private beta")
fi

if [[ -n "${BUILD_TIMESTAMP:-}" ]] && ! node -e 'process.exit(Number.isFinite(Date.parse(process.argv[1])) ? 0 : 1)' "${BUILD_TIMESTAMP}"; then
  invalid+=("BUILD_TIMESTAMP: must be an ISO-8601-compatible timestamp")
fi
if [[ -n "${APP_VERSION:-}" && ! "${APP_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][A-Za-z0-9.-]+)?$ ]]; then
  invalid+=("APP_VERSION: must be a semantic version")
fi
if [[ -n "${BULLSEYE_TEST_TOTALS:-}" && ! "${BULLSEYE_TEST_TOTALS}" =~ ^[1-9][0-9]*$ ]]; then
  invalid+=("BULLSEYE_TEST_TOTALS: must be a positive integer")
fi

if ((${#missing[@]})); then
  echo "Missing required production variable names:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
fi
if ((${#invalid[@]})); then
  echo "Invalid production configuration:" >&2
  printf '  - %s\n' "${invalid[@]}" >&2
fi
if ((${#missing[@]} || ${#invalid[@]})); then
  exit 78
fi

echo "Production environment variable presence and safe formats validated."
echo "Credential validity and external-service configuration still require smoke testing."
