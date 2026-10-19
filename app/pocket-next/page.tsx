import PocketNext from "./PocketNext";
import type { Metadata, Viewport } from "next";
import "./pocket-next.css";
import {createUnavailableMacroContext,getVerifiedMacroContext} from "../lib/verified-macro-context";

export const metadata: Metadata = { title: "Pocket Bullseye — Workspace Preview", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5, userScalable: true, themeColor: "#101b2b" };

export default async function PocketNextPage() {
  const macroContext=await getVerifiedMacroContext({route:"/pocket-next"}).catch(()=>createUnavailableMacroContext());
  return <PocketNext macroContext={macroContext} />;
}
