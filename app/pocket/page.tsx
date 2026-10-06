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
import "./pocket-preflight.css";
import "./pocket-accuracy-feedback.css";
import "./pocket-level-provenance.css";
import "./pocket-result-clarity.css";
import "./pocket-consistency.css";
import "./pocket-launch-v17.css";
import "./pocket-lock-on.css";
import "./pocket-command-arena.css";
import "./pocket-bubble-lab.css";
import "./pocket-pattern-watch.css";
import "./pocket-options-wall.css";
import "./pocket-vr-simulation.css";

export const metadata: Metadata = {
  title: "Pocket Bullseye AI Chart Analysis",
  description: "Upload a trading chart for an AI-assisted second opinion. Review market structure, support and resistance, timeframe context, invalidation and risk before deciding.",
  applicationName: "Pocket Bullseye",
  keywords: ["AI chart analysis", "trading chart analyser", "trading second opinion", "support and resistance", "pre-trade analysis"],
  alternates: { canonical: "/pocket" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Pocket Bullseye — AI Chart Analysis for Traders",
    description: "Get an evidence-led second opinion on your trading chart before deciding.",
    type: "website",
    url: "/pocket",
    siteName: "Pocket Bullseye",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pocket Bullseye — AI Chart Analysis for Traders",
    description: "Get an evidence-led second opinion on your trading chart before deciding.",
  },
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
