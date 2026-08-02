# Versioning and Changelog Strategy

## Current state

`package.json` currently identifies the application as `0.1.0`. Until the
private-beta contract is stable, releases remain in the `0.x` series.

## Semantic versioning

Use `MAJOR.MINOR.PATCH`:

- **PATCH** — backwards-compatible bug, security, reliability, copy or
  operational correction with no entitlement/schema contract expansion.
- **MINOR** — backwards-compatible feature, new provider adapter, new terminal
  capability, new optional environment variable or additive migration.
- **MAJOR** — incompatible API, entitlement, data-schema, billing or operational
  contract change. Before `1.0.0`, record these explicitly and normally advance
  the minor version.

Prerelease examples may use `0.2.0-beta.1`. Do not infer or publish a version
from branch names.

## Release identity

Every production release record must contain:

- application version;
- full Git commit SHA;
- build timestamp in ISO-8601 UTC;
- verified test total;
- deployment/artifact ID;
- database migration state;
- release and rollback operators.

Diagnostics consume `APP_VERSION`, `BUILD_TIMESTAMP`, a supported commit-SHA
variable, and `BULLSEYE_TEST_TOTALS`.

## Changelog format

Maintain root `CHANGELOG.md` using Keep a Changelog headings:

```text
# Changelog

## [Unreleased]
### Added
### Changed
### Fixed
### Security
### Deprecated
### Removed

## [0.1.1] - YYYY-MM-DD
```

Rules:

1. Write member/operator impact, not commit-message repetition.
2. Mention migrations and environment contract changes.
3. Never include secrets, member identities or internal exploit detail.
4. Move entries out of `Unreleased` only when the exact artifact is approved.
5. Link releases/tags after the repository adopts production tags.
6. Keep historical `CHANGELOG-v11.md` as an archive; new releases use
   `CHANGELOG.md`.

## Tagging

After validation and approval, create an annotated tag `v<version>` on the exact
deployed commit. Do not move or reuse tags. If a deployment is rolled back, keep
the original tag and issue a new patch release for the correction.

