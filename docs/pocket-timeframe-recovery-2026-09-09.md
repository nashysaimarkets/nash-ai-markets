# Timeframe report timeout repair

The reported selected-timeframe failure on deployment e186aae followed a successful four-image report. Signed primary/context extraction completed in 61 ms. The report then hit its 110-second first-attempt timer and 95-second recovery timer; the SDK returned a generic aborted error, which became provider_unavailable. No provider response usage was available for these timed-out calls.

Changes: use the installed SDK Responses stream and wait for a completed full structured response before rendering; keep store=false, all uploaded images, the same model, schema and precision gates. Record only first stream/output timings, never chart text. A fast-profile request gets 75 seconds initially; a bounded recovery explicitly uses the default tier (35 seconds for one image, 90 seconds for multiple images). This is a scheduling fallback within the same provider, not a separate provider or guaranteed capacity. Recovery retains the existing low reasoning setting. Baseline profiles retain their existing budgets.

Normalize timer exhaustion as a typed report timeout even when the SDK returns a generic aborted error. Quota/auth/rate-limit errors and user cancellation still do not trigger recovery.

Ready timeframe buttons remain available during a pending switch. Returning to a ready report cancels the pending work; a selection revision prevents late results or errors from replacing the chosen report. Switching to a ready report clears the old error. Button behavior changed; presentation, structure, styling and cinematic layout are preserved.

Regression checks cover all five source selections, cached returns, failure preservation, cancellation/late results, exhausted timers, default-tier recovery, and the installed SDK's actual streaming parser for completed/incomplete strict reports. Only complete validated JSON becomes an analysis. No extra automatic background scans, pricing changes or Apple submission changes.

A funded provider and wider production observation remain necessary. This repair addresses the observed failure paths; it does not claim permanent external-provider availability or independently proven chart accuracy.
