export type AppleStoreAction = "purchase" | "restore";

/** Keep one native operation alive across closing and reopening the paywall.
 * A UI timer must never treat an unconfirmed purchase as cancelled or retry it.
 */
export function createAppleActionCoordinator<T>(actions: Record<AppleStoreAction, () => Promise<T>>) {
  let active: { kind: AppleStoreAction; promise: Promise<T> } | null = null;
  return {
    pending: () => active,
    run(kind: AppleStoreAction): Promise<T> {
      if (active) {
        if (active.kind === kind) return active.promise;
        return Promise.reject(new Error("Apple is still handling the previous request. Check your access before starting another."));
      }
      const promise = Promise.resolve().then(actions[kind]).finally(() => {
        if (active?.promise === promise) active = null;
      });
      active = { kind, promise };
      return promise;
    },
  };
}

export function appleActionErrorMessage(caught: unknown, kind: AppleStoreAction): string {
  const details = caught && typeof caught === "object" ? caught as { message?: unknown; code?: unknown } : null;
  const message = typeof details?.message === "string" ? details.message : typeof caught === "string" ? caught : "Apple could not complete that request. Please try again.";
  if (details?.code === "STORE_PURCHASE_CANCELLED" || /cancelled|canceled/i.test(message)) {
    return kind === "restore" ? "Restore cancelled. You can try again when ready." : "Purchase cancelled. You have not been charged.";
  }
  return message;
}

export function appleInactiveMessage(kind: AppleStoreAction): string {
  return kind === "restore"
    ? "No active Pocket Bullseye subscription was found for this Apple Account. Check that you are using the account that made the purchase."
    : "Apple has not confirmed an active subscription yet. Check Apple access or restore purchases before trying to subscribe again.";
}
