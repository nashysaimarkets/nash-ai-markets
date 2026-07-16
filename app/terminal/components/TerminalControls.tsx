"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TERMINAL_SHORTCUTS } from "../lib/terminal-state.ts";

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function TerminalControls() {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [showHelp, setShowHelp] = useState(false);

  const refresh = useCallback(() => {
    document.documentElement.dataset.terminalRefreshing = "true";
    startTransition(() => router.refresh());
    window.setTimeout(() => delete document.documentElement.dataset.terminalRefreshing, 900);
  }, [router]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Browsers can reject full-screen requests; the terminal remains usable.
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "r") {
        event.preventDefault();
        refresh();
      } else if (key === "f") {
        event.preventDefault();
        void toggleFullscreen();
      } else if (event.key === "?") {
        event.preventDefault();
        setShowHelp((visible) => !visible);
      } else if (event.key === "Escape") {
        setShowHelp(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [refresh, toggleFullscreen]);

  return (
    <div className="terminalControls" aria-label="Terminal controls">
      <button type="button" onClick={refresh} disabled={isRefreshing} aria-keyshortcuts="R">
        <span aria-hidden="true">↻</span> {isRefreshing ? "Refreshing…" : "Refresh"}
      </button>
      <button type="button" onClick={() => void toggleFullscreen()} aria-keyshortcuts="F" title="Full screen (F)">⛶</button>
      <button type="button" onClick={() => setShowHelp(true)} aria-keyshortcuts="?" title="Keyboard help (?)">?</button>
      {showHelp ? (
        <div className="terminalHelpBackdrop" role="presentation" onMouseDown={() => setShowHelp(false)}>
          <section className="terminalHelp" role="dialog" aria-modal="true" aria-labelledby="terminal-help-title" onMouseDown={(event) => event.stopPropagation()}>
            <div><span className="terminalPanelEyebrow">KEYBOARD CONTROLS</span><h2 id="terminal-help-title">Terminal shortcuts</h2></div>
            <button type="button" className="terminalHelpClose" onClick={() => setShowHelp(false)} aria-label="Close keyboard help">×</button>
            <dl>{TERMINAL_SHORTCUTS.map((shortcut) => <div key={shortcut.key}><dt>{shortcut.key}</dt><dd>{shortcut.label}</dd></div>)}</dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}
