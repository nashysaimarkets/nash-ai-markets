#!/usr/bin/env bash
set -euo pipefail

# This is a metadata-only process configuration, never a Sites deployment.
# Existing credentials stay inherited in this executor; none are read or copied.
if [[ $# -ne 1 || "${1-}" != "--metadata-only" ]]; then
  echo 'Use --metadata-only inside the authorised isolated executor; paid dispatch stays disabled.' >&2
  exit 2
fi

benchmark_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
exec env \
  OPENAI_ORG_ID=org-5vLRRzXwcigUx96TVE0rI3RW \
  OPENAI_PROJECT_ID=proj_LTmAIE2Ve7gUAFJ9M74ZxIBI \
  POCKET_BENCHMARK_OPENAI_PROJECT_ID=proj_LTmAIE2Ve7gUAFJ9M74ZxIBI \
  POCKET_BENCHMARK_CANDIDATE_SHA=93f3fe282c6cab0196812aec989dddaa915bb986 \
  OPENAI_POCKET_MODEL=gpt-5-mini-2025-08-07 \
  OPENAI_POCKET_ANNOTATION_MODEL=gpt-5-mini-2025-08-07 \
  NEXT_PUBLIC_SUPABASE_URL=https://pxlqvaddvghjjhenqmdh.supabase.co \
  POCKET_BENCHMARK_ACCOUNTING_MODE=full-reservation-v2 \
  POCKET_BENCHMARK_PILOT_ENABLED=false \
  POCKET_REAL_BENCHMARK_DISPATCH=false \
  POCKET_BENCHMARK_RUNTIME_METADATA_ENABLED=true \
  node "$benchmark_root/scripts/verify-pocket-benchmark-runtime.mjs"
