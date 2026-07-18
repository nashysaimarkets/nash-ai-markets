"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const HUNT_KEY = "nash-golden-egg-hunt-v1";
const eggRoutes = [
  { path: "/about", id: "perspective", message: "Perspective found. The best view is rarely the loudest one." },
  { path: "/help", id: "process", message: "Process found. Calm preparation beats hurried conviction." },
  { path: "/pricing", id: "value", message: "Value found. Premium means useful depth, not unnecessary noise." },
  { path: "/ideas", id: "curiosity", message: "Curiosity found. Better questions build better market tools." },
  { path: "/profile", id: "identity", message: "Bullseye found. Your process is the advantage worth protecting." },
] as const;

function readProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HUNT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function GoldenEggHunt() {
  const pathname = usePathname();
  const enabled = process.env.NEXT_PUBLIC_EASTER_HUNT_ENABLED === "true";
  const current = eggRoutes.find((egg) => pathname === egg.path);
  const [found, setFound] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const frame = window.requestAnimationFrame(() => setFound(readProgress()));
    return () => window.cancelAnimationFrame(frame);
  }, [enabled]);

  if (!enabled) return null;

  function discover() {
    if (!current) return;
    const next = found.includes(current.id) ? found : [...found, current.id];
    localStorage.setItem(HUNT_KEY, JSON.stringify(next));
    setFound(next);
    setMessage(current.message);
  }

  function reset() {
    localStorage.removeItem(HUNT_KEY);
    setFound([]);
    setMessage("The hunt has been reset. Five golden signals are waiting.");
  }

  const complete = found.length === eggRoutes.length;
  const discovered = current ? found.includes(current.id) : false;

  return <>
    {current ? <button className={`goldenEgg goldenEgg-${current.id}`} type="button" onClick={discover} aria-label={discovered ? "Golden NASH egg already discovered" : "Discover a hidden NASH golden egg"}>
      <span aria-hidden="true"><Image src="/brand/logo-mark.svg" width={22} height={22} alt="" /></span>
    </button> : null}
    <aside className={`huntStatus${complete ? " huntStatusComplete" : ""}`} aria-live="polite">
      <button type="button" className="huntStatusSummary" onClick={() => setMessage(message ? null : complete ? "Golden Bullseye Explorer unlocked. A cosmetic badge for completing the seasonal hunt." : "Five golden signals are hidden across calm corners of NASH AI Markets.")}>
        <span aria-hidden="true">◉</span>
        <strong>{complete ? "Golden Bullseye Explorer" : `${found.length} of ${eggRoutes.length} discovered`}</strong>
      </button>
      {message ? <div className="huntToast" role="status"><p>{message}</p><div><Link href="/dashboard">View clues</Link><button type="button" onClick={reset}>Reset hunt</button><button type="button" onClick={() => setMessage(null)} aria-label="Close Golden Egg Hunt message">Close</button></div></div> : null}
    </aside>
  </>;
}
