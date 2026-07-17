"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TERMINAL_SHORTCUTS } from "../lib/terminal-state.ts";

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function TerminalControls() {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [showHelp, setShowHelp] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!showHelp) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : helpButtonRef.current;
    closeButtonRef.current?.focus();
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = document.getElementById("terminal-help-dialog");
      const controls = dialog?.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
      if (!controls?.length) return;
      const first = controls[0]!;
      const last = controls[controls.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keepFocusInside);
    return () => { window.removeEventListener("keydown", keepFocusInside); previousFocus?.focus(); };
  }, [showHelp]);

  return (
    <div className="terminalControls" role="group" aria-label="Terminal controls">
      <button type="button" onClick={refresh} disabled={isRefreshing} aria-keyshortcuts="R">
        <span aria-hidden="true">↻</span> {isRefreshing ? "Refreshing…" : "Refresh"}
      </button>
      <button type="button" onClick={() => void toggleFullscreen()} aria-keyshortcuts="F" aria-label="Toggle full screen" title="Full screen (F)">⛶</button>
      <button ref={helpButtonRef} type="button" onClick={() => setShowHelp(true)} aria-keyshortcuts="?" aria-label="Open keyboard help" aria-expanded={showHelp} aria-controls="terminal-help-dialog" title="Keyboard help (?)">?</button>
      <span className="terminalRefreshStatus" aria-live="polite">{isRefreshing ? "Refreshing terminal data" : ""}</span>
      {showHelp ? (
        <div className="terminalHelpBackdrop" role="presentation" onMouseDown={() => setShowHelp(false)}>
          <section id="terminal-help-dialog" className="terminalHelp" role="dialog" aria-modal="true" aria-labelledby="terminal-help-title" aria-describedby="terminal-help-description" onMouseDown={(event) => event.stopPropagation()}>
            <div><span className="terminalPanelEyebrow">KEYBOARD CONTROLS</span><h2 id="terminal-help-title">Terminal shortcuts</h2></div>
            <p id="terminal-help-description" className="terminalHelpDescription">Use these shortcuts when focus is outside a form control.</p>
            <button ref={closeButtonRef} type="button" className="terminalHelpClose" onClick={() => setShowHelp(false)} aria-label="Close keyboard help">×</button>
            <dl>{TERMINAL_SHORTCUTS.map((shortcut) => <div key={shortcut.key}><dt>{shortcut.key}</dt><dd>{shortcut.label}</dd></div>)}</dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}
