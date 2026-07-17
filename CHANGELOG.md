# Changelog

## Unreleased

- Prepared `1.0.0-rc.1` with authenticated first-run onboarding, substantive
  trust and support pages, responsive member navigation, friendly recovery
  states, RC validation coverage and a prioritised release-candidate report.

- Added server-enforced Founding 100 Pro and Elite awards, permanent member
  badges, continuous-subscription price-lock rules, restricted administrator
  reporting, launch copy, tests, and production operations guidance.
- Added database-backed public Founding availability counts with neutral
  failure wording, exhausted-tier handling, accessible mobile styling and
  permanent-allocation regression coverage.
- Added the commercial launch experience: approved monthly and annual pricing,
  server-created Stripe checkout, comparison and FAQ content, commercial
  dashboard reporting, billing cadence, lifecycle email templates and schema.

All notable production changes to Project Bullseye will be documented here.
The format follows Keep a Changelog and the project uses Semantic Versioning.

## [Unreleased]

### Added

- Sprint Epsilon offline production simulation covering authentication,
  Morning Brief, waiting list, Founding Member access, Stripe, Supabase,
  recoverable errors and responsive/performance safeguards.
- Evidence-based final launch readiness report with deployment, rollback,
  blocker and post-launch monitoring guidance.
- Live OpenAI-powered Morning Brief summaries for verified Pro/Elite dashboard
  output using strict structured responses and deterministic evidence only.
- Safe Morning Brief fallback categories for missing configuration, rate
  limiting, timeout, provider failure and invalid model output.
- Safe OpenAI operational diagnostics with authentication, rate-limit, timeout
  and provider-availability categories plus deterministic fallback.
- Provider-neutral waiting-list confirmation and accepted Founding Member
  welcome templates with fail-closed email readiness diagnostics.
- Final Operation Launch readiness checklist spanning deployment, Supabase,
  Stripe, OpenAI, email, rollback and post-launch monitoring.
- Sprint Delta private-beta waiting-list flow with enumeration-safe duplicate
  handling and server-managed storage.
- Reviewed Founding Member onboarding for active Pro and Elite members without
  automatic entitlement or billing changes.
- Additive Operation Launch Supabase migration, loading states, mobile layouts
  and regression coverage for launch access controls.
- Sprint Gamma executive dashboard summary, reusable Morning Brief engine,
  protected member profile and subscription-status surfaces.
- Fixed historical placeholder Morning Brief input that is always labelled
  preview and cannot produce confidence, bias or actionable output.
- Sprint Beta AI Market Brief with constrained structured evidence
  prioritisation, deterministic fallback and fail-closed unavailable states.
- Reusable member navigation, dashboard card and safe-state components.
- Production operations pack covering architecture, private-beta launch,
  deployment, rollback, incidents, environment variables, smoke testing,
  release management and versioning.
- Safe operations documentation and production-environment validation scripts.
- Secret-pattern validation for tracked and unignored repository files that
  suppresses matched credential values.

### Changed

- OpenAI health diagnostics now validate the actual Responses generation path
  and distinguish exhausted quota, request rate, model access and permissions.
- Dashboard Morning Brief now distinguishes AI-assisted output from the
  deterministic fallback without changing confidence, direction, warnings or
  engine behavior.
- Stripe entitlement mapping now requires exactly one configured Price ID and
  no longer trusts subscription metadata as a tier fallback.
- Homepage market preview contains no fixed market prices, and paid calls to
  action use deployment-configured checkout URLs or fall back to the waiting
  list.
- Dashboard loading, account navigation and mobile layouts now cover the
  executive summary, Morning Brief, membership status and profile workflow.
- Member dashboard navigation, responsive layout and primary actions now form a
  consistent path through the dashboard, market brief and full terminal.
- OpenAI brief configuration is optional; production remains usable through the
  deterministic engines when the external service is unavailable.
- Corrected build-provenance variable names in the safe environment example.
- The default test command now runs the complete TypeScript regression suite,
  production build and rendered-artifact test.
- Production build and artifact validation now work on macOS while retaining
  bounded builds when GNU `timeout` is available.

### Security

- Operations procedures prohibit recording secrets, authenticated URLs, member
  identities or payment details in Git and incident evidence.

## [0.1.0]

- Initial pre-release Bullseye application baseline. Earlier development history
  remains archived in `CHANGELOG-v11.md` and Git.
