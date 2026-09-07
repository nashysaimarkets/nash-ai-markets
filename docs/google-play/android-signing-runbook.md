# Pocket Bullseye Android signing runbook

This runbook prepares the first Google Play upload without storing signing keys or passwords in Git.

## Safety boundary

- Treat the keystore as the permanent Google Play upload key.
- Never commit the keystore, its passwords, `key.properties`, or `keystore.properties`.
- Keep at least one encrypted backup outside Codemagic. Codemagic does not allow an uploaded keystore to be downloaded later.
- Do not create the key until the account owner has chosen how its passwords and backup will be retained.

## Existing upload key

An upload key has already been generated: `pocket-bullseye-upload.jks`, key alias `upload`. Use that existing key; do not generate a replacement. Its passwords must be entered directly in Codemagic and never shared in chat or committed.

1. Locate the existing keystore on the owner's computer.
2. Retain both passwords in the approved encrypted credential store and preserve a separate encrypted backup.
3. In Codemagic team settings, open **Code signing identities → Android keystores** and upload the keystore.
4. Set the Codemagic keystore reference name to `pocket_bullseye_upload` and enter its keystore password, key alias, and key password.

Codemagic will expose the protected identity to the signed workflow as `CM_KEYSTORE_PATH`, `CM_KEYSTORE_PASSWORD`, `CM_KEY_ALIAS`, and `CM_KEY_PASSWORD`. Gradle refuses a signed release when any of those values are missing.

## Build the first signed bundle

1. Wait until the Google Play developer account and Pocket Bullseye app entry exist.
2. Review the exact release commit and ensure the normal Android verification workflow is green.
3. Verify `docs/google-play/release-pin.json` against the combined Android web deployment's build manifest. The iOS pin is separate and must not be substituted. Confirm the proposed Android version code is unused in Play Console.
4. Create an approved tag matching `android-release-v*`, for example `android-release-v1.2.7-build23` after code 23 has been verified as available.
5. Run **Pocket Bullseye — Signed Android Release Bundle**.
6. Preserve the generated `app-release.aab`, build logs, and `android-signing-certificate.txt` together.

The workflow verifies the AAB signature before exposing the artifact. It deliberately has no `google_play` publishing block.

## First Google Play upload

The first signed AAB must be uploaded manually in Google Play Console. Use an internal-testing release until the subscription product, tester access, purchase, restore, acknowledgement, cancellation, and expiry flows have passed on a physical Android device.

Only configure Codemagic service-account publishing after the first manual upload and a reviewed least-privilege Play Console integration.
