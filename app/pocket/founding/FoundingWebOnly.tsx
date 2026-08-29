"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

const subscribeToPlatform = () => () => undefined;
const readPlatform = () => Capacitor.isNativePlatform() ? "native" : "web";
const readServerPlatform = () => "loading";

/**
 * The founding checkout is a web-only Stripe offer. The native iOS build must
 * never render it: digital access inside Pocket Bullseye is sold exclusively
 * through the StoreKit paywall.
 */
export default function FoundingWebOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const platform = useSyncExternalStore(
    subscribeToPlatform,
    readPlatform,
    readServerPlatform,
  );

  useEffect(() => {
    if (platform === "native") router.replace("/pocket");
  }, [platform, router]);

  if (platform !== "web") {
    return <main className="pfLaunch" aria-busy="true"><p className="pfNativeRedirect">Opening Pocket Bullseye…</p></main>;
  }

  return children;
}
