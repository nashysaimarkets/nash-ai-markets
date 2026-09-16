# Pocket Bullseye development rollout

16 September 2026 · Implementation record for Chris Nash

The research recommendation was to connect the scan, its evidence and the later review while preserving the observatory design. This batch implements that journey. It does not introduce another paid analysis call when opening evidence or a ready timeframe.

## Implemented in this batch

| Recommendation | Delivered behavior |
|---|---|
| Source-chart evidence | A selected scanner level opens its own source screenshot. A marker appears only when that source has valid original geometry. Context evidence never borrows primary-chart coordinates. |
| Visual review | Original, later chart, changed evidence and lesson form four controllable steps. The actual screenshots retain their proportions. Completed comparisons are saved against the original decision. |
| Timeframe comparison | Ready reports show directional agreement or conflict and nearest verified boundaries. Unverified instrument/timeframe identity stays excluded from agreement. A ready row opens its cached report. |
| First-result journey | Direct actions open price levels, comparison and the notebook. Browser zoom is enabled. Existing motion controls and reduced-motion behavior remain available. |
| Personal notebook | Search and instrument/timeframe/review filters, personal lessons and tags, three pinned rules, and repeated AI-review tags with explicit limits. The previous arbitrary profile-completion percentage is removed. |
| Backup and restore | Export includes filtered saved decisions, source images, reviews, notes and saved rules. Import validates before offering a restore preview, preserves existing records, skips duplicates and keeps conflicting versions separately. Files remain customer-controlled and are not encrypted. |
| Focused acquisition | Published route candidates: `/pocket-bullseye/indices`, `/pocket-bullseye/forex`, `/pocket-bullseye/review`. Each has a specific problem, actual product description, fictional sample and own-chart action. |
| Measurement | Anonymous evidence/notebook/review counts and separate preparation, response and verification timing buckets for single-image and multiple-image scans. Admin reports show median/p90 bucket upper bounds, not exact percentiles. |
| Real-image baseline | 33 distinct, owner-supplied IG chart screenshots have a hash-checked pixel-measurement manifest and completed regression run. See the adjacent baseline report for its deliberately narrow scope. |

All stored chart and notebook content remains on the device unless the customer explicitly exports it or submits a chart to the existing analysis/review service. New activity events contain no screenshot, note, instrument, decision ID or persistent customer identifier. Existing measurement preferences remain in effect.

## Deployment and validation boundaries

The current Sites website uses Supabase project `pxlqvaddvghjjhenqmdh`. Its analytics migration was applied and checked with a rollback-only test: the 19,234 ms test event entered the 20,000 ms bucket, test events remained excluded from reporting, anonymous access remained disabled, and service-role execution remained enabled.

Automatic approval review rejected the matching migration on the separate production-linked Supabase project `opmgzchnmcgnsfwpmysc`. The stated reason was its persistent changes to production constraints and reporting functions and the wider operational impact. No alternate route was used. The exact proposed migration is `docs/pocket-experience-schema.sql`; it requires explicit approval before application to that separate project. Core notebook, source evidence and comparison features do not depend on these optional analytics writes. New analytics on the native-linked environment remain incomplete until that migration is approved and applied.

The 53 focused model, render, timeframe, review and activity tests and TypeScript check passed. The production build and Sites deployment are recorded in the publication result and PR. Browser visual QA was previously blocked by the managed preview environment; no completed physical-phone test or battery measurement is claimed.

Native changes belong to the existing draft PR #84, stacked on the customer-journey branch. Preserve native metadata, reviewed web revision pins, signing configuration and any Apple submission already in review. This batch does not itself constitute a native binary, submission or App Store release.

## Remaining work that requires evidence or access

