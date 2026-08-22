# Pocket Bullseye — launch-readiness continuation

Date: 22 August 2026 (Europe/London)

## Boundary

This tranche continues from the owner-approved perfect checkpoint. It changes
no approved layout, copy hierarchy, animation, branding or result presentation.
Production, Stripe, Supabase, DNS and the public Bullseye site remain untouched.

## Completed in this tranche

- Added deterministic post-response calibration so poor or unreadable evidence
  cannot retain a high-confidence, WATCH or inflated-grade result.
- Removed numeric level and Fibonacci output when the screenshot scale is not
  readable, and blocks ticker/timeframe certainty when label confidence is low.
- Added migration for older device-local decisions so missing score, risk,
  intention or identity fields do not break the Trader Fingerprint or Vault.
- Preserved every migrated screenshot string unchanged; no recompression or
  chart-byte mutation was introduced.
- Aligned later-chart review with the existing 8 MB upload contract.
- Added immediate in-flight locks for analysis and follow-up requests to prevent
  rapid taps from creating duplicate paid AI requests.
- Added focused regression coverage for calibration, compatibility, privacy,
  no-store handling, no-order boundaries and the end-to-end request journey.

## Accuracy-calibration protocol

Representative-chart testing must include clear, partial, poor, cropped-scale,
missing-label, conflicting-timeframe and visibly-indicated chart examples.
Expected direction is not scored as market prediction accuracy. The acceptance
target is evidence discipline: visible facts are identified, unsupported values
are absent, uncertainty increases as readability falls, and the result fails
closed whenever the screenshot cannot support a safe audit.

## Commercial and legal launch position

- The product remains conditional educational decision support, not an order,
  broker connection, execution service or guaranteed trading signal.
- Uploaded screenshots are processed for the requested audit and OpenAI storage
  is disabled in each Pocket request (`store: false`).
- Saved decisions remain device-local. Shared summaries exclude screenshots.
- A public paid launch still requires approved customer terms, privacy wording,
  FCA-perimeter review, pricing/entitlement confirmation, support ownership,
  cost limits and a final private-staging go/no-go decision.
- Licensed live market data is not required for screenshot-only analysis, but no
  external price, event or indicator may be marketed as live unless its rights,
  freshness and display conditions are separately cleared.

## Remaining work

1. Run the representative-chart calibration matrix with approved test images.
2. Run private-preview upload, analysis, failure, retry, save and later-review
   journeys on iPhone and at tablet width.
3. Establish per-user/server request budgets before opening paid public access.
4. Complete qualified UK privacy/consumer-terms and FCA-perimeter review.
5. Record the explicit owner public-launch go/no-go decision.
