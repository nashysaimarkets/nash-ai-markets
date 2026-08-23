# Project Bullseye platform audit

QA-only Playwright audit for public and authenticated member routes.

## Safety

- Credentials come only from environment variables (`AUDIT_USER_EMAIL`, `AUDIT_USER_PASSWORD`).
- Never commit `audit-output/`, storage state, or zip contents with secrets.
- The product UI is passwordless OTP; automation uses a **dedicated test account** password grant against Supabase, then completes session through `/auth/callback` hash handling. Do not use a real customer account.

## Setup

```bash
cp audit/.env.example audit/.env.local   # optional local overrides
# export AUDIT_BASE_URL=...
# export AUDIT_USER_EMAIL=...
# export AUDIT_USER_PASSWORD=...
npx playwright install chromium
npm run audit:setup
```

## Commands

| Script | Purpose |
|--------|---------|
| `npm run audit:setup` | Authenticate and save gitignored storage state |
| `npm run audit:public` | Public routes only |
| `npm run audit:desktop` | Desktop viewports |
| `npm run audit:mobile` | Tablet + mobile viewports |
| `npm run audit:all` | Full audit + HTML/MD/JSON + zip |

### Focused re-audit (video / visual layer)

To save time after video/visual changes only:

```bash
AUDIT_FOCUS=video npm run audit:all
```

This audits `/dashboard`, `/brief`, `/terminal`, and `/reviews` across all viewports (member auth required).
You can also pass a comma list: `AUDIT_FOCUS=/dashboard,/brief,/reviews`.

## Outputs

- `audit-output/project-bullseye-audit.html`
- `audit-output/project-bullseye-audit.md`
- `audit-output/project-bullseye-audit.json`
- `audit-output/screenshots/**`
- `audit-output/logs/*-sanitized.log`
- `project-bullseye-audit.zip` (excludes `.auth` storage state)
