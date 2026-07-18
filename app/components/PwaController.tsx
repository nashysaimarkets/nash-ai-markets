"use client";

import { useEffect, useRef, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "nash-pwa-install-dismissed";

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

function dismissedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberSessionDismissal(): void {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "true");
  } catch {
    // Storage can be unavailable in privacy modes; dismissal still works now.
  }
}

export function PwaController() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [status, setStatus] = useState("");
  const updateAccepted = useRef(false);

  useEffect(() => {
    let updateTimer: number | undefined;
    let iosPromptTimer: number | undefined;
    let loadHandler: (() => void) | undefined;
    let controllerChangeHandler: (() => void) | undefined;
    if ("serviceWorker" in navigator && window.isSecureContext) {
      const offerUpdate = (worker: ServiceWorker) => {
        setWaitingWorker(worker);
        setVisible(true);
      };
      const register = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
          if (registration.waiting) offerUpdate(registration.waiting);
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            installing?.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) offerUpdate(installing);
            });
          });
          updateTimer = window.setInterval(() => void registration.update(), 60 * 60 * 1_000);
        } catch {
          // Installation remains optional and the web experience stays available.
        }
      };
      if (document.readyState === "complete") void register();
      else {
        loadHandler = () => void register();
        window.addEventListener("load", loadHandler, { once: true });
      }
      controllerChangeHandler = () => {
        if (updateAccepted.current) window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", controllerChangeHandler);
    }

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    const handleInstalled = () => {
      setVisible(false);
      setStatus("NASH AI Markets is installed.");
    };
    if (!isStandalone() && !dismissedThisSession()) {
      if (isIosSafari()) {
        iosPromptTimer = window.setTimeout(() => {
          setShowIosHelp(true);
          setVisible(true);
        }, 0);
      }
      window.addEventListener("beforeinstallprompt", handleInstallPrompt);
      window.addEventListener("appinstalled", handleInstalled);
    }
    return () => {
      if (updateTimer !== undefined) window.clearInterval(updateTimer);
      if (iosPromptTimer !== undefined) window.clearTimeout(iosPromptTimer);
      if (loadHandler) window.removeEventListener("load", loadHandler);
      if (controllerChangeHandler) navigator.serviceWorker.removeEventListener("controllerchange", controllerChangeHandler);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("pwa-prompt-visible", visible);
    return () => document.documentElement.classList.remove("pwa-prompt-visible");
  }, [visible]);

  const dismiss = () => {
    rememberSessionDismissal();
    setVisible(false);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    setVisible(false);
    if (choice.outcome === "dismissed") rememberSessionDismissal();
    setStatus(choice.outcome === "accepted" ? "Installation accepted." : "Installation dismissed.");
  };

  const applyUpdate = () => {
    if (!waitingWorker) return;
    updateAccepted.current = true;
    setStatus("Applying application update.");
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <>
      <div className="pwaStatus" aria-live="polite">{status}</div>
      {visible ? (
        <aside className="pwaInstallPrompt" aria-labelledby="pwa-install-title">
          <div>
            <span className="pwaInstallEyebrow">{waitingWorker ? "APPLICATION UPDATE" : "INSTALL NASH AI MARKETS"}</span>
            <strong id="pwa-install-title">{waitingWorker ? "A secure update is ready." : "Keep Bullseye within reach."}</strong>
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
            <button type="button" className="pwaInstallDismiss" onClick={dismiss} aria-label="Dismiss installation guidance">Not now</button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
