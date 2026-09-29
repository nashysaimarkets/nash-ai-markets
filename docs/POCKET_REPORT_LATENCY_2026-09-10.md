# Slow second-chart report recovery

The 10 September runtime logs show all four background chart requests starting together. Three reports completed in 53–59 seconds. The slow report already had both precision receipts, but continued streaming until its 105-second deadline and completed only after sequential recovery, at 145 seconds.

Fast reports now start their single permitted recovery attempt at 60 seconds if no complete report has arrived. The original remains eligible to finish. The first complete, schema-validated report wins and cancels the other attempt. Earlier retryable failures still recover immediately; cancellation, quota, authentication and filtering failures do not start further requests. The existing total deadline and two-attempt maximum remain enforced. This reduces the serial delay; it does not guarantee a provider completion time.

Authenticated, usable measurements for the exact primary/context image bytes are also supplied to the report so it need not re-estimate already verified numbers. Measurements remain tied to their image role. Full image inputs, multi-timeframe pattern assessment, precision gates and medium reasoning remain required for both attempts. Unusable or unauthenticated receipts cannot guide the report.

Regression coverage includes a continuously streaming slow original, a healthy report that needs no recovery, either attempt winning and cancelling its sibling, early retryable failure, incomplete output, quota, user cancellation, and measurement role/geometry validation. All 1,020 unit tests pass locally. An overlapping recovery can incur some additional provider work for reports exceeding 60 seconds; ordinary completed reports still use one report attempt.
