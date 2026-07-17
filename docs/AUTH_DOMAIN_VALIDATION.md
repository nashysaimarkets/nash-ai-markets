# Authentication and Domain Validation

The application uses Supabase passwordless email and constructs
`emailRedirectTo` from the browser’s current origin:

`https://<host>/auth/callback?next=/dashboard`

The callback exchanges the one-time code for a cookie session. The `next`
parameter accepts only a single-origin path beginning with `/` and rejects
protocol-relative `//` paths.

## Domain configuration

Configure separate projects or strictly separate Auth settings for staging and
production.

| Setting | Staging | Production |
|---|---|---|
| Supabase Site URL | Exact HTTPS staging origin | Exact HTTPS production origin |
| Redirect URL | `https://<staging-host>/auth/callback` | `https://<production-host>/auth/callback` |
| Hosting variables | Staging Supabase URL/key | Production Supabase URL/key |
| Email sender/template | Staging-approved test sender | Approved production sender/domain |

Do not add broad wildcard redirect URLs unless the security owner explicitly
accepts the risk. Do not allow staging callbacks in the production Supabase
project or production callbacks in staging.

## Supabase Dashboard steps

1. Open Supabase Dashboard and select the intended environment project.
2. Open **Authentication → URL Configuration**.
3. Set **Site URL** to the exact HTTPS origin with no path.
4. Add the exact `/auth/callback` URL under allowed redirect URLs.
5. Remove obsolete localhost, preview and cross-environment URLs before public
   launch; retain localhost only in a separate development project if needed.
6. Open **Authentication → Email Templates** and verify the magic-link template
   uses Supabase’s generated confirmation URL rather than a hand-built token.
7. Verify sender-domain configuration through the selected email service.
8. Record setting names and sanitized screenshots only.

## Validation matrix

| Action | Expected result |
|---|---|
| Request link for a new staging email | Generic success; no account enumeration or provider detail |
| Open link once in same browser | Code exchange succeeds and redirects to `/dashboard` |
| Navigate dashboard → brief → terminal → profile | Session persists securely |
| Open a protected route signed out | Redirect to `/login` |
| Reuse the consumed link | Safe sign-in failure; no session created |
| Open an expired link | Safe sign-in failure; no raw Supabase error |
| Alter `next` to an external URL or `//host` | Callback uses `/dashboard`; no open redirect |
| Sign out using `/auth/signout` | Session ends and browser returns to `/` |
| Revisit protected route after sign-out | Redirect to `/login` |
| Use staging link on production origin | Rejected by project/redirect separation |
| Use production link on staging origin | Rejected by project/redirect separation |
| Install PWA, sign in, close, reopen | Session persists according to Supabase cookie policy |
| Sign out in installed PWA | Installed app loses protected access |

Also verify expiry duration, one-time-link behavior, session duration and cookie
attributes in the chosen Supabase plan/settings. The repository does not define
those external values.

## Failure handling

- Delivery failure must show the existing friendly retry message.
- Callback exchange failure redirects to `/login?error=signin`.
- Never ask a user to forward a live magic link.
- Never record tokens, codes, full links, cookies or member emails.
- During a Supabase outage, preserve fail-closed access; do not grant a tier
  from client state.

