# Automatic preparation of uploaded timeframes

The owner requested that other uploaded charts start analysing after the main result opens, so customers can switch without starting a new scan on each first selection.

The current result starts a bounded queue for every remaining upload. Each request keeps all original screenshots, promotes its selected source to primary, and uses the existing complete analysis and precision pipeline. One pack runs at a time to bound phone canvas memory and provider load. The customer can read the main report throughout preparation.

Selecting a running chart shares its promise. Selecting another chart prioritises it after the active pack. Returning to a ready report does not abort paid work. Late completion is cached without changing the current selection. State updates merge results that completed during a pending selection, and a five-entry queue cache closes the race between completion and a new click. New sessions and evidence corrections invalidate old work and cache entries.

The selector shows waiting, queued, analysing, ready or retry states. Automatic preparation requires an entitled native Apple session, never consumes the free Apple scan or opens a paywall, pauses before starting more work in hidden pages, and respects response allowance and retry headers. Failed charts require a customer retry; background failures do not replace the visible report. Preparing all uploads can use more AI credits than viewing only the main result.

Validation exercises the actual preparation, request and selection handlers with controlled provider responses: all four supporting reports complete without selection; all five views then switch repeatedly without extra scans; simultaneous selection shares a request; switching preserves active and completed reports; failures, entitlement expiry, service allowance, hidden pages, resets and corrections are covered. Rendering checks cover background statuses and enabled ready buttons. TypeScript passes. These are orchestration and regression checks, not new live-provider speed or chart-accuracy measurements.

The native Apple shell is pinned to an immutable Vercel deployment. Publishing the Sites web version does not update an already installed Apple build; the native source and release pin require a separate build.
