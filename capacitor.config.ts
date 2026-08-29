import type { CapacitorConfig } from "@capacitor/cli";

const rawServerUrl = process.env.CAPACITOR_SERVER_URL?.trim() ?? "";
const serverRevision = process.env.CAPACITOR_SERVER_REVISION?.trim() ?? "";

if (!rawServerUrl) {
  throw new Error("CAPACITOR_SERVER_URL is required. Pin the reviewed iOS build to an immutable verified preview; no production URL is assumed.");
}
if (!/^[a-f0-9]{40}$/i.test(serverRevision)) {
  throw new Error("CAPACITOR_SERVER_REVISION must be the exact 40-character Git revision served by CAPACITOR_SERVER_URL.");
}

const serverUrl = new URL(rawServerUrl);
if (serverUrl.protocol !== "https:" || serverUrl.username || serverUrl.password || serverUrl.search || serverUrl.hash) {
  throw new Error("CAPACITOR_SERVER_URL must be a credential-free HTTPS URL without query parameters or a fragment.");
}
if (serverUrl.pathname.replace(/\/$/, "") !== "/pocket") {
  throw new Error("CAPACITOR_SERVER_URL must point to the verified /pocket route.");
}
if (serverUrl.hostname === "pocket.nashaimarkets.com" || serverUrl.hostname.includes("-git-")) {
  throw new Error("CAPACITOR_SERVER_URL must use an immutable deployment URL, not production or a mutable branch alias.");
}

const config: CapacitorConfig = {
  appId: "com.nashaimarkets.pocketbullseye",
  appName: "Pocket Bullseye",
  // A small deterministic fallback is bundled, while the release build is
  // pinned to one separately verified immutable web revision.
  webDir: "ios/NativeWeb",
  server: {
    url: serverUrl.toString(),
    cleartext: false,
    allowNavigation: [serverUrl.hostname],
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#070b10",
    preferredContentMode: "mobile",
    scheme: "PocketBullseye",
  },
  plugins: {
    Camera: {
      permissions: ["photos"],
    },
    SplashScreen: {
      launchShowDuration: 1400,
      backgroundColor: "#070b10",
      showSpinner: false,
    },
  },
};

export default config;
