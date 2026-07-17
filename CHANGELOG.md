# Changelog

All notable production changes to Project Bullseye will be documented here.
The format follows Keep a Changelog and the project uses Semantic Versioning.

## [Unreleased]

### Added

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
