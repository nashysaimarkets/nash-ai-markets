# Pocket scan allowance and capacity repair

Supersedes the background-preparation rollout in pocket-precision-speed-2026-09-09.md.

## Observed failure

The real customer flow hit a four-attempt/30-minute application limit after two successful scans and two provider-quota failures. Background preparation competed with selected timeframe work. Separately, the provider returned credit_balance_exhausted. Software cannot restore a prepaid balance.

## Changes

- Removed automatic background report preparation. Only explicit selections generate reports; queued duplicate selections still share work and verified results remain reusable.
- Full analysis allowance is ten reservations/successful scans per 30-minute requester window, enough for five uploaded views and five explicit refreshes. The existing requester grouping is by IP, not a subscription entitlement.
- Failed route requests release their own reservation exactly once, including missing provider configuration. An independent twenty-attempt ceiling prevents unlimited failure retries. Late releases cannot credit another window.
- Known provider-quota errors stop precision rescue rather than retrying an unfunded service. A 60-second process-local cooldown rejects repeated analysis requests before taking a scan slot. The browser also suppresses repeated requests for 60 seconds while allowing cached reports. These cooldowns are not a durable, distributed provider-health monitor.
- The existing error area distinguishes exhausted service credits from an application limit; limit errors include the remaining wait. No JSX, CSS, layout, models or precision thresholds changed.

## Validation and remaining requirement

Regression coverage includes failure refunds, duplicate release, old-window release, all five views plus refreshes, bounded repeated failure attempts and credential-scoped cooldown expiry. Builds and static checks do not demonstrate a funded live provider. No additional paid chart scans are needed to exercise these failure cases.

The provider account must still be funded for fresh scans. This release does not purchase credits, enable automatic recharge, change the Apple submission, or guarantee perpetual availability. Operator-controlled funding/recharge and monitoring remain necessary for an always-available paid service.
