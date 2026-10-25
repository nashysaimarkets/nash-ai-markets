import { POCKET_PRODUCT } from "../lib/product-brand";
import type { Metadata } from "next";
import { PwaController } from "../components/PwaController";

export const metadata: Metadata = {
  title: POCKET_PRODUCT.displayName,
  description: "Private mobile-first AI chart analysis for NASH AI Markets.",
  manifest: "/pocket/manifest.webmanifest",
  icons: { icon: "/icons/ntp-icon.svg", apple: "/icons/ntp-apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    title: POCKET_PRODUCT.shortName,
    statusBarStyle: "black-translucent",
  },
};

export default function PocketLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <PwaController appName={POCKET_PRODUCT.displayName} installDelayMs={8_000} storageNamespace="pocket" />
    </>
  );
}
