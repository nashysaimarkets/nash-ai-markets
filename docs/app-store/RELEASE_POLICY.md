# Pocket Bullseye release policy

Confirmed by Chris on 12 September 2026: “Okay… always do this from now on”. This follows the recommendation to preserve Apple submissions already in review, automate releases, and separate compatible backend maintenance from iPhone releases.

## Default release procedure

1. Check the actual App Store Connect version, selected build and review state before starting an App Store publishing run. Use the existing read-only `pocket-apple-release-status` workflow or connected App Store access. A repository release pin is not evidence of Apple's current state.
2. Preserve a submission that is waiting for review, in review or pending release. Continue preparing and testing routine improvements, then submit the next batch after that release completes. Do not withdraw a queued build merely to include more minor changes.
3. Keep `submit_to_app_store: true`, `cancel_previous_submissions: false` and `release_type: AFTER_APPROVAL` in the release branch's `codemagic.yaml`. These defaults apply to new runs using this configuration; they do not change runs already started from an older revision.
4. Disabling cancellation does not create a deferred submission queue. If a publishing run cannot submit because another version is under review, preserve the existing submission and report the new build's actual state. Do not retry in a loop or turn cancellation back on to make the run succeed.
5. Keep the existing release checks, verified revision pin, signing, screenshots, working review credentials and accurate review notes. Confirm processing, submission and release separately; an uploaded build is not proof of submission or availability.
6. Consider an expedited review request for a documented critical bug or qualifying associated event. Include accurate reproduction steps or event details. Do not promise a faster review time or use routine enhancements as an emergency justification.

A later explicit instruction to replace a particular submission can override the preservation default. A critical defect in the queued candidate also requires assessing whether it is fit to release; do not knowingly ship a broken candidate merely to preserve its queue position. Record the reason for any exception and retain the default for subsequent releases.

## Backend maintenance direction

Prefer independently deployable backend bug fixes and performance improvements that remain compatible with the installed app's reviewed functionality. Preserve authentication, entitlements, request/response compatibility, measured analysis accuracy and rollback capability.

The current Capacitor client is pinned to an immutable verified web deployment. This policy change does **not** implement an independent backend or make the pinned deployment mutable. Establish and verify a separate stable API contract and any required client migration before claiming backend updates can reach installed users independently. That client migration may itself require an App Store release.

Retain the reviewed client revision pin. Route native changes and new app functionality through the appropriate Apple review process; do not use remote code changes to evade review.

## References

- [Apple: App Review and expedited review](https://developer.apple.com/distribute/app-review/)
- [Apple: removing a submission restarts review on resubmission](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/remove-a-submission-from-review/)
- [Apple: software requirements](https://developer.apple.com/app-store/review/guidelines/#software-requirements)
- [Codemagic: App Store publishing configuration](https://docs.codemagic.io/yaml-publishing/app-store-connect/)
