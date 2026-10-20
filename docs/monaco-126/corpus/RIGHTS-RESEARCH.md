# Source rights investigation — 20 October 2026

Scope: Pocket Bullseye internal six-case acceptance, chart rendering and a future AI processor acting solely for the owner. This is primary-source research plus separate automated advisory review, not a signed legal opinion, provider agreement or human annotation approval. No outreach was sent.

| Source | Internal rendering | AI-provider processing | Decision |
|---|---|---|---|
| [FirstRate Data licence](https://firstratedata.com/about/license), [FAQ](https://firstratedata.com/about/FAQ), [free samples](https://firstratedata.com/free-intraday-data) | Express visualization/derivative grant. Licence defines subscriber as any downloader through its website links. | Clauses (i)–(ii) expressly allow service providers to access, use, copy and host on the subscriber's behalf; the FAQ expressly permits AI modelling. The inference that this covers an AI API is conditional on its actual processor-only use, not an AI-vendor-specific endorsement. | No-cost source acquired for offline preparation. Final executor/data-use scope still requires review; no raw-data publication. |
| [GetData documentation](https://www.getdata.finance/documentation), [data sources](https://getdata.finance/data-sources), [sample repository](https://github.com/getdata-finance/spx500-1m-ohlcv-index-historical-data/tree/c569c1275c2295a1566788476ef99500271a60fe) | Original repository carries MIT software wording, while the official documentation describes a personal data licence and private research/derived outputs. | An explicit applicable grant for the recovered data and selected AI processor was not established. Upstream FXCM/Capital.com CFD mid-quote source differs from cash SPX or exchange ES. | Three originals preserved exactly, still rights-HOLD. Direct website reads failed (530 research/403 download); indexed official text is lower-confidence evidence, not a permission grant. |
| [Binance Vision terms](https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md) | Free licence is noncommercial and applies to derived charts as well. | Commercial use requires a separate written enterprise licence. | Excluded for this commercial-product acceptance. No data downloaded. |
| [CryptoDataDownload](https://www.cryptodatadownload.com/data/) | Separate automated research found noncommercial free-tier language; the root read did not reproduce that clause. | Not verified. | Not selected; do not rely on an uncorroborated automated finding. No data downloaded. |

FirstRate's grant is perpetual and has no stated retention deadline in the examined text. Use must stay on the subscriber's behalf; a provider's unrelated training/reuse is outside this assumed scope. The formal licence requests attribution for published analysis despite softer FAQ wording, so retain attribution. The private packet includes the source ZIP for owner use, not public GitHub distribution. No subscription, account, API key, payment or purchase was required.

## Frozen source evidence

Downloaded once from the official page's SPY sample link:
`https://frd001.s3.us-east-2.amazonaws.com/frd_sample_etf_SPY.zip`

- ZIP: 166,501 bytes; SHA256 `f6031429ed0903be2a580be29529c37b6b017164d8b118c8d6267d2706148073`.
- Raw licence-page snapshot SHA256 `1d26752ee925a447b9aa68d7736dd3d7687e2830256a7d184d1ed26b31b923cb`; FAQ `a3b757eeea426e4fbd0aa6c5338a7a9ff2dc145e269ca6831f758a0dfeb4f69c`; sample page `0f29613f2056d6dbe0611ee199340be36240d3a055a9b787410551820e76f08c`. Full research snapshots remain private; URLs and scoped findings are the review evidence. Hashes attest retrieved bytes, not legal acceptance or historical versions.
- The downloaded CSV **has a header**, and actual intraday coverage is **5–19 October 2026**, 9,728 one-minute observations. The indexed page advertised 21 September–2 October and no header. The importer reads actual bytes; it does not assume either summary.
- ZIP README identifies split-adjusted SPY ETF prices in USD, share volume and US Eastern bar-start timestamps. Missing zero-volume minutes are omitted. No invented gap filling, price scaling, instrument relabelling or timestep substitution.

## Existing originals

The current Library manifest `monaco-real-market-manifest.json` was read at lines10–659,11362–12011,19349–19998, recovering the source identity, provisional reference features and calibration for the three matching cases. Its original source commit is `c569c1275c2295a1566788476ef99500271a60fe`. The ZIP helper was unavailable (HTTP403 tools/list), so no repeated download loop was used; chart bytes came from the previously verified existing scanner-input files. All three original/input hashes match their unchanged pins. Recovery establishes integrity, not rights or ground truth.

A no-cost alternative to seeking GetData permission is selecting replacement licensed range30m/double-top1h/H&S4h charts. The small SPY sample reviewed here did not establish a defensible4hH&S replacement, so none was invented or relabelled. A rights holder's clarification for the existing originals remains the shortest concrete route for those exact cases; the prepared request is in REVIEW-AND-RUN-GATES.md.
