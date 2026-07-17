# Future Release Checklist

## Plan

- [ ] Define user outcome, risk and non-goals.
- [ ] Identify affected provider, engine, entitlement, billing, auth and schema boundaries.
- [ ] Assign version impact using `VERSIONING.md`.
- [ ] Decide whether migration, environment or external-console changes are required.
- [ ] Prepare rollback before implementation.

## Implement

- [ ] Work on the approved branch; do not mix unrelated changes.
- [ ] Preserve fail-closed market behavior and server-side entitlement filtering.
- [ ] Add focused regression tests.
- [ ] Update architecture, environment, runbooks and legal text when behavior changes.
- [ ] Add an `Unreleased` changelog entry.
- [ ] Never commit secrets, production data or authenticated URLs.

## Review

- [ ] Review user-visible truthfulness and risk wording.
- [ ] Review authorization and data exposure.
- [ ] Review logs and errors for secret/member leakage.
- [ ] Review dependency licences and advisories.
- [ ] Review mobile, keyboard, screen-reader and reduced-motion impact.
- [ ] Review schema migration idempotency, locking and rollback.
- [ ] Review Stripe webhook replay and event ordering.

## Validate

- [ ] `npm run ops:validate`
- [ ] `node --test tests/*.test.ts`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run validate:artifact`
- [ ] Rendered artifact test
- [ ] Staging smoke tests for affected paths

## Release

- [ ] Move changelog entries from `Unreleased` to the release version/date.
- [ ] Set build provenance to the exact commit and test total.
- [ ] Create an immutable release tag only after approval.
- [ ] Take required backups.
- [ ] Apply reviewed migrations separately.
- [ ] Deploy the immutable artifact.
- [ ] Complete deployment and production smoke checklists.
- [ ] Record release operator, deployment ID and evidence.

## Observe and close

- [ ] Monitor the defined observation window.
- [ ] Confirm Stripe webhook backlog is empty.
- [ ] Confirm provider freshness and failure count.
- [ ] Confirm Supabase and authentication health.
- [ ] Declare success or execute rollback.
- [ ] Record follow-ups and update runbooks from real findings.

