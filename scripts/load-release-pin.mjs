import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pinPath = fileURLToPath(new URL("../docs/app-store/release-pin.json", import.meta.url));
const pin = JSON.parse(readFileSync(pinPath, "utf8"));

if (!pin.serverUrl || !/^[a-f0-9]{40}$/i.test(String(pin.revision ?? ""))) {
  console.error("release-pin.json must include serverUrl and a 40-character revision.");
  process.exit(1);
}

process.stdout.write(`export CAPACITOR_SERVER_URL=${JSON.stringify(pin.serverUrl)}\n`);
process.stdout.write(`export CAPACITOR_SERVER_REVISION=${JSON.stringify(pin.revision)}\n`);
