/**
 * `useSyncExternalStore` compares snapshots with `Object.is` and re-renders
 * whenever the reference changes. The localStorage readers in this folder each
 * parse and rebuild their state on every call, so passing them directly as
 * `getSnapshot` produced a new object on every render and React looped until it
 * threw "Maximum update depth exceeded", taking the whole route down with it.
 *
 * Wrapping a reader here keeps the previous reference while the underlying
 * value is unchanged, which is the contract `useSyncExternalStore` expects.
 */
export function createCachedSnapshot<T>(read: () => T): () => T {
  let cachedKey: string | undefined;
  let cachedValue: T;
  let primed = false;

  return () => {
    const next = read();
    let key: string;
    try {
      key = JSON.stringify(next) ?? "undefined";
    } catch {
      // Unserialisable state cannot be compared; treat every read as fresh
      // rather than risk handing back a stale reference.
      return next;
    }
    if (!primed || key !== cachedKey) {
      cachedKey = key;
      cachedValue = next;
      primed = true;
    }
    return cachedValue;
  };
}

/**
 * Server snapshots must also be referentially stable across calls, so build the
 * value once and hand back the same object every time.
 */
export function createConstantSnapshot<T>(build: () => T): () => T {
  let value: T;
  let built = false;
  return () => {
    if (!built) {
      value = build();
      built = true;
    }
    return value;
  };
}
