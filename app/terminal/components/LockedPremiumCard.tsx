"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PremiumTier } from "../lib/membership-entitlement.ts";

type LockedPremiumCardProps = {
  tier: PremiumTier;
  title: string;
  value: string;
  benefits: readonly string[];
  previewEligible: boolean;
  previewAvailable: boolean;
  previewCadence?: "weekly" | "daily";
};

export function LockedPremiumCard({
  tier,
  title,
  value,
  benefits,
  previewEligible,
  previewAvailable,
  previewCadence,
}: LockedPremiumCardProps) {
  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState("");

  async function claimPreview() {
    setClaiming(true);
    setMessage("");
    try {
      const response = await fetch("/api/membership/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetTier: tier }),
      });
      if (!response.ok) {
        setMessage(response.status === 409 ? "This preview has already been used for the current period." : "Preview access is temporarily unavailable.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Preview access is temporarily unavailable.");
    } finally {
      setClaiming(false);
    }
  }

  return <section className="ftCard premiumLockCard" aria-labelledby={`locked-${tier}-${title.replaceAll(" ", "-").toLowerCase()}`}>
    <div className="premiumBlurPreview" aria-hidden="true">
      <i /><i /><i /><i /><i /><i />
    </div>
    <div className="premiumLockContent">
      <span className={`premiumTier premiumTier-${tier}`}>{tier.toUpperCase()} ACCESS</span>
      <h2 id={`locked-${tier}-${title.replaceAll(" ", "-").toLowerCase()}`}>{title}</h2>
      <p>{value}</p>
      <ul>{benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
      <div className="premiumLockActions">
        <Link className="premiumUpgrade" href="/#membership">See how {tier === "pro" ? "Pro" : "Elite"} improves your workflow →</Link>
        {previewEligible && previewAvailable ? <button type="button" onClick={claimPreview} disabled={claiming}>{claiming ? "Opening preview…" : `Use ${previewCadence ?? ""} ${tier.toUpperCase()} preview`}</button> : null}
      </div>
      {!previewAvailable ? <small>Preview verification is temporarily unavailable. Your current plan remains active.</small> : null}
      {previewAvailable && !previewEligible && previewCadence ? <small>Your {previewCadence} preview has been used. It resets automatically.</small> : null}
      {message ? <small role="status">{message}</small> : null}
    </div>
  </section>;
}
