import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.nashaimarkets.pocketbullseye",
  appName: "Pocket Bullseye",
  webDir: "dist",
  server: {
    url: "https://pocket.nashaimarkets.com/pocket",
    cleartext: false,
    allowNavigation: ["pocket.nashaimarkets.com"],
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
