# Pocket timeframe evidence strip — 14 September 2026

The result header now compares the actual uploaded screenshots side by side. Each card shows its own verified timeframe, thumbnail, report readiness, directional interpretation, structure and momentum. Selecting a card uses the existing shared chart-selection handler. Compact selectors beside the individual analysis sections remain available.

The strip adds no provider calls, polling, image processing, extra scanner or storage. It reads the completed reports and real preparation phases already held by the chart session. The active card receives the current analysis so subsequent corrections are reflected immediately. Source-image ownership is checked before a cached report is displayed. Unknown timeframes use numbered chart labels; upload slots never imply 5m, 30m, 1h or 4h.

Agreement is explicitly a comparison of report trends, not a confirmation of a trade or a claim that every indicator agrees. It requires readable candles, high-confidence instrument/timeframe identification, a matching instrument and no contradictory known tickers. Different markets, unknown evidence and neutral/mixed readings remain distinct. Structure and momentum keep the original wording; Full wording reveals text clipped in the compact view.

The comparison scrolls with the page instead of covering the source chart with a tall sticky panel. Existing scanner models, prompts, budgets, background scheduling, price precision gates, subscriptions, saved decisions and release pins are unchanged.

## Verification

- 29 focused evidence, render and existing chart-session tests passed in both source trees; the 11 new evidence/render cases were rerun after final wording changes.
- 44 existing background-preparation, decision-engine and launch-hardening tests passed in the website tree. They include in-flight deduplication, late completion after navigation, source replacement, native entitlement and allowance safeguards.
- TypeScript passed in both source trees. The initial production artifact and rendered-artifact check passed; final source receives a fresh build before publication.
- Browser checks used the actual new component with clearly fictional chart reports, including 375px, 430px, 1024px and 200% text. Ready-chart selection during loading, agreement changes, keyboard activation of Full wording, and phase transitions worked. No page-width overflow or overflowing card labels was measured. The temporary QA pages are removed before packaging.
- Full-app browser end-to-end testing was unavailable: the local /pocket route showed the existing safe-recovery screen with a Network connection lost error before results loaded. This is recorded separately from the isolated component tests. No physical-iPhone test or new paid AI scan is claimed.

## iPhone release handling

Native changes are based on ci/pocket-submit-staged-1.2.11 at 3d3a153cca6e2df5b1dfa387754ee741ee3318c4 and prepared on feat/pocket-timeframe-evidence-strip-2026-09-14 for the next routine batch. No Apple submission, signing setting, version, immutable release pin or pending release workflow is changed. Follow docs/app-store/RELEASE_POLICY.md and verify actual Apple state before the next App Store publishing run.
