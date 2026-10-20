"use client";
import { useEffect, useRef, useState } from "react";
import { pocketAuthenticatedFetch } from "./apple-storekit";
import { createScreenshotComparison, emptyComparisonState } from "./screenshot-comparison-session.ts";

export function useScreenshotComparison<T>(endpoint: string, failureMessage: string, validate: (value: unknown, context: Record<string, unknown>) => value is T) {
  const [state, setState] = useState(emptyComparisonState<T>);
  const session = useRef<ReturnType<typeof createScreenshotComparison<T>> | null>(null);
  useEffect(() => {
    const active = createScreenshotComparison<T>({ endpoint, failureMessage, fetch: pocketAuthenticatedFetch, publish: setState, validate });
    session.current = active;
    return () => { active.dispose(); if (session.current === active) session.current = null; };
  }, [endpoint, failureMessage, validate]);
  return { ...state,
    attach: (file: File) => session.current?.attach(file),
    check: (context: Record<string, unknown>) => session.current?.check(context),
    cancel: () => session.current?.cancel(),
  };
}
