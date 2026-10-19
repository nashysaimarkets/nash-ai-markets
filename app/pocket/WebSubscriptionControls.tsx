"use client";
import { useEffect, useState } from "react";
import { isAppleNativeApp } from "./apple-storekit";
import { getPocketWebAccessStatus } from "./web-subscription";

export default function WebSubscriptionControls() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (isAppleNativeApp()) return;
    const controller = new AbortController();
    void getPocketWebAccessStatus(controller.signal).then(entitled => {
      if (!controller.signal.aborted) setMessage(entitled ? "Your Pocket subscription is verified." : "Sign in to verify your existing Pocket subscription. If access is missing, contact support before purchasing again.");
    }).catch(() => {
      if (!controller.signal.aborted) setMessage("Subscription verification is temporarily unavailable. Please retry shortly.");
    });
    return () => controller.abort();
  }, []);
  if (!message) return null;
  return <section className="psPreflight" aria-label="Pocket subscription access">
    <p role="status">{message}</p>
    <form method="post" action="/api/pocket/billing-portal"><button type="submit">Manage web subscription</button></form>
    <a href="/pocket/login">Pocket account</a>{" · "}<a href="mailto:hello@nashaimarkets.com">Support</a>
  </section>;
}
