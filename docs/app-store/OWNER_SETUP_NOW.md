# Pocket Bullseye — do this now (owner checklist)

Follow these steps in order. Every field below is copy-paste ready.

**Status:** engineering complete · tag `ios-v1.0.0-testflight.1` pushed · web backend pinned

---

## Step 1 — Codemagic (≈15 minutes)

1. Open **https://codemagic.io/signup** and sign in with **GitHub** (`nashysaimarkets`).
2. Add repository **`nashysaimarkets/nash-ai-markets`**.
3. Codemagic should detect **`codemagic.yaml`** automatically.
4. Go to **Team settings → Integrations → Developer Portal**.
5. Add integration with this **exact name** (must match the yaml file):

   **`Pocket Bullseye App Store`**

6. In **App Store Connect → Users and Access → Integrations → App Store Connect API**:
   - Create key named **`Pocket Bullseye Codemagic`**
   - Role: **App Manager**
   - Download the `.p8` file once
   - Note **Key ID** and **Issuer ID**
7. Paste Key ID, Issuer ID and `.p8` contents into the Codemagic integration.
8. Let Codemagic generate the **Distribution certificate** and **App Store provisioning profile** for:

   **`com.nashaimarkets.pocketbullseye`**

9. Trigger build: either wait for tag auto-trigger, or in Codemagic click **Start new build** on workflow **Pocket Bullseye — iOS TestFlight** for tag `ios-v1.0.0-testflight.1`.

If the tag did not trigger (integration was added after the tag), re-push:

```bash
git push origin ios-v1.0.0-testflight.1
```

---

## Step 2 — App Store Connect app record (≈20 minutes)

Open **https://appstoreconnect.apple.com** and create a new app:

| Field | Value |
|---|---|
| Platform | iOS |
| Name | Pocket Bullseye |
| Primary language | English (U.K.) |
| Bundle ID | com.nashaimarkets.pocketbullseye |
| SKU | POCKET-BULLSEYE-IOS-001 |
| User access | Full access |

### Subscription (create before TestFlight review)

1. **Subscriptions → +** create group **`Pocket Bullseye Access`**
2. Add subscription:

| Field | Value |
|---|---|
| Reference name | Pocket Bullseye Monthly |
| Product ID | com.nashaimarkets.pocketbullseye.monthly |
| Duration | 1 month |
| Price | £4.99 (United Kingdom) |
| Display name | Pocket Bullseye Monthly |
| Description | Unlimited Pocket Bullseye chart analysis while your subscription remains active. |

3. Add subscription localisation and **review screenshot** (paywall on device).

### Store listing (paste from prepared copy)

Full text is in `docs/app-store/APP_STORE_CONNECT.md`:

- **Subtitle:** A second opinion on your chart
- **Category:** Finance (primary), Productivity (secondary)
- **Copyright:** 2026 Chris Nash
- **Support URL:** https://www.nashaimarkets.com/contact
- **Marketing URL:** https://pocket.nashaimarkets.com/pocket
- **Privacy URL:** https://www.nashaimarkets.com/privacy

### App Review Information

Paste the **App review notes** section from `docs/app-store/APP_STORE_CONNECT.md`.

**Important:** No demo account needed — the app is accountless.

---

## Step 3 — TestFlight on your iPhone (≈30 minutes)

After Codemagic uploads the build:

1. Install **TestFlight** on your iPhone.
2. Open the Pocket Bullseye build from App Store Connect → TestFlight.
3. Verify:

   - [ ] App launches with no login
   - [ ] Camera / photo picker works
   - [ ] First chart analysis completes free
   - [ ] Second analysis shows Apple paywall with **£4.99/month**
   - [ ] Subscribe (Sandbox) and Restore Purchases work
   - [ ] Terms and Privacy links load

Use a **Sandbox Apple ID** (Settings → App Store → Sandbox Account on device).

---

## Step 4 — Submit for App Review (≈30 minutes)

1. Record a **continuous screen video** on your physical iPhone using the script in `docs/app-store/APP_REVIEW_RESPONSE_2026-08-29.md`.
2. Attach a **rights-cleared sample chart** (instrument, timeframe, candles, price scale visible).
3. Upload **7 portrait screenshots** (titles in `APP_STORE_CONNECT.md`).
4. Fill in the **Guideline 2.1 response** from `APP_REVIEW_RESPONSE_2026-08-29.md` (replace `[BUILD NUMBER]`, `[IPHONE MODEL]`, etc.).
5. Select the TestFlight build and click **Submit for Review**.

---

## Quick reference

| Item | Value |
|---|---|
| Git branch | feat/pocket-app-store-candidate-2026-08-29 |
| iOS tag | ios-v1.0.0-testflight.1 |
| Web preview | https://nash-ai-markets-hhi4ared3-nash-ai-markets.vercel.app/pocket |
| Git SHA (web) | 26c986ebd2a446a467cf63a643efc205d44eba66 |
| PR | https://github.com/nashysaimarkets/nash-ai-markets/pull/61 |

Production Pocket and Stripe billing are **not** changed by this release.
