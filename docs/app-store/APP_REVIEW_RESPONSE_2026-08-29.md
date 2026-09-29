# Pocket Bullseye — App Review information response

Use this document for the Guideline 2.1 information request for Pocket Bullseye 1.0. Apple's message requests additional review information; its eight questions are not eight separate app violations.

Before sending, replace every bracketed attachment, build, device and OS placeholder with verified facts from the submitted build. Do not add reviewer credentials: the iOS Pocket Bullseye experience is accountless.

## Paste-ready response to App Review

Hello App Review,

Thank you for the opportunity to provide the requested information for Pocket Bullseye 1.0.

### 1. Physical-device recording and typical user flow

We have attached `[PHYSICAL-DEVICE-RECORDING-FILENAME]`, recorded on a physical `[IPHONE MODEL]` running the latest publicly available `[IOS VERSION]` with build `[BUILD NUMBER]`. The recording begins with app launch and demonstrates the typical end-to-end flow:

1. Launch Pocket Bullseye from the Home Screen.
2. Choose the camera or photo control and show the applicable system permission/picker flow.
3. Select the attached rights-cleared sample chart.
4. Confirm the detected chart facts and the on-screen Privacy Shield.
5. Choose LONG, SHORT or JUST ANALYSE and request the first complete analysis.
6. View the returned structure, support/resistance and conditional scenarios.
7. Attempt an additional AI analysis and show the native Apple subscription screen.
8. Show the localized one-month price, subscription terms, purchase action and `RESTORE PURCHASES` action.

Pocket Bullseye does not require account registration or login, does not create a user account, and has no account-deletion flow. User-selected charts are private analysis inputs and are not published to other users; there is no social or user-generated-content feed requiring reporting or blocking controls. Camera or photo access is initiated only after the user taps the corresponding control.

### 2. Devices and operating-system versions tested

The submitted build was tested as follows:

| Device | OS | Test type | Build |
|---|---|---|---|
| `[IPHONE MODEL]` | `[IOS VERSION]` | Physical device | `[BUILD NUMBER]` |
| `[IPAD MODEL]` | `[IPADOS VERSION]` | Physical device | `[BUILD NUMBER]` |

Both tests covered cold launch, camera/photo selection, chart preflight, the free analysis, the StoreKit subscription screen, purchase presentation, restore handling, legal links and relaunch.

### 3. Functions, audience, problem and value

Pocket Bullseye is an educational chart-reading assistant for self-directed traders who already use a charting or trading platform. A user supplies a screenshot from that platform. Pocket Bullseye identifies the visible instrument and timeframe, checks chart readability, and returns a structured second opinion covering visible market structure, support and resistance, bullish and bearish scenarios, invalidation evidence, pattern context, setup quality and reasons to wait.

The app addresses a common problem: traders can become anchored to one directional idea and place risk around obvious chart areas without challenging the opposing case. Pocket Bullseye slows that decision down and presents conditional evidence in a consistent format. It does not execute trades, connect to a brokerage account, hold funds, display executable prices, provide personalised financial advice or guarantee outcomes.

### 4. Setup, access instructions and sample content

No special setup, organisation access, registration, login or credentials are required.

1. Launch the app.
2. Tap the chart upload area or `USE CAMERA`.
3. Select `[RIGHTS-CLEARED-SAMPLE-CHART-FILENAME]`, attached in App Store Connect. The sample must visibly include an instrument label, timeframe, candles and price scale.
4. Confirm the detected chart facts.
5. Tick `PRIVACY SHIELD` after confirming the image contains no name, account number, balance or notifications.
6. Select LONG, SHORT or JUST ANALYSE.
7. Tap `CHALLENGE MY SETUP`.

The first complete analysis is available without purchase. An additional AI analysis opens the native Apple subscription screen.

### 5. External services, tools and platforms

- OpenAI Responses API processes a user-selected chart only after the user requests analysis. Requests are sent with `store: false`. Limited provider safety/abuse-monitoring retention may still apply under the provider's policies.
- Vercel hosts the app's web assets and server-side API routes used by the iOS shell.
- Apple StoreKit presents, purchases and restores the iOS auto-renewable subscription.
- Financial Modeling Prep may provide optional corporate-event context for supported listed equities.
- Official U.S. macroeconomic sources, including the Bureau of Labor Statistics, Bureau of Economic Analysis and Federal Reserve, are used where macro calendar context is displayed.

No broker, exchange, trading account, order-routing, custody or funds-transfer service is connected to the app.

### 6. Regional differences

The core app functionality is the same in every App Store territory where Pocket Bullseye is offered. There are no region-specific feature sets or reviewer flows. Apple StoreKit supplies the localized subscription price and currency for the reviewer's storefront.

