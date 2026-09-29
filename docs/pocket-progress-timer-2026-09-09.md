# Preserve reports that are still progressing

The latest four-chart customer scans completed in approximately 43, 49 and 57 seconds on the server. Another took 126 seconds after a 75-second initial timeout and standard-tier recovery. Precision completed in 14–17 seconds, or under one second when reused. Full report reasoning and output dominate latency.

The previous timer could discard a still-progressing streamed report at 75 seconds. Earlier logs recorded only first output, so they do not prove that the observed 126-second run was actively progressing when cancelled.

Only nonempty report-text deltas now refresh a 15-second output-idle window. The first attempt may use up to 30 seconds of the existing total report budget while genuinely producing output; it cannot extend the overall deadline. A stream that never produces output retains its original first-attempt timeout. A stalled stream still recovers. Recovery duration is capped by the remaining existing budget. User cancellation and provider-quota handling are unchanged. The SDK transport timeout matches the hard limit so it cannot secretly cancel an allowed extension.

No models, reasoning settings, prompts, report schema, image inputs, price calibration, precision checks, background scans or UI changed. Regression tests use a controlled clock to demonstrate that a report finishing after the soft deadline uses one request, a stalled report still recovers, and continuous output cannot exceed the total deadline. No additional paid chart scans are needed to test timer behavior.

This avoids needless restarts; it does not accelerate normal model generation or establish a new live latency benchmark. A larger speed gain needs a separate evaluated design: validated per-chart evidence reused across report sections, less repeated prose generation, and checks focused on uncertain findings. Faster report models require quality evaluation before adoption.
