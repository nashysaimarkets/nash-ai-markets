import type { Metadata } from "next";
import { PwaController } from "../components/PwaController";

export const metadata: Metadata = {
  title: "Pocket Bullseye | NASH AI Markets",
  description: "Upload a chart screenshot for an AI second opinion on support, resistance, scenarios and risk. Pocket Bullseye by NASH AI Markets.",
  manifest: "/pocket/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pocket Bullseye",
    statusBarStyle: "black-translucent",
  },
};

export default function PocketLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <PwaController appName="Pocket Bullseye" installDelayMs={8_000} storageNamespace="pocket" />
    </>
  );
}
