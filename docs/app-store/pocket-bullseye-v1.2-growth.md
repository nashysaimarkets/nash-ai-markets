# Pocket Bullseye 1.2 — App Store growth package

Status: prepared on a separate branch. Do not create or submit the App Store 1.2 record until 1.1 has completed review.

## Version

- Marketing version: `1.2`
- Build number: `12`
- Bundle ID: `com.nashaimarkets.pocketbullseye`
- Subscription: Pocket Bullseye Monthly, unchanged at £4.99

## Search metadata

- Name: `Pocket Bullseye`
- Subtitle: `Support & Resistance Scanner`
- Primary category: `Finance`
- Secondary category: `Utilities`
- Keywords: `chart,analysis,trade setup,technical,patterns,risk,stocks,forex,indices,liquidity,candles,strategy`

The subtitle is 28/30 characters and the keywords are 98/100 characters. Terms present in the name, subtitle and primary category are not repeated in the keyword field.

## Promotional text

> Upload your chart and challenge the setup before risking your money. One complete analysis is free.

## Description opening

Challenge a trading setup before risking your money. Upload a clear chart screenshot and receive an evidence-first second opinion on visible structure, support, resistance, liquidity risk, patterns and conditional market scenarios.

## What's New

Pocket Bullseye 1.2 makes it easier to understand a chart before acting.

- A well-timed, system-controlled rating prompt may appear after two completed analyses
- Improved App Store presentation and clearer feature explanations
- Continued evidence-first safeguards: unverified prices and levels remain withheld

The rating request is never shown on the first free analysis, during an error, at the subscription screen, or during reanalysis and follow-up tools. Apple controls whether its standard prompt is displayed.

## Screenshot order

1. Scan the chart. Challenge the setup.
2. Rescan support + resistance
3. Spot visible stop-risk clusters
4. Switch the structure view
5. Set the cash limit first
6. Bull. Wait. Bear. Compare the paths.
7. No evidence. No made-up levels.

The first three assets are intentionally the strongest acquisition messages because they can appear directly in App Store search results. Every scanner visual depicts analysis of an uploaded chart screenshot, not a live market feed.

## Release guardrails

- Preserve native StoreKit subscription purchase and restore flows.
- Do not expose Stripe, web checkout or Founding Membership links inside the iOS app.
- Do not claim a price, level, pattern or liquidity zone is verified unless the existing trust gates support it.
- Do not reset the existing App Store rating when releasing 1.2.
- Keep automatic release after approval and immediate rollout unless the owner explicitly changes the release plan.
