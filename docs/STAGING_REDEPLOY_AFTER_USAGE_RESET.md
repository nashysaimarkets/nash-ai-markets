# Staging Redeploy After ChatGPT Work Usage Reset

Use this only for the **Bullseye staging Site**.  
Do **not** use these steps for production.

**Blocked until:** ChatGPT Work usage resets — **8 August 2026, 23:42** (local owner clock / as reported).  
After the reset, complete this pack once.

---

## Staging URL

`https://nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site`

Sites project id (for matching the right Site): `appgprj_6a6efa569218819185b3eefd3c508e66`

---

## Why this redeploy is needed

- Sites **Settings** already use Supabase project **`pxlqvaddvghjjhenqmdh`**.
- The **live browser bundle** still contains **`opmgzchnmcgnsfwpmysc`**.
- The app correctly blocks magic links when those disagree.
- A local rebuild already proved the login chunk becomes correct when built with the `pxlqv` URL.
- No Stripe, Supabase data, or production change is required for this fix — only a **staging rebuild + deploy**.

---

## Safety restrictions

Do **not**:

- Touch production Sites or production URLs  
- Change environment variable **values** (they are already correct)  
- Change Stripe products, prices, webhooks, or portal settings  
- Change Supabase projects, data, policies, or migrations  
- Remove or weaken the authentication safety guard  
- Send many magic-link emails while testing (one attempt after checks pass)

---

## Exact Site Work-chat prompt

Open the **staging Site Work chat** (not Settings) and paste:

```text
This is the Bullseye staging Site only:
https://nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site
project_id appgprj_6a6efa569218819185b3eefd3c508e66

Do not touch production. Do not change code. Do not change Stripe.
Do not change Supabase projects or data. Do not change environment variable values.

Problem: the live browser bundle still inlines NEXT_PUBLIC_SUPABASE_URL host
opmgzchnmcgnsfwpmysc, while Sites Settings already use pxlqvaddvghjjhenqmdh.
That mismatch correctly blocks magic-link on /login.

Required:
1. Rebuild this staging Site from the current launch-candidate source.
2. During that build, use the existing hosted environment variables from Sites Settings
   (NEXT_PUBLIC_SUPABASE_URL must bake as https://pxlqvaddvghjjhenqmdh.supabase.co).
3. Deploy that new build to this staging Site only.
4. Confirm deploy success and the staging URL.

Do not save-only without deploying. We need a fresh browser asset deploy.
```

---

## Expected confirmation from ChatGPT Sites

You should see clear confirmation that:

1. A **new build** completed for this staging Site  
2. That build was **deployed** to the staging URL above  
3. Production was **not** changed  

If ChatGPT only “saves a version” and does not deploy, ask again:  
`Deploy that saved version to this staging Site only.`

---

## Post-deploy browser verification (before any email)

1. Open a private/incognito window (or hard-refresh).  
2. Pass ChatGPT Sites sign-in if the gate appears.  
3. Open:  
   `https://nash-ai-markets-bullseye-staging.nashysinners.chatgpt.site/login`  
4. Confirm you see the Bullseye membership email form (not only the ChatGPT gate).  
5. Open DevTools → Console and paste:

```js
(() => {
  const form = document.querySelector("form.accessForm");
  return {
    authRedirectReady: form?.getAttribute("data-auth-redirect-ready"),
    emailRedirectTo: form?.getAttribute("data-email-redirect-to"),
  };
})()
```

**Pass if:** `authRedirectReady` is `"true"` and `emailRedirectTo` ends with `/auth/callback`.

6. Still in DevTools → Network (or Console), check the login JavaScript chunk  
   (name contains `StagingLoginForm`):

**Pass if:**

- it contains `pxlqvaddvghjjhenqmdh`  
- it does **not** contain `opmgzchnmcgnsfwpmysc`

**Fail if** either check fails → **stop**. Do not send a magic link. Re-run the deploy prompt.

---

## Magic-link test sequence (only after checks pass)

1. Submit **one** membership email on `/login`.  
2. Expect a normal acceptance message (not “Staging authentication is being updated…”).  
3. Open the link once in the **same browser**.  
4. Confirm you land in the member area (usually `/dashboard`).  
5. Do not spam additional emails.

Optional later: run signed-in evidence tooling once storage-state exists  
(`npm run staging:auth-evidence`) — still no production.

---

## Rollback / stop conditions

Stop immediately and do not continue testing if:

- Production URL or production Site is mentioned as changed  
- Deploy fails or the staging URL serves errors  
- Login chunk still contains `opmgzchnmcgnsfwpmysc`  
- `data-auth-redirect-ready` stays `"false"`  
- ChatGPT Sites asks to change env values, Stripe, or Supabase projects  

Rollback options (staging only):

- Redeploy the previous known-good saved version of **this staging Site**  
- Or restrict Sharing again and pause testing  

Do **not** “fix” by weakening the auth guard or pointing staging at another Supabase project without a new written decision.

---

## Evidence to save (no secrets)

Save screenshots or short notes of:

1. Sites chat saying staging deploy succeeded  
2. `/login` membership form  
3. Console result showing `authRedirectReady: "true"`  
4. Proof the login chunk has `pxlqv…` and not `opmgz…` (search highlight is enough)  
5. Optional: one successful magic-link return to `/dashboard` (no tokens, no full email link)

Never save:

- storage-state / cookies  
- magic-link URLs  
- API keys or env values  
- Stripe secrets  
