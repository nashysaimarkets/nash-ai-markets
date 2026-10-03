# Scanner chart visibility — 3 October 2026

User reported no chart in Pattern Watch/Liquidity Guard and supplied screenshots. Pattern Watch showed a VIEW MY CHART navigation card; Liquidity Guard actually displayed the original below lengthy withheld candidate details.

Implementation 6bc763df9228040b9ceda1080488f2c094679f28 mounts the existing pixel-checked ChartXRay directly inside Pattern Watch using the selected sourceAnalysis, sourceImage and primaryLevels. Liquidity Guard now places its original image before candidate detail articles. Identity, axis, candle and confidence thresholds are unchanged. No new AI request is needed to open the chart.

Passed: 25 component-render checks, seven pattern unit checks, TypeScript, verified vinext build and one rendered HTML check. Regression checks require Pattern Watch's source image even with zero drawable patterns and the liquidity image before withheld candidate details.

READY implementation preview: https://nash-ai-markets-agi98idyi-nash-ai-markets.vercel.app/pocket (dpl_FryrRs5ZxwokMdNrzC4umgJbiKPm). Browser fictional sample verified the inline pattern image loaded at original 640x480 with nonzero displayed dimensions. Switching 5M to 4H updated the inline source label. Liquidity Guard's selected 4H image also loaded at 640x480 with nonzero displayed dimensions. No additional paid AI scan was performed; no positive drawing or oil-chart accuracy claim is made.

Preview-only. Existing production and Apple pins remain unchanged. Prior release holds for independent accuracy validation, positive precise drawings and native device testing persist. This task fixes chart visibility, not the withheld MEDIUM-confidence oil-chart overlays. Git transport lacked credentials; changes were saved atomically through the connected GitHub API, with blob hashes matching local tested files.
