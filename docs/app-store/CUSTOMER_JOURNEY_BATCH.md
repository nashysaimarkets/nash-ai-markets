# Customer journey batch — 15 September 2026

Prepared from `ci/pocket-submit-staged-1.2.11`, the validated 1.2.11 release lineage. The subsequently rejected timeframe comparison strip is not included.

This batch provides a direct subscription button after the first free analysis, prevents duplicate purchase taps, adds anonymous daily activity reporting and its opt-out, and allows the fictional sample to open without waiting for live calendar providers. The existing chart layout, analysis engine, StoreKit entitlements, price and reviewed release pin are preserved.

The public Sites introduction is published separately. Its aggregate database migration was applied to the existing Sites runtime project. The corresponding GitHub/Vercel deployment must have its actual Supabase project verified and the same named migration applied there before its activity report can be treated as available. Reports are local to their configured database; do not assume web and native totals have been merged.

Before a native publishing run: read RELEASE_POLICY.md; check Apple's actual version/build/review state; complete the existing type, unit, security, build and release-pin gates; verify purchase, cancellation, restore, free-use consumption and opt-out on an iPhone/TestFlight build; and reconcile App Store privacy disclosures with the anonymous usage totals. Do not call an in-app purchase event an independently verified paid customer.

No new version number, immutable deployment pin, native build or Apple submission is created by this preparation branch. Batch these routine changes with the next reviewed iPhone release. Never replace a submission in review to include them.
