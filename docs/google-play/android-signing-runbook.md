# Pocket Bullseye Android signing runbook

This runbook prepares the first Google Play upload without storing signing keys or passwords in Git.

## Safety boundary

- Treat the keystore as the permanent Google Play upload key.
- Never commit the keystore, its passwords, `key.properties`, or `keystore.properties`.
- Keep at least one encrypted backup outside Codemagic. Codemagic does not allow an uploaded keystore to be downloaded later.
- Do not create the key until the account owner has chosen how its passwords and backup will be retained.

## One-time operator setup

1. Generate an RSA 2048-bit JKS upload key with Java `keytool`:

   ```sh
   keytool -genkey -v \
     -keystore pocket-bullseye-upload.jks \
     -storetype JKS \
     -keyalg RSA \
     -keysize 2048 \
     -validity 10000 \
     -alias pocket-bullseye-upload
   ```

2. Store the keystore and both passwords in the approved encrypted credential store and preserve a separate encrypted backup.
3. In Codemagic team settings, open **Code signing identities → Android keystores** and upload the keystore.
4. Set the Codemagic keystore reference name to `pocket_bullseye_upload` and enter its keystore password, key alias, and key password.

Codemagic will expose the protected identity to the signed workflow as `CM_KEYSTORE_PATH`, `CM_KEYSTORE_PASSWORD`, `CM_KEY_ALIAS`, and `CM_KEY_PASSWORD`. Gradle refuses a signed release when any of those values are missing.

## Build the first signed bundle

1. Wait until the Google Play developer account and Pocket Bullseye app entry exist.
2. Review the exact release commit and ensure the normal Android verification workflow is green.
3. Create an approved tag matching `android-release-v*`, for example `android-release-v1.1.0`.
4. Run **Pocket Bullseye — Signed Android Release Bundle**.
5. Preserve the generated `app-release.aab`, build logs, and `android-signing-certificate.txt` together.

The workflow verifies the AAB signature before exposing the artifact. It deliberately has no `google_play` publishing block.

## First Google Play upload

The first signed AAB must be uploaded manually in Google Play Console. Use an internal-testing release until the subscription product, tester access, purchase, restore, acknowledgement, cancellation, and expiry flows have passed on a physical Android device.

Only configure Codemagic service-account publishing after the first manual upload and a reviewed least-privilege Play Console integration.
