# Pocket Bullseye launch-polish status

## Scope

Owner-only staging/preview work for Pocket Bullseye. Production remains untouched.

## Preview deployment (verified 2026-08-20)

Use the **PR #41 branch preview**, not `release/bullseye-launch-candidate`:

| Target | Branch | Commit | Preview URL |
|---|---|---|---|
| Pocket Bullseye (correct) | `checkpoint/pocket-bullseye-2026-08-19-launch-polish` / `fix/pocket-bullseye-preview-sync-2026-08-20` | `758b8c9`+ | `https://nash-ai-markets-git-checkpoint-pocket-bu-5358d9-nash-ai-markets.vercel.app/pocket` |
| Bullseye launch candidate (wrong for Pocket polish) | `release/bullseye-launch-candidate` | `b3c4109` | imports only `pocket.css` — no launch-polish layers |

Acceptance check: page source must include `data-pocket-build="v3.1"` and deployed CSS must contain `V3.1 · PRIVATE BETA`.

## Root cause of old preview

1. **`release/bullseye-launch-candidate` never received the launch-polish commits.** Its `app/pocket/page.tsx` imports only `./pocket.css`, so Vercel previews from that branch render the pre-polish terminal theme.
2. **Transient unwired v3 commit (`83e7712`).** `pocket-launch-v3.css` was added one commit before `page.tsx` imported it (`78a040d`); a preview built at `83e7712` would ship v3 assets without loading them.
3. **Subtle v3 polish before `758b8c9`.** Earlier v3 CSS layered on top of the professional theme but did not override `pocket.css` rules such as `.psScanLine{display:none}`, so mobile previews could still look like the older build.

## Quality gate

The latest launch-polish commit had all application checks passing through safeguards; the only blocker was operations-documentation validation for `OPENAI_POCKET_MODEL`.

A dedicated operations reference has now been added at `docs/OPENAI_POCKET_MODEL.md`. Rerun the full quality gate after this commit. Do not treat this document addition as evidence that the gate is green until the workflow completes successfully.

## Release boundary

- Keep PR #41 draft.
- Do not merge to `main`.
- Do not deploy the launch-polish branch to the production target.
- Obtain a verified preview deployment before visual acceptance.

## Design direction

The current polish focuses on restrained 3D depth, premium layered surfaces, mobile-first hierarchy, immersive chart presentation, tactile controls, clean annotations, sticky result actions, safe-area handling, landscape behaviour, reduced-motion support, and removal of unnecessary visual chrome.

## Data conservation

Prefer CSS and existing assets. Avoid new network requests, fonts, image assets, or market-data dependencies unless they materially improve the product and are explicitly justified.
