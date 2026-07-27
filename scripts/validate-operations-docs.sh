#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

required_docs=(
  docs/README.md
  docs/ARCHITECTURE.md
  docs/LAUNCH_PLAYBOOK.md
  docs/DEPLOYMENT_CHECKLIST.md
  docs/ROLLBACK_CHECKLIST.md
  docs/INCIDENT_RUNBOOK.md
  docs/ENVIRONMENT_VARIABLES.md
  docs/PRODUCTION_SMOKE_TESTS.md
  docs/RELEASE_CHECKLIST.md
  docs/VERSIONING.md
  docs/MISSING_DOCUMENTATION.md
  CHANGELOG.md
  .env.example
)

for path in "${required_docs[@]}"; do
  [[ -s "${path}" ]] || {
    echo "Missing or empty operations document: ${path}" >&2
    exit 66
  }
done

implemented_variables="$({
  rg -o 'process\.env\.[A-Z0-9_]+' app utils worker vite.config.ts 2>/dev/null \
    | sed 's/.*process\.env\.//' \
    | sort -u
  printf '%s\n' APP_VERSION BUILD_TIMESTAMP GIT_COMMIT_SHA VERCEL_GIT_COMMIT_SHA CF_PAGES_COMMIT_SHA BULLSEYE_TEST_TOTALS
} | sort -u)"

while IFS= read -r variable; do
  [[ -n "${variable}" ]] || continue
  if ! rg -q "\`${variable}\`" docs/ENVIRONMENT_VARIABLES.md; then
    echo "Implemented variable is undocumented: ${variable}" >&2
    exit 65
  fi
done <<<"${implemented_variables}"

example_variables="$(sed -n 's/^[# ]*\\([A-Z][A-Z0-9_]*\\)=.*/\\1/p' .env.example | sort -u)"
while IFS= read -r variable; do
  [[ -n "${variable}" ]] || continue
  if ! rg -q "\`${variable}\`" docs/ENVIRONMENT_VARIABLES.md; then
    echo "Example variable is undocumented: ${variable}" >&2
    exit 65
  fi
done <<<"${example_variables}"

if rg -n 'sk_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}' docs .env.example CHANGELOG.md; then
  echo "Potential real credential found in operations documentation." >&2
  exit 65
fi

echo "Production operations documentation matches the implemented variable surface."

