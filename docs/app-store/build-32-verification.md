# Pocket Bullseye build 32 verification

- Version: 1.2.9 (32).
- Final web revision: `df10746c8b62d3e4c7b39327b1d6007008964716`.
- Immutable deployment: `dpl_3TZzS8QprqpBqB34ivH5r59PVRS4`.
- Server URL: https://nash-ai-markets-oplv0wort-nash-ai-markets.vercel.app/pocket
- Sites version 151 deployed successfully on 10 September 2026 from `c979e9ccb76c30b9903d95db98365dd8d232095e`.

The final source passed 1,033 unit tests, TypeScript and the production build. Native TypeScript and 23 targeted regression tests also passed. The legacy-cancellation test omits modern signal methods and abort reasons; two additional tests leave response bodies permanently unfinished.

A second live-provider acceptance run uploaded the five fictional fixtures through the normal UI. The main request started at 19:01:25 UTC and completed in 53.1 seconds. The four background requests started at 19:02:21 UTC and completed in 43.6, 45.6, 46.6 and 52.9 seconds. The full server flow therefore completed in about 109 seconds. All five endpoints returned HTTP 200. Each timeframe was selected, including a repeat selection, and the final runtime count remained five requests.

The earlier live run also completed all five reports while exercising slow-provider recovery, in approximately 206 seconds. These are two fixture runs, not a representative accuracy benchmark or latency guarantee. Physical-iPhone behaviour and app termination/reopening have not been verified. The update keeps models, precision gates and report layout intact.

Apple packaging and submission status must be recorded after the new build completes. This record alone does not establish upload, submission or approval.
