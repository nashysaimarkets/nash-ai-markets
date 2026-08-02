"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "nash-presentation-mode";
const EVENT = "nash-presentation-change";

function applyPresentation(on: boolean) {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.dataset.presentation = "on";
  else delete document.documentElement.dataset.presentation;
}

function subscribe(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(EVENT, handler);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot() {
  return false;
}

export function PresentationModeToggle({ className = "" }: { className?: string }) {
  const on = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useLayoutEffect(() => {
    applyPresentation(on);
  }, [on]);

  const setPresentation = useCallback((next: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    applyPresentation(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return (
    <>
      <button
        type="button"
        className={`presentationToggle ${className}`.trim()}
        aria-pressed={on}
        aria-label={on ? "Exit presentation mode" : "Enter presentation mode"}
        onClick={() => setPresentation(!on)}
      >
        {on ? "Exit present" : "Present"}
      </button>
      <button
        type="button"
        className="presentationExit"
        aria-label="Exit presentation mode"
        onClick={() => setPresentation(false)}
      >
        Exit presentation
      </button>
    </>
  );
}