| Work | Prepared now | Completion requirement |
|---|---|---|
| Full customer-scanner accuracy | Hash-checked 33-chart intake, source-role regression tests and explicit annotation rubric below | Human-labelled expected structure plus access to the actual customer scan path/provider; representative holdout images from other platforms and gold/oil are still missing. |
| Five first-use sessions | Ready-to-use task script and observation sheet in `pocket-usability-study.md` | Five consenting people unfamiliar with the app and observation of their actual attempts. No invented sessions or outcomes. |
| Phone responsiveness and motion | Existing offscreen/hidden-page/reduced-motion controls retained; zoom restriction removed | Ordinary and recent iPhones in Safari and the native build, including slow network, larger text and motion-off checks. |
| Acquisition experiment | Three focused pages and campaign attribution | Begin with the indices message; inspect qualified visits and successful scans. Low counts cannot establish a conversion winner. |
| App Store campaign | Copy and screenshot storyboard below | Capture the features from the Apple-available version, check current Apple state, then prepare the next appropriate release/campaign. |
| Unit economics | Calculation worksheet below | Actual subscription receipts, provider usage/invoices, retries and infrastructure costs for the same period. No price change is justified yet. |
| Production analytics | Concrete SQL migration and current-site verification | Approval for the separate production database migration described above. |

## Accuracy annotation and release gate

The existing `scripts/run-pocket-golden-regressions.ts` calls `generateSecondOpinion`. The current customer scanner uses `/api/pocket/analyse` with preparation, validation and recovery in the client. Those are different paths. Do not populate the old runner with pixel-extractor passes or advertise a full-scanner accuracy percentage from this run.

For each approved full-pipeline case, record the screenshot hash, platform, market, instrument contract (cash/CFD/future where visible), timeframe, scale type, source role, visible current price, axis anchors, required structural levels, allowed geometry tolerance, expected pattern evidence, absent indicators and expected abstention. A human annotator must establish these independently of the model output. Keep an unseen holdout separate from images used to tune extraction. Add context-pair cases that expose mismatched instruments and conflicting readings.

Run the actual customer flow against fixed, approved fixtures. Report wrong exact prices, missing required levels, unsupported extra levels, swapped source roles and unsupported affirmative claims separately. Repeat representative cases, and record preparation/provider/validation/first-result/all-ready times. Preserve the existing golden minimum and thresholds for the path they actually test; apply a separately labelled gate to the customer path after its annotations and adapter exist. Any new cross-platform accuracy claim remains blocked until that gate is measured.

## First acquisition experiment and App Store draft

Start with the indices page. Proposed message: **“Challenge your index setup. See the evidence.”** Supporting copy: “Inspect the structure in your chart, compare uploaded timeframes and return later to review what changed.” The destination offers the fictional sample before an own-chart upload.

Use aggregate campaign counts descriptively: introduction viewed → sample opened or chart uploaded → scan completed → evidence opened/review completed. Counts are not unique-person conversion, eligible-decision review rate or seven-day retention. Collect observed usability findings alongside them. Keep one message stable long enough to gather useful evidence; do not buy traffic or claim an A/B winner from the current small sample.

App Store custom-page draft, for a compatible approved version only:

1. “See the structure in your chart” — actual scanner, exact source label and snapshot context.
2. “Inspect the evidence” — original chart with a valid source marker; no invented prices.
3. “Understand conflicting timeframes” — real ready reports showing disagreement.
4. “Return with a later chart” — original/later review, without implying tick replay or actual fills.
5. “Keep your own lessons” — personal notebook and backup control.

Do not publish images of unreleased native features. This storyboard is ready for later version-matched capture, not a claim that App Store assets were changed.

## Monthly cost worksheet

Use one consistent month and currency. Enter actual net receipts after store fees, taxes/refunds where applicable; successful scan provider cost; unsuccessful/retried call cost; background timeframe cost; comparison/follow-up cost; hosting/storage/monitoring cost; and support cost. Avoid counting a call in two categories.

Contribution = net subscription receipts − all provider costs − infrastructure/support costs. Also report cost per completed scan and cost per paying customer, with the measured denominators and free-use cost shown separately. Populate from actual invoices and usage, not assumed model pricing. No subscription price or unlimited-use policy was changed in this batch.

## Deliberately later

Genuine market-triggered alerts and continuous historical replay require licensed data, instrument matching, stale-feed handling, server monitoring and a viable cost model. Snapshot review does not supply those capabilities. Keep these behind that dependency gate, as recommended in the research. Additional generic scanners, forecast candles and extra AI calls by default remain postponed.

The next structured-evidence change should replace prose-derived indicator badges with explicit validated observations. This batch preserves the prior conservative negation fix and does not silently change the AI response contract without a representative accuracy gate.
