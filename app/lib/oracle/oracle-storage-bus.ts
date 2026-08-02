/** Tiny same-tab pub/sub for localStorage-backed Oracle prefs. */

const listeners = new Set<() => void>();

export function subscribeOracleStorage(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStoreChange);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStoreChange);
    }
  };
}

export function notifyOracleStorage(): void {
  for (const listener of listeners) listener();
}
