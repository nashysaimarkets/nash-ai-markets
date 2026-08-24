import type { Metadata, Viewport } from "next";
import PocketBullseye from "./PocketBullseye";
import { createUnavailableMacroContext, getVerifiedMacroContext } from "../lib/verified-macro-context";
import "./pocket.css";
import "./pocket-launch-polish.css";
import "./pocket-launch-depth.css";
import "./pocket-launch-v2.css";
import "./pocket-launch-v3.css";
import "./pocket-launch-v4.css";
import "./pocket-final-tuning.css";
import "./pocket-launch-v5.css";
import "./pocket-launch-v6.css";
import "./pocket-launch-v7.css";
import "./pocket-launch-v8.css";
import "./pocket-launch-v9.css";
import "./pocket-launch-v10.css";
import "./pocket-launch-v11.css";
import "./pocket-launch-v12.css";
import "./pocket-launch-v13.css";
import "./pocket-launch-v14.css";
import "./pocket-launch-v15.css";
import "./pocket-launch-v16.css";
import "./pocket-feedback.css";
import "./pocket-cinema-pro.css";
import "./pocket-2.css";
import "./pocket-level-verification.css";
import "./pocket-preflight.css";

export const metadata: Metadata = {
  title: "Pocket Bullseye",
  description: "Private mobile-first AI chart analysis for NASH AI Markets.",
  applicationName: "Pocket Bullseye",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0e13",
};

export default async function PocketPage() {
  const macroContext = await getVerifiedMacroContext({ route: "/pocket" }).catch(() => createUnavailableMacroContext());
  return <PocketBullseye macroContext={macroContext} />;
}
