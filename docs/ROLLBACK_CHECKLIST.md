# Production Rollback Checklist

Rollback is a controlled release. Preserve evidence and avoid destructive
database operations unless an approved recovery plan requires them.

## Trigger

Initiate rollback for:

- authentication or entitlement failure affecting multiple members;
- incorrect billing state caused by the release;
- unsafe market-data status or warning suppression;
- sustained high error rates or unusable dashboard/terminal;
- security exposure;
- failed smoke-test launch gate.

## Stabilize

- [ ] Assign incident lead and deployment operator.
- [ ] Record detection time, affected release SHA and observed impact.
- [ ] Stop further deployments and configuration changes.
- [ ] Preserve relevant sanitized logs, Stripe event IDs and diagnostics.
- [ ] If market truthfulness is uncertain, keep or force the existing
      fail-closed unavailable state; never substitute values.

## Application rollback

- [ ] Identify the previous known-good commit and immutable artifact.
- [ ] Confirm its environment-variable contract is compatible.
- [ ] Deploy the previous artifact through the normal hosting mechanism.
- [ ] Do not delete or disable the Stripe webhook during rollback; allow Stripe
      to retry temporary failures.
- [ ] Run critical smoke tests: homepage, login, entitlement, dashboard,
      terminal safe state, webhook response and sign-out.

## Configuration rollback

- [ ] Restore only the affected variable to its recorded previous version.
- [ ] Never paste secret values into the incident record.
- [ ] Restart/redeploy if the hosting platform requires it.
- [ ] Re-run environment presence and smoke checks.

## Database rollback

- [ ] Prefer forward repair or leaving an unused additive table in place.
- [ ] Confirm a restorable backup exists before destructive SQL.
- [ ] Review dependent application versions and foreign keys.
- [ ] Obtain explicit approval from the incident lead and data owner.
- [ ] For preview migration rollback, `drop table
      public.membership_previews` deletes all claim history.
- [ ] For verified-outcome rollback, `drop table
      public.bullseye_verified_outcomes` deletes all stored verification
      history.
- [ ] Never execute rollback SQL directly from this checklist; use a separately
      reviewed change record.

## DNS rollback

- [ ] Restore the recorded previous DNS values.
- [ ] Account for TTL and propagation time.
- [ ] Verify the certificate and canonical redirect at the restored target.

## Close

- [ ] Confirm error rate and external-service health returned to baseline.
- [ ] Confirm Stripe has no stuck or repeatedly failing deliveries.
- [ ] Confirm Supabase membership state for affected test accounts.
- [ ] Notify affected beta members with verified facts only.
- [ ] Record final status, recovery time and remaining data repairs.
- [ ] Open a post-incident review and corrective actions.

