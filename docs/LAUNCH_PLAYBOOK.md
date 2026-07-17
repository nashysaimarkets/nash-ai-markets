# Version 1.0 Public Launch Playbook

This playbook begins from the approved release-candidate commit. Do not expose
public users until every launch gate has an owner and evidence.

## Phase 1 — Establish ownership and release scope

1. Name the release owner, deployment operator, incident lead and support
   contact.
2. Select the exact release commit; record its full SHA.
3. Freeze unrelated code and configuration changes.
4. Confirm the launch cohort, support hours and rollback observation window.
5. Record the production hostname without adding it to documentation until it
   is actually assigned.

Exit evidence: named owners, release SHA, launch scope and rollback decision-maker.

## Phase 2 — Make the database reproducible

1. Export the current production Supabase schema.
2. Compare it with `202607170000_memberships.sql` and check for duplicate
   normalized membership emails.
3. Take a backup or restorable snapshot.
4. Apply `202607170000_memberships.sql` manually, then verify authenticated
   users can select only the row matching their verified JWT email.
5. Apply migrations `202607170001` through `202607170007` manually in order.
8. Verify constraints, indexes, foreign keys and RLS.
9. Using anonymous and authenticated browser roles, prove that server-managed
   tables are not writable and only the permitted own-membership read succeeds.
10. Verify the service role can perform only the required application actions.
11. Submit a staging waiting-list record and eligible Founding Member
    onboarding record, then confirm neither changes `memberships`.

Exit evidence: migration log, schema export, RLS test results and backup ID.

## Phase 3 — Configure authentication

1. Configure the final Supabase Site URL.
2. Allow only controlled staging and production `/auth/callback` URLs.
3. Configure the magic-link sender and template without exposing secrets.
4. Review token expiry, session duration and redirect behavior.
5. Send test links to multiple email providers.
6. Confirm a new email creates Free access and an existing paid email resolves
   the correct active tier and `current_period_end`.
7. Confirm sign-out invalidates the browser session.

Exit evidence: delivery screenshots with addresses redacted and route results.

## Phase 4 — Configure Stripe

1. Confirm production Pro and Elite products, prices, currency and billing
   interval.
2. Set the four monthly and annual Stripe Price ID variables to the matching
   products; server-created checkout must remain the only purchase path.
5. Configure the production customer portal and
   `STRIPE_CUSTOMER_PORTAL_LINK`.
6. Add `/api/stripe/webhook` as the production webhook endpoint.
7. Subscribe to:
   - `checkout.session.completed`;
   - `customer.subscription.created`;
   - `customer.subscription.updated`;
   - `customer.subscription.deleted`;
   - `invoice.payment_failed`.
8. Install the endpoint's production signing secret.
9. Configure checkout success `/welcome` and cancellation `/cancelled`.
10. Complete a controlled purchase, upgrade, failed-payment simulation,
   cancellation and webhook replay.
11. Verify membership email, plan, status, customer/subscription IDs and period
    end after each transition.
12. Verify an unknown Price ID and metadata-only plan both fail closed.

Exit evidence: Stripe event IDs, sanitized database results and entitlement
screenshots, including proof that an older event cannot overwrite newer state.

## Phase 5 — Configure market data

1. Confirm the provider account is licensed for the five required inputs.
2. Install FMP configuration through the hosting secret manager.
3. Never place the key in the base URL.
4. Load Elite diagnostics and verify authentication is accepted.
5. Confirm provider name, last attempt, last success, latency, age and failure
   count are plausible.
6. Verify each symbol with the provider's current symbol directory.
7. Test a timeout, malformed response, stale timestamp and future timestamp in
   staging; each must fail closed.
8. Confirm economic events show unavailable because the current FMP adapter
   does not supply a calendar.

Exit evidence: sanitized diagnostics and failure-mode results.

## Phase 6 — Configure hosting, DNS and TLS

1. Add all required variables using the hosting secret manager.
2. Run `npm run ops:check-env` inside the production build environment.
3. Deploy the reviewed commit to a non-public production candidate.
4. Configure DNS and retain the previous record values.
5. Verify TLS hostname coverage, certificate chain and renewal.
6. Verify HTTP redirects to the selected HTTPS canonical host.
7. Verify response security headers on HTML, API, redirect and error responses.
8. Restrict hosting, DNS and deployment permissions to named operators.

Exit evidence: deployment ID, DNS snapshot, TLS result and header capture.

## Phase 7 — Backups, monitoring and support

1. Enable Supabase backups and record retention.
2. Complete one restore drill into an isolated project.
3. Configure uptime checks for `/`, `/login` and an authenticated synthetic
   journey where supported.
4. Alert on Stripe webhook failures, authentication errors, Supabase errors,
   provider staleness/rate limits and elevated application errors.
5. Record alert recipients and escalation timing.
6. Prepare member communications for billing, auth and provider incidents.

Exit evidence: restore result, monitor IDs and tested alert notifications.

## Phase 8 — Release validation

1. Run `npm run ops:validate`.
2. Run all TypeScript tests.
3. Run strict TypeScript and ESLint.
4. Run the production build and artifact validation.
5. Complete the entire production smoke-test checklist.
6. Complete keyboard, screen-reader and physical mobile checks.
7. Obtain legal approval for the current terms, privacy and risk wording.
8. Confirm the rollback owner and previous known-good artifact.
9. Complete `LAUNCH_READINESS_CHECKLIST.md`.

Exit evidence: signed deployment checklist and smoke-test record.

## Phase 9 — Open public launch

1. Invite a small first cohort.
2. Monitor authentication, provider freshness, errors and Stripe events during
   each invitation wave.
3. Expand only after the first cohort completes login and sees truthful access.
4. Never bypass fail-closed market behavior to improve apparent availability.
5. Hold a post-launch review within one business day.