### 7. Regulated or protected third-party authorization

No third-party authorization documents or protected-system credentials are applicable. Pocket Bullseye does not access a brokerage account, execute or route orders, hold customer funds or assets, or provide personalised investment advice. It provides educational, conditional analysis of a chart screenshot selected by the user.

### 8. In-app purchase offering and navigation

Pocket Bullseye offers one auto-renewable subscription:

- Reference name: `Pocket Bullseye Monthly`
- Product ID: `com.nashaimarkets.pocketbullseye.monthly`
- Subscription group: `Pocket Bullseye Access`
- Duration: one month
- Access: unlimited Pocket Bullseye chart analysis while the subscription remains active
- Introductory access: one complete analysis is provided by the app before purchase; this is not an App Store free trial
- Price: the native paywall displays the localized StoreKit price returned for the reviewer's storefront

Navigation to purchase:

1. Launch the app and complete the first free analysis.
2. Add another chart or request another AI analysis.
3. The native subscription screen appears.
4. Tap `SUBSCRIBE FOR [LOCALIZED PRICE] / MONTH` to open Apple's purchase sheet.

Navigation to restore:

1. Open the same native subscription screen by requesting an additional analysis after the free analysis.
2. Tap `RESTORE PURCHASES`.

The iOS build uses Apple StoreKit and does not present Stripe or an external purchase link.

Regards,

Chris Nash

## Physical-device recording checklist and script

### Before recording

- [ ] Confirm the Codemagic archive log shows `Verified immutable Pocket web revision` and that the reported SHA matches the final reviewed web commit.
- [ ] Install the exact submitted `[BUILD NUMBER]` on a physical `[IPHONE MODEL]` running the latest publicly available `[IOS VERSION]` supported at submission time.
- [ ] Keep a physical `[IPAD MODEL]` on `[IPADOS VERSION]` available for the separate compatibility test record.
- [ ] Attach a rights-cleared chart named `[RIGHTS-CLEARED-SAMPLE-CHART-FILENAME]`; verify that its instrument, timeframe, candle area and right-side price scale are legible.
- [ ] Remove names, account numbers, balances, notifications and other personal information from the chart and device.
- [ ] Use an Apple sandbox account and a StoreKit state that can demonstrate the paywall, purchase sheet and restore result truthfully.
- [ ] Reinstall the app or reset only the relevant test-device privacy permission if necessary to show the first-use camera permission. Do not simulate a permission prompt that the OS does not present.
- [ ] Turn off unrelated notifications, Focus overlays, VPN banners and low-battery alerts.
- [ ] Confirm that the Terms and Privacy links load and that no external payment or founding-offer link is visible in the iOS app.

### Continuous recording script

1. Start the screen recording on the Home Screen, with the Pocket Bullseye icon visible.
2. Tap Pocket Bullseye so the recording includes cold launch.
3. Briefly show that the first screen has no registration or login requirement.
4. Tap `USE CAMERA` and show the genuine iOS camera permission when applicable; cancel back to the app after permission is resolved.
5. Tap the chart upload area and select `[RIGHTS-CLEARED-SAMPLE-CHART-FILENAME]` through the native picker.
6. Show the selected chart and the automatic chart preflight. Confirm the detected instrument, timeframe and current visible price against the screenshot.
7. Tick `PRIVACY SHIELD`, choose JUST ANALYSE and tap `CHALLENGE MY SETUP`.
8. Keep the recording continuous while analysis completes. Show the result's instrument, timeframe, exact visible current price, two-sided structural levels and conditional verdict.
9. Return to the chart input, select another rights-cleared sample and request another AI analysis.
10. Show the native subscription screen, localized monthly price, one-month auto-renewal disclosure, Terms link and Privacy link.
11. Tap the subscribe button and show Apple's system purchase sheet. Complete or cancel only according to the prepared sandbox test state, and keep the result visible.
12. Return to the subscription screen and tap `RESTORE PURCHASES`; show the resulting entitlement or no-active-subscription message.
13. Relaunch once to demonstrate stable access state, then stop recording.

### Final evidence check

- [ ] The recording filename, device model, OS version and build number match the text sent to App Review.
- [ ] The recording starts at launch and has no edits that obscure the flow.
- [ ] The camera/photo interaction is genuine and user initiated.
- [ ] The first free analysis and the additional-analysis subscription gate are both visible.
- [ ] Purchase and restore are shown through Apple's UI.
- [ ] No account credentials or account-deletion claim appears because the app creates no account.
- [ ] The sample chart attachment is included in App Store Connect and matches the filename in the response.
- [ ] The response and recording describe only behaviour verified in the submitted build.
