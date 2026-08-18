import type { Metadata, Viewport } from "next";
import PocketBullseye from "./PocketBullseye";
import { createUnavailableMacroContext, getVerifiedMacroContext } from "../lib/verified-macro-context";
import "./pocket.css";

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
  themeColor: "#050304",
};

export default async function PocketPage() {
  const macroContext = await getVerifiedMacroContext({ route: "/pocket" }).catch(() => createUnavailableMacroContext());
  return <PocketBullseye macroContext={macroContext} />;
}
