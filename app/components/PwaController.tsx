"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "nash-pwa-install-dismissed";
const SESSION_KEY = "nash-pwa-install-session-shown";
const DISMISS_DAYS = 14;
const INSTALL_DELAY_MS = 45_000;
const MEMBER_INSTALL_PATHS = ["/dashboard", "/terminal", "/brief", "/ideas", "/profile", "/onboarding", "/pocket"];

function isMemberInstallPath(pathname: string): boolean {
  return MEMBER_INSTALL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosSafari(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(navigator.userAgent);
  const alternateBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
  return ios && webkit && !alternateBrowser;
}

function recentlyDismissed(): boolean {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(dismissedAt)
      && Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1_000;
  } catch {
    return false;
  }
}

function sessionAlreadyShown(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markSessionShown() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Privacy modes may block sessionStorage; in-memory visibility still limits this render.
  }
}

export function PwaController() {
  const pathname = usePathname();
  const installSurface = isMemberInstallPath(pathname);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [status, setStatus] = useState("");
  const updateAccepted = useRef(false);
  const installEligible = useRef(false);

  useEffect(() => {
    let updateTimer: number | undefined;
    let iosPromptTimer: number | undefined;
    let installRevealTimer: number | undefined;
    /*
     * This effect re-runs whenever the visitor moves between member and public
     * routes. Listeners bound to the long-lived ServiceWorkerRegistration would
     * otherwise accumulate on every navigation, so everything is bound to one
     * signal that the cleanup aborts.
     */
    const lifetime = new AbortController();
    const { signal } = lifetime;

    const canOfferInstall = () =>
      installSurface
      && !isStandalone()
      && !recentlyDismissed()
      && !sessionAlreadyShown();

    const revealInstall = () => {
      if (!canOfferInstall() || !installEligible.current) return;
      markSessionShown();
      setVisible(true);
    };

    if ("serviceWorker" in navigator && window.isSecureContext) {
      const offerUpdate = (worker: ServiceWorker) => {
        setWaitingWorker(worker);
        // Updates are opt-in and can appear without competing with the delayed install toast.
        if (installSurface && !isStandalone()) setVisible(true);
      };
      const register = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
          // Registration resolves asynchronously and may land after cleanup.
          if (signal.aborted) return;
          if (registration.waiting) offerUpdate(registration.waiting);
          registration.addEventListener(
            "updatefound",
            () => {
              const installing = registration.installing;
              installing?.addEventListener(
                "statechange",
                () => {
                  if (installing.state === "installed" && navigator.serviceWorker.controller) offerUpdate(installing);
                },
                { signal },
              );
            },
            { signal },
          );
          updateTimer = window.setInterval(() => void registration.update(), 60 * 60 * 1_000);
        } catch {
          // Installation remains optional and the web experience stays available.
        }
      };
      if (document.readyState === "complete") void register();
      else window.addEventListener("load", () => void register(), { once: true, signal });

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          if (updateAccepted.current) window.location.reload();
        },
        { signal },
      );
    }

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      installEligible.current = true;
      if (canOfferInstall()) {
        installRevealTimer = window.setTimeout(revealInstall, INSTALL_DELAY_MS);
      }
    };
    const handleInstalled = () => {
      setVisible(false);
      setStatus("NASH AI Markets is installed.");
    };

    if (canOfferInstall()) {
      if (isIosSafari()) {
        installEligible.current = true;
        iosPromptTimer = window.setTimeout(() => {
          setShowIosHelp(true);
          revealInstall();
        }, INSTALL_DELAY_MS);
      }
      window.addEventListener("beforeinstallprompt", handleInstallPrompt, { signal });
      window.addEventListener("appinstalled", handleInstalled, { signal });
    }

    return () => {
      if (updateTimer !== undefined) window.clearInterval(updateTimer);
      if (iosPromptTimer !== undefined) window.clearTimeout(iosPromptTimer);
      if (installRevealTimer !== undefined) window.clearTimeout(installRevealTimer);
      lifetime.abort();
    };
  }, [installSurface]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Storage can be unavailable in privacy modes; dismissal still works now.
    }
    markSessionShown();
    setVisible(false);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    setVisible(false);
    markSessionShown();
    setStatus(choice.outcome === "accepted" ? "Installation accepted." : "Installation dismissed.");
  };

  const applyUpdate = () => {
    if (!waitingWorker) return;
    updateAccepted.current = true;
    setStatus("Applying application update.");
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  if (!visible) {
    return <div className="pwaStatus" aria-live="polite">{status}</div>;
  }

  return (
    <>
      <div className="pwaStatus" aria-live="polite">{status}</div>
      <aside
        className={`pwaInstallPrompt${waitingWorker ? " is-update" : " is-install"}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="pwa-install-title"
      >
        <button type="button" className="pwaInstallClose" onClick={dismiss} aria-label="Close install prompt">
          Close
        </button>
        <div>
          <span className="pwaInstallEyebrow">{waitingWorker ? "APPLICATION UPDATE" : "INSTALL NASH AI MARKETS"}</span>
          <strong id="pwa-install-title">
            {waitingWorker ? "A secure update is ready." : "Keep NASH AI Markets within reach."}
          </strong>
          <p>
            {waitingWorker
              ? "Apply it when convenient. The application reloads only after you choose Update."
              : showIosHelp
                ? <>In Safari, tap Share, then <b>Add to Home Screen</b>.</>
                : "Install the secure app shell for fast access. Live market and account data are never stored for offline replay."}
          </p>
        </div>
        <div className="pwaInstallActions">
          {waitingWorker ? <button type="button" onClick={applyUpdate}>Update</button> : null}
          {!waitingWorker && promptEvent ? <button type="button" onClick={() => void install()}>Install</button> : null}
          <button type="button" className="pwaInstallDismiss" onClick={dismiss} aria-label="Dismiss installation guidance">
            Not now
          </button>
        </div>
      </aside>
    </>
  );
}
