# Bullseye Second Opinion — private pilot controls

Status: **private staging only / public launch disabled**

## Product boundary

- The member supplies a chart screenshot. Auto-Read extracts legible market, timeframe, platform, price, labelled plan levels and indicators; all plan fields remain optional and editable.
- Bullseye returns balanced educational observations, a deterministic reward/risk calculation, a no-trade checklist and uncertainty warnings.
- It never connects to a broker, executes an order, redistributes a live feed or issues a BUY/SELL instruction.
- Public marketing, paid access and general availability remain blocked pending privacy and UK financial-promotion review.

## Privacy boundary

- JPEG, PNG and WebP only; maximum decoded image size 1 MB.
- The member must confirm that names, balances, account identifiers and notifications were removed.
- The request is same-origin and authenticated.
- The screenshot is held only in request memory, is sent with `store: false`, is not written to Bullseye storage and is never attached to a journal entry.
- A journal entry contains text only and is created only after a separate member action.
- Provider-side security retention must be confirmed against the contracted AI-provider data terms before public launch.

## Cost boundary

- Cost-free deterministic plan and discipline checks remain available while screenshot interpretation is disabled.
- AI screenshot interpretation is disabled unless `SECOND_OPINION_PRIVATE_PILOT=enabled`.
- Maximum request body: 1.45 MB; decoded image: 1 MB; low-detail image analysis; maximum response: 1,100 tokens.
- Pilot runtime ceiling: three accepted requests per authenticated user per UTC day and twenty total accepted requests per runtime per UTC day.
- The runtime limiter is suitable only for an owner-only pilot. A durable cross-instance usage ledger and provider-side project budget are mandatory before widening access.
- Failed provider responses consume the local allowance so repeated retries cannot form an accidental spend loop.

## Safety boundary

- Structured JSON schema and server validation are mandatory.
- Invalid or unavailable AI output fails closed and is withheld.
- Exact levels may be repeated when the member supplied them or when an exact label is visibly legible. Pixel-position estimates are prohibited; uncertain values remain null and require confirmation.
- Both bullish and bearish cases, reasons not to trade and uncertainty are always required.
- Screenshot interpretation is never treated as verified live market data and never enters the existing ES/VIX decision engine.

## Promotion gate

Do not describe this pilot as an adviser, signal, prediction, trade validator or accuracy product. Obtain documented privacy, processor and UK financial-promotion review before any public or paid launch.
