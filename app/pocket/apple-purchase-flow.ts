export type AppleStoreAction = "purchase" | "restore";

export type AppleErrorDiagnostic = {
  operation: AppleStoreAction;
  stage: string;
  errors: { domain: string; code: number }[];
  appVersion: string;
  build: string;
  osVersion: string;
  environment: string;
  storefront: string;
  currency: string;
};

const appleErrorDomains = new Set([
  "StoreKit.StoreKitError", "SKErrorDomain", "ASDErrorDomain", "AMSErrorDomain",
  "NSURLErrorDomain", "NSCocoaErrorDomain", "NSPOSIXErrorDomain",
  "NSOSStatusErrorDomain", "AKAuthenticationError", "ACErrorDomain", "Other",
]);

/** Native-only diagnostic fields; never copy an arbitrary error or userInfo. */
export function appleErrorDiagnostic(caught: unknown): AppleErrorDiagnostic | null {
  if (!caught || typeof caught !== "object") return null;
  const raw = (caught as { purchaseDiagnostics?: unknown }).purchaseDiagnostics;
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (data.operation !== "purchase" && data.operation !== "restore") return null;
  const errors = (Array.isArray(data.errors) ? data.errors : []).slice(0, 4).flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const { domain, code } = entry as Record<string, unknown>;
    return typeof domain === "string" && appleErrorDomains.has(domain) && typeof code === "number" && Number.isSafeInteger(code)
      ? [{ domain, code }] : [];
  });
  if (!errors.length) return null;
  const version = (value: unknown) => typeof value === "string" && /^\d{1,6}(?:\.\d{1,6}){0,3}$/.test(value) ? value : "unknown";
  const countryOrCurrency = (value: unknown) => typeof value === "string" && /^[A-Z]{3}$/.test(value) ? value : "unknown";
  return {
    operation: data.operation,
    stage: typeof data.stage === "string" && ["catalogue", "confirmation", "verification", "sync"].includes(data.stage) ? data.stage : "unknown",
    errors,
    appVersion: version(data.appVersion),
    build: version(data.build),
    osVersion: version(data.osVersion),
    environment: data.environment === "sandbox" || data.environment === "production" ? data.environment : "unknown",
    storefront: countryOrCurrency(data.storefront),
    currency: countryOrCurrency(data.currency),
  };
}

export function formatAppleErrorDiagnostic(diagnostic: AppleErrorDiagnostic): string {
  return [
    `Action: ${diagnostic.operation} / ${diagnostic.stage}`,
    `Apple: ${diagnostic.errors.map(({ domain, code }) => `${domain}:${code}`).join(" > ")}`,
    `App: ${diagnostic.appVersion} (${diagnostic.build})`,
    `iOS: ${diagnostic.osVersion}`,
    `Environment: ${diagnostic.environment}`,
    `Storefront: ${diagnostic.storefront}; price currency: ${diagnostic.currency}`,
  ].join("\n");
}

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
  if (/^unable to complete request[.!]?$/i.test(message.trim())) {
    const action = kind === "purchase" ? "purchase" : "restore";
    return `Apple could not complete the ${action}. Your access has not been confirmed.${appleErrorDiagnostic(caught) ? " Open Apple error details below for the support code." : " Please try again after checking your Apple sign-in."}`;
  }
  return message;
}

export function appleInactiveMessage(kind: AppleStoreAction): string {
  return kind === "restore"
    ? "No active Pocket Bullseye subscription was found for this Apple Account. Check that you are using the account that made the purchase."
    : "Apple has not confirmed an active subscription yet. Check Apple access or restore purchases before trying to subscribe again.";
}
