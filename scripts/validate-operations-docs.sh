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
  docs/OPERATIONAL_OWNERSHIP.md
  docs/RESTORE_EVIDENCE_2026-08-16.md
  docs/ACCESSIBILITY_PHYSICAL_ACCEPTANCE.md
  docs/UK_LEGAL_PRIVACY_APPROVAL_PACK.md
  docs/COOKIE_AND_DEVICE_STORAGE_INVENTORY.md
  docs/DATA_RETENTION_AND_RIGHTS_SCHEDULE.md
  docs/RETENTION_RIGHTS_EXERCISE_2026-08-16.md
  docs/ICO_FEE_SELF_ASSESSMENT_2026-08-16.md
  docs/PROCESSOR_AND_VENDOR_REGISTER.md
  docs/VENDOR_PRIVACY_EVIDENCE_2026-08-16.md
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

# Developer machines commonly have ripgrep, but the hosted CI image does not
# guarantee it. Keep this validator dependency-free by falling back to GNU grep.
if command -v rg >/dev/null 2>&1; then
  scan_env_references() {
    rg -o 'process\.env\.[A-Z0-9_]+' "$@" 2>/dev/null || true
  }
  document_contains() {
    rg -Fq -- "$1" "$2"
  }
  scan_credentials() {
    rg -n 'sk_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}' "$@"
  }
else
  scan_env_references() {
    grep -RhoE 'process\.env\.[A-Z0-9_]+' "$@" 2>/dev/null || true
  }
  document_contains() {
    grep -Fq -- "$1" "$2"
  }
  scan_credentials() {
    grep -REn 'sk_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}' "$@" 2>/dev/null
  }
fi

implemented_variables="$({
  scan_env_references app utils worker vite.config.ts \
    | sed 's/.*process\.env\.//' \
    | sort -u
  printf '%s\n' APP_VERSION BUILD_TIMESTAMP GIT_COMMIT_SHA VERCEL_GIT_COMMIT_SHA CF_PAGES_COMMIT_SHA BULLSEYE_TEST_TOTALS
} | sort -u)"

while IFS= read -r variable; do
  [[ -n "${variable}" ]] || continue
  if ! document_contains "\`${variable}\`" docs/ENVIRONMENT_VARIABLES.md; then
    echo "Implemented variable is undocumented: ${variable}" >&2
    exit 65
  fi
done <<<"${implemented_variables}"

example_variables="$(sed -n 's/^[# ]*\([A-Z][A-Z0-9_]*\)=.*/\1/p' .env.example | sort -u)"
while IFS= read -r variable; do
  [[ -n "${variable}" ]] || continue
  if ! document_contains "\`${variable}\`" docs/ENVIRONMENT_VARIABLES.md; then
    echo "Example variable is undocumented: ${variable}" >&2
    exit 65
  fi
done <<<"${example_variables}"

if scan_credentials docs .env.example CHANGELOG.md; then
  echo "Potential real credential found in operations documentation." >&2
  exit 65
fi

echo "Production operations documentation matches the implemented variable surface."
