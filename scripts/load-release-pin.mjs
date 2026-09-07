import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const platform = process.argv[2] ?? "ios";
if (!["ios", "android"].includes(platform)) throw new Error("Choose ios or android.");
const pinPath = fileURLToPath(new URL(platform === "android" ? "../docs/google-play/release-pin.json" : "../docs/app-store/release-pin.json", import.meta.url));
const pin = JSON.parse(readFileSync(pinPath, "utf8"));

if (platform === "android" && process.env.POCKET_ANDROID_SIGNED_RELEASE === "true" && pin.playVersionCodeVerified !== true) {
  console.error("Confirm that this Android versionCode is unused in Play Console before a signed release.");
  process.exit(1);
}

if (!pin.serverUrl || !/^[a-f0-9]{40}$/i.test(String(pin.revision ?? ""))) {
  console.error(`${platform} release-pin.json must include a verified serverUrl and a 40-character revision. Never substitute the other platform's pin.`);
  process.exit(1);
}

const shellQuote = (value) => "'" + String(value).replaceAll("'", "'\\''") + "'";
process.stdout.write(`export CAPACITOR_SERVER_URL=${shellQuote(pin.serverUrl)}\n`);
process.stdout.write(`export CAPACITOR_SERVER_REVISION=${shellQuote(pin.revision)}\n`);
process.stdout.write(`export POCKET_NATIVE_PLATFORM=${shellQuote(platform)}\n`);
