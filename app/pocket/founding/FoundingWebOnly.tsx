"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

const subscribeToPlatform = () => () => undefined;
const readPlatform = () => Capacitor.isNativePlatform() ? "native" : "web";
const readServerPlatform = () => "loading";

/**
 * The Stripe web-membership checkout must never render in the native iOS app.
 * Pocket Bullseye access purchased in iOS is handled through StoreKit; web
 * membership checkout remains handled by Stripe.
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
    return <main className="pfLaunch" aria-busy="true"><p className="pfNativeRedirect">Opening Pocket Bullseye for Apple subscription access…</p></main>;
  }

  return children;
}
