# Media Briefing Architecture

How pre-market and post-market video briefings are sourced, validated, placed and
displayed — and, more importantly, what is deliberately *not* built.

## Current implementation phase

**Phase A — media-ready interface, operator-published.**

The product renders complete, honest video surfaces. It does not generate video, does not
call a media provider, and does not depend on either. Publishing is a manual operator
action: adding a validated record to a JSON manifest.

| Phase | Description | Status |
|---|---|---|
| A | Media-ready interface with honest unavailable states | **Implemented** |
| B | Server-only script-generation boundary | Not built |
| C | Provider adapter architecture | Not built — no adapter, no interface |
| D | Accessible media player | **Implemented** (click-to-load YouTube embed) |
| E | Branded code-generated covers | Not built — YouTube thumbnails used |

The manifest at `app/content/published-market-videos.json` currently contains
`"videos": []`. Every video surface in the product is therefore rendering its
unavailable state, by design, and the written brief carries the full experience.

---

## Data flow

```
app/content/published-market-videos.json   (operator-maintained, schemaVersion 1)
        │
        ▼
load-published.ts     readFileSync + JSON.parse inside try/catch
        │             60s request-scoped cache; on any failure returns { videos: [] }
        ▼
validate.ts           normalizeMarketVideoRecord() — per-record allowlist validation
        │             invalid records are dropped, never partially rendered
        ▼
select.ts             picks the record for a given type + market date
        │
        ▼
session-placement.ts  resolveSessionMarketVideos({ phase, now })
        │             maps session phase to slots: dashboard, brief primary,
        │             brief earlier, post-market pending notice, archive
        ▼
DashboardMarketVideoCard · MorningMarketBrief · MarketVideoArchive
        │
        ▼
MarketVideoPlayer     click-to-load iframe, no autoplay
```

## Validation boundary

`normalizeMarketVideoRecord` is the single trust boundary between operator input and
customer display. A record is rejected outright — not repaired — unless:

- `youtubeVideoId` matches `^[A-Za-z0-9_-]{11}$`
- `type` is exactly `PRE_MARKET` or `POST_MARKET`
- `marketDate` matches `^\d{4}-\d{2}-\d{2}$` (America/New_York calendar day)
- `status` is one of `published`, `scheduled`, `unavailable`

URLs are **derived, never accepted from input**:

| Derived | Value |
|---|---|
| Embed | `https://www.youtube-nocookie.com/embed/<id>?rel=0&modestbranding=1` |
| Watch | `https://www.youtube.com/watch?v=<id>` |
| Thumbnail | `https://i.ytimg.com/vi/<id>/hqdefault.jpg` |

Because every URL is constructed from an already-validated 11-character ID, a malicious or
malformed manifest entry cannot inject an arbitrary URL into an iframe `src`. This is the
most important property of the design and must survive any future refactor.

## Publishing states

| State | Customer-facing behaviour |
|---|---|
| Not published | "Today's video brief has not been published yet." Written brief remains primary. |
| Scheduled | Treated as not published. Never shown as available. |
| Published | Poster with title, duration and summary; player loads on click. |
| Unavailable | Explicit unavailable state. No empty player, no black rectangle. |
| Manifest unreadable | Logged server-side; treated as zero videos. Routes render normally. |

## Failure handling

The controlling rule: **video failure cannot damage the written experience.**

- The manifest read is wrapped in `try/catch`. Any failure logs and returns `{ videos: [] }`.
- No member route awaits a media provider. There is no provider to await.
- No generation work runs inside a customer page request.
- Invalid records are dropped individually, so one bad row cannot blank the archive.
- The player is click-to-load, so a YouTube outage costs nothing until a customer opts in.

## Security considerations

- **No credentials in this path.** The manifest is a static file in the repository. There
  is no API key, no OAuth token and no service account involved in rendering video.
- `app/api/youtube/oauth/callback` exists for a future operator-side pipeline and is not
  part of the customer render path. It is currently unconfigured.
- Embeds use `youtube-nocookie.com`, so no YouTube cookie is set until playback starts.
- No autoplay, so no unexpected audio and no bandwidth cost on page load.
- The iframe mounts only after explicit interaction, which also keeps YouTube's player
  JavaScript out of the initial page weight.

## What remains unconfigured

1. **Script generation (Phase B).** No typed server-only interface exists to turn a
   verified brief into a spoken script. If built, it must summarise only data already
   present in the brief and introduce no new market facts.
2. **Provider adapter (Phase C).** No adapter and no interface. Deliberate: the
   instruction was not to invent a provider or add paid dependencies without necessity.
3. **Branded covers (Phase E).** Covers are YouTube thumbnails. Code-generated branded
   covers using market-state data are not built.
4. **Transcripts and chapters.** The record type has no transcript or chapter fields.
   Adding them is a schema change plus a validation change, both inside the boundary above.

## Rules for extending this

- Keep generation out of the request path. If a pipeline is added, it publishes to the
  manifest; member routes keep reading only the manifest.
- Keep URL derivation inside `validate.ts`. Never accept a URL from the manifest.
- Never auto-publish unvalidated AI output.
- Never imply content is live when it is delayed. The existing surfaces state the market
  date explicitly and should continue to.
