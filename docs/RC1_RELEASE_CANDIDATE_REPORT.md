# RC1 Release Candidate Report

Date: 17 July 2026  
Branch: `bullseye-sprint-alpha`  
Candidate: RC1, local only

## Launch readiness

**78% ready for a controlled public release candidate.** The application,
truthfulness controls, commercial UX, onboarding, trust content and offline
validation are complete. Production approval still requires external evidence.

## Remaining issues

### Critical

- Apply and verify the reviewed Supabase migrations in order after a production
  backup. Until then onboarding, Founding and commercial reporting are not live.
- Create and test the four approved Stripe Prices and signed webhook lifecycle.

### High

- Connect and monitor a transactional email provider before promising lifecycle
  delivery.
- Complete deployed authentication, billing, market-data and OpenAI smoke tests.
- Configure production monitoring, alert ownership and a tested restore path.

### Medium

- Conduct screen-reader and keyboard QA on physical devices.
- Establish deployed Core Web Vitals and error-rate baselines.
- Obtain final UK legal review of Terms, Privacy, risk and Founding price-lock
  wording.

### Low

- Expand the Help Centre after recurring support questions are known.
- Add visual regression snapshots for core responsive breakpoints.

## Technical debt

- The canonical creation migration for the legacy `memberships` table remains
  absent; RC1 adds only backward-compatible nullable commercial fields.
- Lifecycle email content exists, but dispatch and delivery audit records are
  intentionally unimplemented.
- Market candles remain unavailable until a validated provider supplies OHLCV.
- Framework route classification reports some dynamic routes as unknown during
  build; the generated worker artifact is nevertheless validated.

## Recommended launch timing

Do not set a fixed public date from repository status alone. Schedule RC1 for
the first business day after all Critical items pass in staging, allowing at
least 48 hours for monitored test-mode soak and rollback rehearsal.

## Version 1.1 priorities

1. Searchable Help Centre informed by real support demand.
2. Transactional email delivery ledger and preference management.
3. Verified historical performance reporting with a larger audit sample.
4. Validated provider-backed OHLCV chart history.
5. Automated visual, accessibility and Core Web Vitals regression budgets.
